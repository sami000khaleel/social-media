const Post = require("../models/postSchema");
const path = require("path");
const fs = require("fs");
const User = require("../models/userSchema");
const authentication = require("../middleware/authentication");
const Comment = require("../models/commentSchema");
const postMiddleware = require("../middleware/postMiddleware");
const commentMiddleware = require("../middleware/commentMiddleware");
const { handleError, throwError } = require("../errorHandler");
const userMiddleware = require("../middleware/userMiddleware");
class postController {
  constructor() {}
  static async getPost(req, res) {
    try {
      const { postId } = req.query;
      const post = await postMiddleware.findPostById(postId);
      console.log(post);
      await post.populate([
        { path: "publisher", select: "userName profileImage" },
        {
          path: "firstLayerComments",
          select: "content repliedBy repliedTo likedBy createdAt",
          populate: { path: "user", select: "userName profileImage" },
        },
      ]);
      return res.json({ success: true, post });
    } catch (error) {
      handleError(error, res);
    }
  }
  static async likeUnlikePost(req, res) {
    try {
      const { userId } = await authentication.validateToken(req);
      const user = await userMiddleware.findUserById(userId);
      const { postId } = req.body;
      if (!postId) throwError("no post id was sent");
      let post = await postMiddleware.findPostById(postId);
      // if (post.deletedFlag) throwError("this post was deleted", 401);
      if (!post.likes.includes(user.id)) post.likes.push(user.id);
      else {
        post.likes = post.likes.filter((likerId) => likerId != user.id);
      }
      console.log(post.likes);
      await post.save();
      return res.json({ success: true });
    } catch (error) {
      handleError(error, res);
    }
  }
  static async deletePost(req, res) {
    try {
      const { userId } = await authentication.validateToken(req);
      const user = await userMiddleware.findUserById(userId);
      const { postId } = req.query;
      const post = await Post.findById(postId);
      console.log(post, postId);
      if (!post?.id) throwError("no post was found", 404);
      if (post.publisher != user.id)
        throwError("you are not the owner of the post", 401);
      if (post.deletedFlag) throwError("this post was already deleted", 404);
      post.deletedFlag = true;
      await post.save();
      return res.json({
        success: true,
        message: "post has been deleted successfuly",
      });
    } catch (error) {
      handleError(error, res);
    }
  }
  static async modifyPost(req, res) {
    try {
      let user = req.user;
      let post = req.post;
      let { deleteImagesIds } = req.body;
      let fields = ["topic", "description"];
      for (let field of fields) {
        if (!Object.hasOwn(req.body, field)) continue;
        post[field] = req.body[field];
      }

      const filesToDelete = deleteImagesIds ? deleteImagesIds.split("-") : [];

      // Handle file uploads
      if (req.files?.length) {
        for (const file of req.files) {
          post.files.push(file.filename); // Changed fileName to filename (common convention)
        }
      }

      // Handle file deletions
      if (filesToDelete.length) {
        const basePath = path.join(__dirname, "../uploads/posts", post.id);

        // Validate and delete images
        await postMiddleware.checkIfImagesExist(
          filesToDelete,
          post.id,
          basePath
        );
        await postMiddleware.deleteImages(filesToDelete, basePath);

        // Update post files array (fixed filter implementation)
        post.files = post.files.filter(
          (fileName) => !filesToDelete.includes(fileName)
        );
      }

      // Save changes
      await post.save(); // Changed from user.save() to post.save()
      await user.save(); // If you actually need to save user too

      return res.json({ success: true, post });
    } catch (error) {
      handleError(error, res);
    }
  }
  static async createPost(req, res) {
    try {
      // Validate request data
      if (!req.body?.topic) throwError("No topic selected", 400);
      if (!req.body?.description && !req.files?.length)
        throwError("Post must have content or images", 400);

      const { topic, description } = req.body;
      const postId = req.postId; // From middleware
      const userId = req.user.id; // From auth middleware

      const post = await Post.create({
        reelFlag: req.body?.reelFlag == "true" ? true : false,
        topic,
        description, // Fixed typo (was 'describtion')
        files: req.files?.map((file) => file.filename) || [],
        publisher: userId,
        _id: postId,
      });
      const user = await User.findById(userId);
      user.posts.push(postId);
      await user.save();
      res.status(201).json({
        success: true,
        post,
      });
    } catch (err) {
      // Cleanup: Delete uploaded files if error occurs
      if (req.files?.length) {
        const postDir = path.join(
          __dirname,
          "../uploads/posts",
          req.postId.toString()
        );
        req.files.forEach((file) => {
          try {
            fs.unlinkSync(path.join(postDir, file.filename));
          } catch (cleanupErr) {
            console.error("Cleanup error:", cleanupErr);
          }
        });
      }
      handleError(err, res);
    }
  }
}
module.exports = postController;
