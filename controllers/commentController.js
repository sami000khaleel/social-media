const mongoose = require("mongoose");
const Post = require("../models/postSchema");
const User = require("../models/userSchema");
const Comment = require("../models/commentSchema");
const commentMiddleware = require("../middleware/commentMiddleware");
const postMiddleware = require("../middleware/postMiddleware");
const authentication = require("../middleware/authentication");
const userMiddleware = require("../middleware/userMiddleware");
const { throwError, handleError } = require("../errorHandler");
class commentController {
  constructor() {}
  static async deleteComment(req, res) {
    try {
      if (!req.query?.commentId) throwError("no comment id was found", 400);
      let comment = await Comment.findById(commentId);
      if (!comment?.id) throwError("no comment was found", 404);
      comment.deletedFlag = true;
      await comment.save();
      return res.json({ success: true });
    } catch (error) {
      [74];
      handleError(error, res);
    }
  }
  static async getReplies(req, res) {
    try {
      const { userId } = await authentication.validateToken(req);
      const user = await userMiddleware.findUserById(userId);

      const commentsIdsString = req.query.commentsIds;
      const commentsIds =
        commentMiddleware.validateCommentsIds(commentsIdsString);

      const comments = await Comment.find({
        _id: { $in: commentsIds },
        deletedFlag: false,
      });

      if (commentsIds.length !== comments.length) {
        throwError("Some comments are missing", 404);
      }

      let repliedByIds = comments.flatMap((comment) => comment.repliedBy);

      let replies = await Comment.find({ _id: { $in: repliedByIds } })
        .select("content createdAt repliedBy repliedTo postId user")
        .populate([
          { path: "user", select: "userName profileImage blockedUsers" },
          {
            path: "postId",
            select: "publisher",
            populate: { path: "publisher", select: "blockedUsers" },
          },
        ]);

      replies = replies.filter((reply) => {
        const replyUser = reply.user;
        const postOwner = reply.postId?.publisher;

        const theyBlockedMe = replyUser?.blockedUsers?.some(
          (b) => b.blockedUserId.toString() === user.id.toString()
        );

        const iBlockedThem = user?.blockedUsers?.some(
          (b) => b.blockedUserId.toString() === replyUser?._id.toString()
        );

        const postOwnerBlockedCommenter = postOwner?.blockedUsers?.some(
          (b) => b.blockedUserId.toString() === replyUser?._id.toString()
        );

        return !(theyBlockedMe || iBlockedThem || postOwnerBlockedCommenter);
      });

      // 🧹 Remove blockedUsers before sending
      replies.forEach((reply) => {
        if (reply.user?.blockedUsers) {
          delete reply.user.blockedUsers;
        }
        if (reply.postId?.publisher?.blockedUsers) {
          delete reply.postId.publisher.blockedUsers;
        }
      });

      return res.json({ success: true, replies });
    } catch (error) {
      handleError(error, res);
    }
  }

  static async createComment(req, res) {
    try {
      const { postId, content, repliedTo } = req.body;

      // Validation should come first
      if (!content) throwError("You have to comment something", 400); // Changed to 400 (bad request)

      const { userId } = await authentication.validateToken(req);

      // Parallelize these operations since they don't depend on each other
      const [post, user] = await Promise.all([
        postMiddleware.findPostById(postId),
        userMiddleware.findUserById(userId),
      ]);

      if (!post) throwError("Post not found", 404);
      if (!user) throwError("User not found", 404);
      if (userMiddleware.hasUser1blockedUser2(user, post.publisher))
        throwError("this user has blocked you", 403);
      const comment = await Comment.create({
        user: user._id, // Use _id instead of id for consistency
        content,
        postId,
        repliedTo: repliedTo || null,
      });

      // Update post's firstLayerComments only if it's not a reply
      if (!repliedTo) {
        post.firstLayerComments.push(comment._id);
        await post.save();
      }

      // Handle reply logic
      if (repliedTo) {
        const repliedComment = await commentMiddleware.findCommentById(
          repliedTo
        );
        repliedComment.repliedBy.push(comment._id);
        await repliedComment.save();
      }

      return res.status(201).json({ success: true, comment }); // 201 for resource creation
    } catch (error) {
      handleError(error, res);
    }
  }
}
module.exports = commentController;
