const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const User = require("../models/userSchema");
const Post = require("../models/postSchema");
const authentication = require("../middleware/authentication");
const { throwError, handleError } = require("../errorHandler");
class postMiddleware {
  constructor() {}
  static async findPostById(postId){
    if(!postId)throwError('no post id was found',400)
      const post=await Post.findById(postId)
    if(!post?.id) throwError('no post was found')
      return post
  }
  static deleteImages(deleteImagesIds, basePath) {
    // Delete each image
    for (const imageName of deleteImagesIds) {
      const imagePath = path.join(basePath, imageName);

      // Security check
      if (imageName.includes("../") || imageName.includes("..\\")) {
        throwError("Invalid image path", 400);
      }

      // Verify file exists and is a file (not directory)
      if (!fs.existsSync(imagePath) || !fs.statSync(imagePath).isFile()) {
        throwError(`Image ${imageName} does not exist or is invalid`, 404);
      }

      // Actually delete the file
      fs.unlinkSync(imagePath);
      console.log(`Deleted: ${imagePath}`);
    }
  }
  static checkIfImagesExist(deleteImagesIds, postId, basePath) {
    if (!fs.existsSync(basePath)) throwError("folder does not exits", 404);
    if (!fs.statSync(basePath).isDirectory())
      throwError("Path is not a directory", 400);
    for (let imageName of deleteImagesIds) {
      let imagePath = path.join(basePath, imageName);
      console.log(imagePath);
      if (!fs.existsSync(imagePath)) throwError("image does not exits", 404);
    }
  }
  static async postsImagesSetupMiddleware(req, res, next) {
    try {
      // Authentication
      const { userId } = await authentication.validateToken(req);
      const user = await User.findById(userId);
      if (!user) throwError("User not found", 404);

      req.user = user;

      // Create post directory
      const postId = new mongoose.Types.ObjectId();
      const postDir = path.join(
        __dirname,
        "../uploads/posts",
        postId.toString()
      );

      fs.mkdirSync(postDir, { recursive: true });

      req.postId = postId;
      next();
    } catch (err) {
      handleError(err, res);
    }
  }
  static async postsImagesModifierSetupMiddleware(req, res, next) {
    try {
      // Authentication
      const { userId } = await authentication.validateToken(req);
      const user = await User.findById(userId);
      console.log(req.headers['post-id'])
      if (!user) throwError("User not found", 404);
      if (!req.headers['post-id']) throwError("no post id was sent", 400);
      let post = await Post.findById(req.headers['post-id']);
      if (!post.id) throwError("no post was found", 404);
      req.post = post;
      req.user = user;
      req.postId = post.id;
      next();
    } catch (err) {
      handleError(err, res);
    }
  }
}
module.exports = postMiddleware;
