const express = require("express");
const authentication = require("../middleware/authentication");
const userMiddleware = require("../middleware/userMiddleware");
const { handleError, throwError } = require("../errorHandler");
const Chat = require("../models/chatSchema");
const io=require('../index')
const {isUserOnline}=require('../notificationUtils')
const { errorMonitor } = require("form-data");
const router = express.Router();
router.get("", async (req, res) => {
  try {
    const { userId } = await authentication.validateToken(req);
    const [user1, user2] = await Promise.all([
      userMiddleware.findUserById(userId),
      userMiddleware.findUserById(req.query.targetUserId),
    ]);
    const chat = await Chat.findOne({
      users: { $all: [user1._id, user2._id], $size: 2 },
    });
    if (!chat) throwError("chat was not found", 404);
    return res.json({ success: true, chat });
  } catch (error) {
    handleError(error, res);
  }
});
router.get("/getAllChats", async (req, res) => {
  try {
    const { userId } = await authentication.validateToken(req);
    const user = await
      userMiddleware.findUserById(userId)
    const chats = await Chat.find({ users: userId })

    const sortedChats = chats.sort((a, b) => {
      const lastA = a.messages.length > 0
        ? a.messages[a.messages.length - 1].createdAt
        : new Date(0); // fallback for empty chats

      const lastB = b.messages.length > 0
        ? b.messages[b.messages.length - 1].createdAt
        : new Date(0);

      return lastB - lastA; // Descending order (latest first)
    });

    res.json({ success: true, chats: sortedChats });

  } catch (error) {
    handleError(error, res);
  }
});
router.get("/user-online", async (req, res) => {
  try {
    const { targetUserId } = req.query;
    if (!targetUserId) throwError("no user id was sent", 400);
    const { userId } = await authentication.validateToken(req);
    const [user, targetUser] = await Promise.all([
      userMiddleware.findUserById(userId),
      userMiddleware.findUserById(targetUserId),
    ]);
    const status = await isUserOnline(targetUserId);
    if (status) return res.json({ success: true, onlineFlag: true });
    return res.json({
      success: true,
      onlineFlag: false,
      lastSeenAt: targetUser.lastSeenAt,
    });
  } catch (error) {
    handleError(error, res);
  }
});
module.exports = router;
