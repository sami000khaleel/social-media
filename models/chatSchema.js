// const mongoose = require("mongoose");
// const chatSchema = new mongoose.Schema({
//   users: [{ type: mongoose.Types.ObjectId, ref: "User" }],
//   messages: [
//     {
//       type: String,
//       createdAt: { type: Date, default: Date.now() },
//       owner: { type: mongoose.Types.ObjectId, ref: "User", required: true },
//     },
//   ],

// },{timestamps:true});

// module.exports = mongoose.model("Chat", chatSchema);
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    owner: { type: mongoose.Types.ObjectId, ref: "User", required: true },
  },
  { _id: false }
);

const chatSchema = new mongoose.Schema(
  {
    users: [{ type: mongoose.Types.ObjectId, ref: "User" }],
    messages: [messageSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Chat", chatSchema);
