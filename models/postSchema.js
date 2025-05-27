const mongoose = require("mongoose");
// const User
const postSchema = new mongoose.Schema({
  topic: {
    type: String,
    required: true,
    enum: [
      "Anxiety & Stress Management",
      "Depression & Mood Disorders",
      "Relationships & Interpersonal Issues",
      "Self-Esteem & Identity",
      "Trauma & PTSD",
      "Growth, Healing & Motivation",
    ],
  },
  publisher: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: "User",
  },
  describtion: {
    type: String,
  },

  files: [
    {
      fileName: String,
    },
  ],
  likes: [{ type: mongoose.SchemaTypes.ObjectId, ref: "User" }],
  comments: [{ type: mongoose.SchemaTypes.ObjectId, ref: "Comment" }],
  // createdAt: {
  //   type: Date,
  //   required: true,
  //   default: Date.now(),
  // },
},{
  timestamps:true
});

module.exports = mongoose.model("Post", postSchema);
