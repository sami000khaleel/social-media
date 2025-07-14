const mongoose = require("mongoose");
const io=require('../index')
const {sendNotification}=require('../notificationUtils')
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
  static async likeComment(req, res) {
    try {
      const { userId } = await authentication.validateToken(req);
      const user = await userMiddleware.findUserById(userId);

      const { commentId } = req.body;
      if (!commentId) throwError("no comment id was sent", 400);

      const comment = await Comment.findById(commentId).populate({
        path: "user",
        select: "_id userName profileImage blockedUsers",
      });

      if (!comment) throwError("no comment was found", 404);

      if (userMiddleware.hasUser1blockedUser2(user, comment.user))
        throwError("you have blocked this user", 403);

      if (
        comment.user.blockedUsers?.some(
          (b) => b.blockedUserId.toString() === user.id.toString()
        )
      )
        throwError("you have been blocked by this user", 403);

      const alreadyLiked = comment.likedBy.includes(user._id);

      if (!alreadyLiked) {
        comment.likedBy.push(user._id);
      } else {
        comment.likedBy = comment.likedBy.filter(
          (likerId) => likerId.toString() !== user._id.toString()
        );
      }

      await comment.save();

      if (!alreadyLiked && user.id !== comment.user._id.toString()) {
        sendNotification({io:req.app.get('io'),
          type: "like_comment",
          actorUser: user,
          targetUserId: comment.user._id,
          entity: { commentId: comment._id },
        });
      }

      return res.json({
        success: true,
        liked: !alreadyLiked,
      });
    } catch (error) {
      handleError(error, res);
    }
  }

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

      if (!content) throwError("You have to comment something", 400);

      const { userId } = await authentication.validateToken(req);

      const [post, user] = await Promise.all([
        postMiddleware.findPostById(postId),
        userMiddleware.findUserById(userId),
      ]);

      if (!post) throwError("Post not found", 404);
      if (!user) throwError("User not found", 404);

      if (userMiddleware.hasUser1blockedUser2(user, post.publisher)) {
        throwError("This user has blocked you", 403);
      }

      const comment = await Comment.create({
        user: user._id,
        content,
        postId,
        repliedTo: repliedTo || null,
      });

      if (!repliedTo) {
        post.firstLayerComments.push(comment._id);
        await post.save();
      }

      if (repliedTo) {
        const repliedComment = await commentMiddleware.findCommentById(
          repliedTo
        );
        repliedComment.repliedBy.push(comment._id);
        await repliedComment.save();

        // 🔔 Notify replied-to comment owner (only if not same as sender)
                 console.log('sending', 'ss')
                 console.log('a')

        if (
          repliedComment.user.toString() !== user._id.toString() 
        ) {
          const actor = {
            _id: user._id,
            userName: user.userName,
            profileImage: user.profileImage,
          };
          console.log('sending')
          sendNotification({io:req.app.get('io'),
            type: "reply_comment",
            actorUser: actor,
            targetUserId: repliedComment.user,
            entity: { commentId: comment._id },
          });
        }
      }

      // 🔔 Notify post owner (only if not same as sender)
      if (
        post.publisher.toString() !== user._id.toString() 
      ) {
        const actor = {
          _id: user._id,
          userName: user.userName,
          profileImage: user.profileImage,
        };

        sendNotification({io:req.app.get('io'),
          type: "comment_post",
          actorUser: actor,
          targetUserId: post.publisher,
          entity: { postId: post._id },
        });
      }

      return res.status(201).json({ success: true, comment });
    } catch (error) {
      handleError(error, res);
    }
  }
}
module.exports = commentController;
