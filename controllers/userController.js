const User = require("../models/userSchema");
const userMiddleware = require("../middleware/userMiddleware");
const authentication = require("../middleware/authentication");
const Post = require("../models/postSchema");
const { throwError, handleError } = require("../errorHandler");
const { profileImageUploader } = require("../multerUploaders");
const fs = require("fs");
const {sendNotification}=require('../notificationUtils')
const mongoose = require("mongoose");
const path = require("path");
const jwt = require("jsonwebtoken");
class userController {
  constructor() {}

  static sanitizeUser(user) {
    const { password, __v, _id, createdAt, updatedAt, ...sanitized } =
      user.toObject ? user.toObject() : user;
    return sanitized;
  }
  static async blockUnblock(req, res) {
    try {
      const { userId } = await authentication.validateToken(req);
      const { targetUserId } = req.body;

      if (!targetUserId) throwError("No target user ID was sent", 400);
      if (userId === targetUserId) throwError("Cannot block yourself", 400);

      const [user, targetUser] = await Promise.all([
        userMiddleware.findUserById(userId),
        userMiddleware.findUserById(targetUserId),
      ]);

      if (!targetUser) throwError("Target user not found", 404);

      const isBlocked = userMiddleware.hasUser1blockedUser2(
        user,
        targetUser.id
      );

      if (isBlocked) {
        // Unblock
        userMiddleware.unBlockUser(user, targetUser);
        await user.save();

        return res.status(200).json({
          success: true,
          message: "User unblocked successfully",
        });
      } else {
        // Block
        const { canBlock, reason } = userMiddleware.canUserBlock(
          user,
          targetUser
        );
        if (!canBlock) throwError(reason, 403);

        userMiddleware.blockUser(user, targetUser);
        await Promise.all([user.save(), targetUser.save()]);

        return res.status(200).json({
          success: true,
          message: "User blocked successfully",
        });
      }
    } catch (error) {
      handleError(error, res);
    }
  }

  static async followUnfollow(req, res) {
    try {
      const { targetUserId } = req.body;
      if (!targetUserId) throwError("no user id was found", 400);
      const { userId } = await authentication.validateToken(req);
      const [user, targetUser] = await Promise.all([
        userMiddleware.findUserById(userId),
        userMiddleware.findUserById(targetUserId),
      ]);
      if (userMiddleware.hasUser1blockedUser2(targetUser, user.id))
        throwError("you have been blocked by this user", 403);
      if (userMiddleware.hasUser1blockedUser2(user, targetUser.id))
        throwError("you have blocked this user", 403);
      const isFollowing = user.following.some((id) =>
        id.equals(targetUser._id)
      );
      const result = isFollowing
        ? userMiddleware.unfollow(user, targetUser)
        : userMiddleware.follow(user, targetUser);

      await Promise.all([result.user.save(), result.targetUser.save()]);
      sendNotification({io:req.app.get('io'),
        type: "follow",
        actorUser: user,
        targetUserId: targetUser._id,
      });
      return res.json({ success: true });
    } catch (error) {
      handleError(error, res);
    }
  }
  static async getNameImage(req, res) {
    try {
      const { userId } = await authentication.validateToken(req);
      const currentUser = await userMiddleware.findUserById(userId);

      if (!req.query?.usersIds) throwError("no ids were sent");

      let usersIds = req.query.usersIds.split("-");
      // Remove current user's ID and invalid IDs
      usersIds = usersIds.filter(
        (id) =>
          id.toString() !== currentUser.id.toString() &&
          mongoose.Types.ObjectId.isValid(id)
      );

      // Find users and exclude those who blocked the current user
      const users = await User.find({
        _id: { $in: usersIds },
        "blockedUsers.blockedUserId": { $ne: currentUser._id },
      }).select("userName profileImage");

      return res.json({ success: true, users });
    } catch (error) {
      handleError(error, res);
    }
  }
  static async receiveFirstConfirmation(req, res) {
    try {
      let { token } = req.query;
      if (!token) throwError("no token was sent");

      const { userId, newEmail, type } = await jwt.verify(
        token,
        process.env.JWT_SECRET
      );
      const user = await userMiddleware.findUserById(userId);

      // Create token for new email confirmation
      const newEmailConfirmationToken = jwt.sign(
        { userId, newEmail, type: "new-email-confirm" },
        process.env.JWT_SECRET,
        { expiresIn: "30s" }
      );

      // Send confirmation to new email
      await authentication.sendConfirmationEmail({
        email: newEmail,
        subject: "Verify Your New Email",
        html: authentication.createEmailChangeConfirmationHtml(
          newEmailConfirmationToken,
          "new"
        ),
      });

      // Return HTML response for old email confirmation
      const html = authentication.createEmailChangeConfirmationPage("first", {
        oldEmail: user.email,
        newEmail: newEmail,
      });
      console.log("asdsadadsa");
      return res.send(html);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        const html =
          authentication.createEmailChangeConfirmationPage("expired");
        return res.status(401).send(html);
      }
      handleError(error, res);
    }
  }
  static async getUsersProfile(req, res) {
    try {
      const { userId } = await authentication.validateToken(req);
      const requester = await userMiddleware.findUserById(userId);
      if (!req.query?.userId) throwError("no user id was sent", 400);
      let user = await userMiddleware.findUserById(req.query.userId);
      if (userMiddleware.hasUser1blockedUser2(requester, user.id))
        throwError("you have blocked this user", 403);
      if (userMiddleware.hasUser1blockedUser2(user, requester.id))
        throwError("you have been blocked by this user", 403);
      let usersPosts = [];
      if (user.posts.length)
        usersPosts = await userMiddleware.getUsersPosts(user);
      console.log(usersPosts);
      usersPosts = await Promise.all(
        usersPosts.map(async (usersPost) => {
          return await usersPost.populate({
            path: "firstLayerComments",
            select: "-__v", // Remove space after -
            populate: {
              path: "user",
              select: "userName profileImage", // Remove trailing space
            },
          });
        })
      );
      user.posts = usersPosts;

      user = userController.sanitizeUser(user);
      return res.json({ success: true, user });
    } catch (error) {
      handleError(error, res);
    }
  }
  static async receiveSecondConfirmation(req, res) {
    try {
      let { token } = req.query;
      if (!token) throwError("no token was sent");

      const { userId, newEmail, type } = await jwt.verify(
        token,
        process.env.JWT_SECRET
      );
      const user = await userMiddleware.findUserById(userId);

      // Update the email
      user.email = newEmail;
      await user.save();

      // Return HTML response for successful change
      const html = authentication.createEmailChangeConfirmationPage("second", {
        newEmail: newEmail,
      });

      return res.send(html);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        const html =
          authentication.createEmailChangeConfirmationPage("expired");
        return res.status(401).send(html);
      }
      handleError(error, res);
    }
  }
  static async changeEmail(req, res) {
    try {
      const { userId } = await authentication.validateToken(req);
      const user = await userMiddleware.findUserById(userId);
      const { newEmail } = req.body;
      if (user.email === newEmail) throwError("send a different email", 404);
      if (!newEmail) throwError("send a new Email", 404);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        throwError("Invalid email format", 400);
      }

      const foundUser = await User.findOne({ email: newEmail });
      if (foundUser && foundUser._id.toString() !== userId.toString()) {
        throwError("Email already in use by another account", 409);
      }

      const oldEmailConfirmationToken = jwt.sign(
        { userId, newEmail, type: "old-email-confirm" },
        process.env.JWT_SECRET,
        { expiresIn: "30s" }
      );
      await authentication.sendConfirmationEmail({
        email: user.email,
        subject: "Confirm Email Change",
        html: authentication.createEmailChangeConfirmationHtml(
          oldEmailConfirmationToken,
          "old"
        ),
      });
      return res.json({
        success: true,
        message: `confirmation email was sent to ${user.email} please confirm within 30s`,
      });
    } catch (error) {
      handleError(error, res);
    }
  }
  static async changePassword(req, res) {
    try {
      const { userId } = await authentication.validateToken(req);
      let user = await User.findById(userId);
      if (!user?.id) throwError("no user was found", 404);
      if (!req.body?.oldPassword || !req.body?.newPassword)
        throwError("missing either of the passwords", 400);
      await authentication.verifyPassword(req.body.oldPassword, user.password);
      const newHashedPassword = await authentication.hashPassword(
        req.body.newPassword
      );
      user.password = newHashedPassword;
      await user.save();
      return res.json({ success: true });
    } catch (error) {
      handleError(error, res);
    }
  }
  static async modifyProfile(req, res) {
    try {
      let { user } = req;
      let fields = ["userName", "firstName", "lastName", "birthDate", "about"];
      for (const field of fields) {
        if (!Object.hasOwn(req.body, field)) continue;
        user[field] = req.body[field];
      }
      if (Object.hasOwn(req.body, "country"))
        user.location.country = req.body.country;
      if (Object.hasOwn(req.body, "city")) user.location.city = req.body.city;
      if (Object.hasOwn(req.body, "preferredTopics")) {
        let { preferredTopics } = req.body;
        if (!preferredTopics) user.preferredTopics = preferredTopics;
        else {
          preferredTopics = preferredTopics.split("_");
          user.preferredTopics = preferredTopics;
        }
      }

      // Handle deleted images
      if (Object.hasOwn(req.body, "deleteImages") && req.body.deleteImages) {
        const deleteImages = req.body.deleteImages.split("-");
        const basePath = path.join(
          __dirname,
          "..",
          "uploads",
          "usersImages",
          user.id
        );

        for (const deletedImage of deleteImages) {
          // Fixed variable name
          const filePath = path.join(basePath, deletedImage);
          fs.unlinkSync(filePath); // Async deletion
          user.files = user.files.filter((file) => file !== deletedImage); // Fixed: assign filtered array
        }
      }

      if (req?.files.length) {
        let { files } = req;
        for (let file of files) user.files.push(file.filename);
      }
      await user.save();
      user = userController.sanitizeUser(user);
      return res.json({ success: true, user });
    } catch (error) {
      handleError(error, res);
    }
  }
  static async sendProfileImage(req, res) {
    try {
      if (!req.query?.profileImagePath) throwError("No path was sent", 400);
      const imagePath = path.join(__dirname, "..", req.query.profileImagePath);

      if (!fs.existsSync(imagePath)) throwError("No file was found", 404);
      res.sendFile(imagePath);
    } catch (error) {
      handleError(error, res);
    }
  }
  static async setProfileImage(req, res) {
    try {
      const user = req.user; // From authenticateUser middleware

      if (!user) {
        throwError("User not found", 404);
      }

      // 1. Verify file was uploaded
      if (!req.file) {
        throwError("No file uploaded", 400);
      }

      // 3. Update user with new image path
      // Correct path to match your storage destination
      const imageUrl = `/uploads/profiles/${user._id}/${req.file.filename}`;
      user.profileImage = imageUrl;
      await user.save();

      return res.json({
        success: true,
        profileImage: user.profileImage,
      });
    } catch (error) {
      handleError(error, res);
    }
  }
  static async verifyCode(req, res) {
    try {
      if (!req.headers.code) throwError("no code", 400);
      if (!req?.query?.email) throwError("email was not sent", 400);
      const user = await User.findOne({ email: req?.query?.email });
      if (!user?.email) throwError("user was not found", 400);
      await authentication.checkCodeAge(req.headers["code"], user);
      await authentication.checkIfCodeMatches(req.headers["code"], user);
      const token = authentication.createToken(user.id);
      req.set("Authorization", { token: `BEARER ${token}` });
      res.json({ success: true });
    } catch (error) {
      handleError(error, res);
    }
  }
  static async createVerificationCode(req, res) {
    try {
      if (!req?.query?.email) throwError("email was not sent", 400);
      const user = await User.findOne({ email: req.query.email });
      if (!user?.email) throwError("user was not found", 404);
      const code = await authentication.createVerificationCode(user);
      await authentication.sendCode(user.email, code);
      await user.save();
      return res.json({ success: true });
    } catch (error) {
      handleError(error, res);
    }
  }
  static async validateToken(req, res) {
    try {
      // console.log(req.headers.authorization)
      // if(!req.headers.authorization)
      // throwError('no token was sent',400)
      // const token=req.headers.authorization.split(' ')[1]
      const token = await authentication.validateToken(req);
      console.log(token);

      return res.json({ success: true });
    } catch (error) {
      handleError(error, res);
    }
  }
  static async login(req, res) {
    try {
      if (!req.query?.email || !req.headers?.password)
        throwError("Missing data", 400);
      let user = await User.findOne({ email: req.query.email });
      if (!user["email"]) throwError("Email was wrong", 400);
      await authentication.verifyPassword(req.headers.password, user.password);
      const token = await authentication.createToken(user.id);
      console.log(token);
      res.set("Authorization", `BEARER ${token}`);
      return res.status(200).json({ success: true, user });
    } catch (error) {
      handleError(error, res);
    }
  }
  static async createAccount(req, res) {
    try {
      await authentication.validateAccountData(req.body);
      const haschedPassword = await authentication.hashPassword(
        req.headers.password
      );
      req.body.password = haschedPassword;
      let user = await User.findOne({ email: req.body.email });
      if (user) throwError("that email already exists", 400);
      user = new User(req.body);
      const userToken = await authentication.createToken(user.id);
      res.set("Authorization", `BEARER ${userToken}`);
      await user.save();
      const sanitizedUser = userController.sanitizeUser(user);
      return res.json({
        success: true,
        user: { ...sanitizedUser, id: user._id },
      });
    } catch (error) {
      handleError(error, res);
    }
  }
}
module.exports = userController;
