const { handleError } = require("../errorHandler");
const User = require("../models/userSchema");
const authentication = require("./authentication");
const fs=require('fs')
const path=require('path')
class userMiddleware {
  constructor() {}
  static async profileSetupMiddleware(req, res, next) {
    try {
      // 1. Validate token and get user
      const { userId } = await authentication.validateToken(req);
      const user = await User.findById(userId);
      
      if (!user) {
        throwError('User not found', 404);
      }
  
      // 2. Set user on request
      req.user = user;
  
      // 3. Ensure user's profile directory exists
      const userProfileDir = path.join(__dirname, '../uploads/profiles', user._id.toString());
      
      if (!fs.existsSync(userProfileDir)) {
        fs.mkdirSync(userProfileDir, { recursive: true });
        console.log(`Created profile directory for user ${user._id}`);
      }
  
      // 4. Delete old profile image if it exists
      if (user.profileImage) {
        const oldImagePath = path.join(
          __dirname,
          '..',
          user.profileImage.startsWith('/') 
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
          console.error('Error deleting old profile image:', err);
          // Continue anyway - don't fail the request
        }
      }
  
      return next();
    } catch (err) {
      handleError(err, res);
    }
  }
}
module.exports=userMiddleware