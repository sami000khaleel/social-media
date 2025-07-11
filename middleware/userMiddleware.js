const { handleError, throwError } = require("../errorHandler");
const User = require("../models/userSchema");
const authentication = require("./authentication");
const fs = require("fs");
const path = require("path");
const Post = require("../models/postSchema");
class userMiddleware {
  constructor() {}
  static hasUser1blockedUser2(user1, user2Id) {
  return user1.blockedUsers.some(blocked => 
    blocked.blockedUserId.toString() === user2Id.toString()
  );
}

static canUserBlock(user, targetUser) {
  // Check if target user has already blocked the current user
  const isTargetBlockingUser = targetUser.blockedUsers.some(blocked => 
    blocked.blockedUserId.toString() === user._id.toString()
  );
  
  if (isTargetBlockingUser) {
    return { canBlock: false, reason: "Target user has already blocked you" };
  }

  // Check if user has recently unblocked this target user (within 3 days)
  const lastBlockEntry = user.blockedUsers.find(blocked => 
    blocked.blockedUserId.toString() === targetUser._id.toString()
  );

  if (lastBlockEntry) {
    const now = new Date();
    const lastActionDate = new Date(lastBlockEntry.date);
    const daysSinceLastAction = (now - lastActionDate) / (1000 * 60 * 60 * 24);
    
    if (daysSinceLastAction < 3) {
      return { 
        canBlock: true, 
        reason: `You must wait ${Math.ceil(3 - daysSinceLastAction)} more days before blocking again` 
      };
    }
  }

  return { canBlock: true };
}

static blockUser(user, targetUser) {
  // Add to blocked users with current date
  user.blockedUsers.push({
    blockedUserId: targetUser._id,
    date: new Date()
  });
  
  // Remove from following/followers if needed
  const updatedUsers = this.unfollow(user, targetUser);
  
  return updatedUsers;
}

static unBlockUser(user, targetUser) {
  // Remove from blocked users
  user.blockedUsers = user.blockedUsers.filter(blocked => 
    blocked.blockedUserId.toString() !== targetUser._id.toString()
  );
  
  return { user };
}
  static async getUsersPosts(user) {
    let postsIds = user.posts;
    console.log(postsIds);
    let posts = await Post.find({ _id: { $in: postsIds } });
    return posts;
  }
  static unfollow(user, targetUser) {
    user.following = user.following.filter(
      (id) => id.toString() != targetUser.id.toString()
    );
    targetUser.followers = targetUser.followers.filter(
      (id) => id.toString() != user.id.toString()
    );
    return { user, targetUser };
  }
  static follow(user, targetUser) {
    user.following.push(targetUser.id);
    targetUser.followers.push(user.id);
    return { user, targetUser };
  }
  static async findUserById(userId) {
    const user = await User.findById(userId);
    if (!user.id) throwError("user was not found", 404);
    return user;
  }
  static async profileSetupMiddleware(req, res, next) {
    try {
      // 1. Validate token and get user
      const { userId } = await authentication.validateToken(req);
      const user = await User.findById(userId);

      if (!user) {
        throwError("User not found", 404);
      }

      // 2. Set user on request
      req.user = user;

      // 3. Ensure user's profile directory exists
      const userProfileDir = path.join(
        __dirname,
        "../uploads/profiles",
        user._id.toString()
      );

      if (!fs.existsSync(userProfileDir)) {
        fs.mkdirSync(userProfileDir, { recursive: true });
        console.log(`Created profile directory for user ${user._id}`);
      }

      // 4. Delete old profile image if it exists
      if (user.profileImage) {
        const oldImagePath = path.join(
          __dirname,
          "..",
          user.profileImage.startsWith("/")
            ? user.profileImage.substring(1) // Remove leading slash
            : user.profileImage
        );

        try {
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
            console.log(`Deleted old profile image for user ${user._id}`);
            // Clear the profileImage reference if you want immediate update
            // user.profileImage = undefined;
            // await user.save();
          }
        } catch (err) {
          console.error("Error deleting old profile image:", err);
          // Continue anyway - don't fail the request
        }
      }

      return next();
    } catch (err) {
      handleError(err, res);
    }
  }
  static async profileModificationMiddleware(req, res, next) {
    try {
      const { userId } = await authentication.validateToken(req);
      const user = await User.findById(userId);
      if (!user?.id) throwError("no user was found", 400);
      req.user = user;
      const dirPath = path.join(
        __dirname,
        "..",
        "uploads",
        "usersImages",
        user.id
      );
      if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
      return next();
    } catch (error) {
      handleError(error, res);
    }
  }
}
module.exports = userMiddleware;
