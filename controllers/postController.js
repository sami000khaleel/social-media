const Post = require("../models/postSchema");
const path = require("path");
const fs = require("fs");
const {sendNotification}=require('../notificationUtils')
const User = require("../models/userSchema");
const authentication = require("../middleware/authentication");
const Comment = require("../models/commentSchema");
const postMiddleware = require("../middleware/postMiddleware");
const commentMiddleware = require("../middleware/commentMiddleware");
const { handleError, throwError } = require("../errorHandler");
const axios = require("axios");
const userMiddleware = require("../middleware/userMiddleware");
class postController {
  constructor() {}

  static async getPosts(req, res) {
  try {
    const categories = [
      "Anxiety & Stress Management",
      "Depression & Mood Disorders",
      "Relationships & Interpersonal Issues",
      "Self-Esteem & Identity",
      "Trauma & PTSD",
      "Growth, Healing & Motivation",
    ];

    const { userId } = await authentication.validateToken(req);
    const user = await userMiddleware.findUserById(userId);
    const { logs, existingPostIds = [], postsNumber = 50 } = req.body;

    const reelFlag = req.body?.reelFlag 

    let recommendations = null;
    if (logs) {
      try {
        const aiUrl = `${process.env.AIURL}/recommend`;

        const aiResponse = await axios.post(aiUrl, { logs }, {
          headers: { "Content-Type": "application/json" },
        });

        recommendations = aiResponse.data?.recommendations;

        if (!recommendations || recommendations.length !== categories.length) {
          throwError("Invalid AI response", 500);
        }
      } catch (err) {
        console.error("AI error:", err.message);
        throwError("AI recommendation service failed", 500);
      }
    }

    const categoryScorePairs = (recommendations ?? categories.map(() => 1))
      .map((score, index) => ({
        category: categories[index],
        score,
      }))
      .filter((pair) => pair.score > 0);

    const totalScore = categoryScorePairs.reduce(
      (sum, c) => sum + c.score,
      0
    );

    const posts = new Map();
    const categoryStats = {};

    for (const { category, score } of categoryScorePairs) {
      const limit = Math.round((score / totalScore) * postsNumber);

      const query = {
        topic: category,
        deletedFlag: false,
        _id: { $nin: existingPostIds },
      };

      const rawPosts = await Post.find(query)
        .populate({
          path: "publisher",
          select: "userName profileImage blockedUsers",
        })
        .sort({ createdAt: -1 })
        .limit(limit * 2); // Overfetch to account for filtering

      const filtered = rawPosts.filter((post) => {
        const author = post.publisher;

        const theyBlockedMe = author?.blockedUsers?.some(
          (b) => b.blockedUserId.toString() === user._id.toString()
        );

        const iBlockedThem = user?.blockedUsers?.some(
          (b) => b.blockedUserId.toString() === author?._id.toString()
        );

        const alreadyIncluded = posts.has(post._id.toString());

        const isReel = post.videos?.length === 1;

        if (reelFlag && !isReel) {
          return false; // Skip if we want reels only and this post is not a reel
        }

        return !(theyBlockedMe || iBlockedThem || alreadyIncluded);
      });

      const finalPosts = filtered.slice(0, limit);
      finalPosts.forEach((post) => posts.set(post._id.toString(), post));

      categoryStats[category] = {
        count: finalPosts.length,
        percentage: ((score / totalScore) * 100).toFixed(2) + "%",
      };
    }

    const sortedPosts = [...posts.values()].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    return res.status(200).json({
      success: true,
      posts: sortedPosts.slice(0, postsNumber),
      categoryStats,
    });

  } catch (error) {
    handleError(error, res);
  }
}


  static async getFile(req, res) {
    try {
      const { postId, filesName } = req.query;

      if (!filesName) throwError("No file name was sent", 400);

      const post = await Post.findById(postId).populate([
        { path: "publisher", select: "blockedUsers" },
      ]);

      if (!post) throwError("Post not found", 404);

      const isBlockedByPublisher = post.publisher.blockedUsers?.some(
        (blockedUser) =>
          blockedUser.blockedUserId.toString() === user._id.toString()
      );

      if (isBlockedByPublisher) throwError("You are blocked by this user", 403);

      const iBlockedPublisher = userMiddleware.hasUser1blockedUser2(
        user,
        post.publisher._id
      );

      if (iBlockedPublisher) throwError("You have blocked this user", 403);

      const filePath = path.join(
        __dirname,
        "..",
        "uploads",
        "posts",
        postId,
        filesName
      );

      if (!fs.existsSync(filePath)) throwError("No file was found", 404);

      return res.sendFile(filePath);
    } catch (error) {
      handleError(error, res);
    }
  }

  static async getPost(req, res) {
    try {
      const { userId } = await authentication.validateToken(req);
      const user = await userMiddleware.findUserById(userId);

      const { postId } = req.query;
      const post = await postMiddleware.findPostById(postId);

      await post.populate([
        {
          path: "publisher",
          select: "userName profileImage blockedUsers", // include for filtering
        },
        {
          path: "firstLayerComments",
          select: "content repliedBy repliedTo likedBy createdAt user",
          populate: {
            path: "user",
            select: "userName profileImage blockedUsers", // include for filtering
          },
        },
      ]);

      // Filter firstLayerComments
      post.firstLayerComments = post.firstLayerComments.filter((comment) => {
        const commentUser = comment.user;
        const postOwner = post.publisher;

        const theyBlockedMe = commentUser?.blockedUsers?.some(
          (b) => b.blockedUserId.toString() === user._id.toString()
        );

        const iBlockedThem = user?.blockedUsers?.some(
          (b) => b.blockedUserId.toString() === commentUser?._id.toString()
        );

        const postOwnerBlockedCommenter = postOwner?.blockedUsers?.some(
          (b) => b.blockedUserId.toString() === commentUser?._id.toString()
        );

        return !(theyBlockedMe || iBlockedThem || postOwnerBlockedCommenter);
      });

      // 🧹 Remove blockedUsers before sending
      if (post.publisher?.blockedUsers) {
        delete post.publisher.blockedUsers;
      }

      post.firstLayerComments.forEach((comment) => {
        if (comment.user?.blockedUsers) {
          delete comment.user.blockedUsers;
        }
      });

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

      if (userMiddleware.hasUser1blockedUser2(user, post.publisher))
        throwError("you have blocked this user", 403);
      const postPublisher = await User.findById(post.publisher).select(
        "blockedUsers"
      );
      if (
        postPublisher.blockedUsers.some(
          (blockedUser) =>
            blockedUser.blockedUserId.toString() == user.id.toString()
        )
      )
        throwError("you have been blocked by this user", 403);
      // if (post.deletedFlag) throwError("this post was deleted", 401);
      if (!post.likes.includes(user.id)) post.likes.push(user.id);
      else {
        post.likes = post.likes.filter((likerId) => likerId != user.id);
      }
      console.log(post.likes);

      await post.save();
      if (user.id != post.publisher._id.toString())
        sendNotification({io:req.app.get('io'),
          type: "like_post",
          actorUser: user,
          targetUserId: post.publisher._id,
          entity: { postId: post._id },
        });
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

      // Determine if the post is a reel (single video)
      const files = req.files?.map((file) => file.filename) || [];
      const isReel =
        (files.length === 1 && files[0].match(/\.(mp4|mov|avi|mkv)$/i)) ||
        false;

      const post = await Post.create({
        reelFlag: isReel, // Set to true only if single video file
        topic,
        description,
        files: files,
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
