const mongoose = require("mongoose");
const commentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.SchemaTypes.ObjectId, ref: "User" },
    content: {
      type: String,
      reqiured: true,
    },
    deletedFlag: { type: Boolean, required: true, default: false },
    postId: { type: mongoose.SchemaTypes.ObjectId, ref: "Post" },
    repliedBy: [{ type: mongoose.SchemaTypes.ObjectId, ref: "Comment" }],
    repliedTo: { type: mongoose.SchemaTypes.ObjectId, ref: "Comment" },
    likedBy: [{ type: mongoose.SchemaTypes.ObjectId, ref: "User" }],
    // createdAt: {
    //   default: Date.now,
    //   type: Date,
    // },
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model("Comment", commentSchema);
