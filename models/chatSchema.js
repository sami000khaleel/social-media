const mongoose = require("mongoose");
const chatSchema = new mongoose.Schema({
  users: [{ type: mongoose.Types.ObjectId, ref: "User" }],
  messages: [
    {
      type: String,
      createdAt: { type: Date, default: Date.now() },
      owner: { type: mongoose.Types.ObjectId, ref: "User", required: true },
    },
  ],

},{timestamps:true});

module.exports = mongoose.model("Chat", chatSchema);