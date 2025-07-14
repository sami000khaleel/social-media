// utils/onlineUsers.js
const onlineUsers = new Map(); // userId → socketId

module.exports = {
  setOnline(userId, socketId) {
    onlineUsers.set(userId.toString(), socketId);
  },
  removeOnline(userId) {
    onlineUsers.delete(userId.toString());
  },
  getSocketId(userId) {
    return onlineUsers.get(userId.toString());
  },
  isOnline(userId) {
    return onlineUsers.has(userId.toString());
  },
  getAll() {
    return onlineUsers;
  },
};
