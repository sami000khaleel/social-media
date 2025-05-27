const User = require("../models/userSchema");
const authentication = require("../middleware/authentication");
const { throwError, handleError } = require("../errorHandler");
const { profileImageUploader } = require("../multerUploaders");
const fs = require("fs");
const path = require("path");
class userController {
  contructor() {}

  static sanitizeUser(user) {
    const { password, __v, _id, createdAt, updatedAt, ...sanitized } =
      user.toObject ? user.toObject() : user;
    return sanitized;
  }
  static async sendProfileImage(req, res) {
    try {
      if (!req.query?.profileImagePath) throwError("No path was sent", 400);
      const imagePath = path.join(__dirname,'..',req.query.profileImagePath);

      if (!fs.existsSync(imagePath)) throwError("No file was found", 404);
      res.sendFile(imagePath)
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
