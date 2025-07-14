const jwt = require("jsonwebtoken");
const User = require("./models/userSchema");
const Post = require("./models/postSchema");
const Comment = require("./models/commentSchema");
const Chat = require("./models/chatSchema");
const { Types } = require("mongoose");
const onlineUsers = require("./onlineUsers");

module.exports = function socketHandler(io) {
  // Helper to build notification objects
  const buildNotification = (type, actorUser, extraText = "", entity = {}) => {
    const name = actorUser.userName;
    const texts = {
      follow: `${name} started following you`,
      like_post: `${name} liked your post`,
      like_comment: `${name} liked your comment`,
      comment_post: `${name} commented on your post`,
      reply_comment: `${name} replied to your comment`,
    };

    return {
      actorId: actorUser._id,
      userName: actorUser.userName,
      profileImage: actorUser.profileImage,
      text: texts[type] + extraText,
      date: new Date(),
      ...entity,
    };
  };

  io.on("connection", (socket) => {
    console.log("connection");

    socket.on("connected", async ({ token }) => {
      try {
        const { userId } = jwt.verify(
          token.split(" ")[1],
          process.env.JWT_SECRET
        );

        socket.userId = userId;

        onlineUsers.setOnline(userId, socket.id);
        console.log(onlineUsers.getAll());


        const user = await User.findById(userId)
          .select("lastSeenAt followers")
          .populate("followers.user", "_id")
          .lean();

        const prevSeen = user.lastSeenAt || new Date(0);
        await User.updateOne({ _id: userId }, { lastSeenAt: new Date() });

        user.followers?.forEach((f) => {
          const followerSocketId = onlineUsers.getSocketId(f.user._id);
          if (followerSocketId) {
            io.to(followerSocketId).emit("user_online", { userId });
          }
        });

        // Initial Notifications Logic
        const notifications = [];

        // 1. New followers
        const newFollowers = user.followers
          .filter((f) => f.date > prevSeen)
          .slice(-3);

        for (const f of newFollowers) {
          const actor = await User.findById(f.user)
            .select("_id userName profileImage")
            .lean();

          notifications.push(buildNotification("follow", actor));
        }

        // 2. Likes on posts
        const likedPosts = await Post.find({
          publisher: userId,
          updatedAt: { $gt: prevSeen },
          likes: { $ne: userId },
        })
          .sort({ updatedAt: -1 })
          .limit(3)
          .populate({
            path: "likes",
            match: { _id: { $ne: userId } },
            select: "_id userName profileImage",
          });

        likedPosts.forEach((p) => {
          if (p.likes.length > 0) {
            notifications.push(
              buildNotification("like_post", p.likes[0], "", { postId: p._id })
            );
          }
        });

        // 3. Likes on comments
        const likedComments = await Comment.find({
          user: { $ne: userId },
          likedBy: userId,
          updatedAt: { $gt: prevSeen },
        })
          .sort({ updatedAt: -1 })
          .limit(3)
          .populate({
            path: "likedBy",
            match: { _id: { $ne: userId } },
            select: "_id userName profileImage",
          });

        likedComments.forEach((c) => {
          if (c.likedBy.length > 0) {
            notifications.push(
              buildNotification("like_comment", c.likedBy[0], "", {
                commentId: c._id,
              })
            );
          }
        });

        // 4. Comments on user's posts
        const commentsOnPosts = await Comment.find({
          createdAt: { $gt: prevSeen },
          repliedTo: null,
        })
          .populate({
            path: "postId",
            match: { publisher: userId },
            select: "_id",
          })
          .populate({ path: "user", select: "_id userName profileImage" })
          .sort({ createdAt: -1 })
          .limit(3);

        commentsOnPosts
          .filter((c) => c.postId)
          .forEach((c) => {
            notifications.push(
              buildNotification("comment_post", c.user, "", {
                postId: c.postId._id,
              })
            );
          });

        // 5. Replies to user's comments
        const replies = await Comment.find({
          repliedTo: { $ne: null },
          createdAt: { $gt: prevSeen },
        })
          .populate({
            path: "repliedTo",
            match: { user: userId },
            select: "_id",
          })
          .populate({ path: "user", select: "_id userName profileImage" })
          .sort({ createdAt: -1 })
          .limit(3);

        replies
          .filter((r) => r.repliedTo)
          .forEach((r) => {
            notifications.push(
              buildNotification("reply_comment", r.user, "", {
                commentId: r._id,
              })
            );
          });

        notifications.sort((a, b) => b.date - a.date);
        socket.emit("initial_notifications", notifications.slice(0, 3));
      } catch (err) {
        console.error("socket auth failed:", err.message);
        socket.emit("error", "authentication_failed");
      }
    });

    socket.on("message", async ({ to, content }) => {
      try {
        if (!socket.userId || !to || !content) return;

        const from = socket.userId;

        let chat = await Chat.findOne({
          users: { $all: [from, to], $size: 2 },
        });

        if (!chat) {
          chat = await Chat.create({ users: [from, to], messages: [] });
        }

        const message = {
          type: content,
          owner: from,
          createdAt: new Date(),
        };

        chat.messages.push(message);
        await chat.save();

        const msgPayload = {
          from,
          to,
          content,
          createdAt: message.createdAt,
        };

        const recipientSocket = onlineUsers.getSocketId(to.toString());
        if (recipientSocket) {
          io.to(recipientSocket).emit("message", msgPayload);
        }

        socket.emit("message", msgPayload);
      } catch (err) {
        console.error("message event failed:", err.message);
      }
    });

    socket.on("disconnect", async () => {
      if (!socket.userId) return;

      const userId = socket.userId.toString();
      onlineUsers.removeOnline(userId);

      io.onlineUsers = onlineUsers;

      await User.findByIdAndUpdate(userId, { lastSeenAt: new Date() });

      const user = await User.findById(userId)
        .select("followers")
        .populate("followers.user", "_id")
        .lean();

      user?.followers?.forEach((f) => {
        const followerSocketId = onlineUsers.getSocketId(f.user._id);
        if (followerSocketId) {
          io.to(followerSocketId).emit("user_offline", {
            userId,
            lastSeenAt: new Date(),
          });
        }
      });
    });
  });
};
