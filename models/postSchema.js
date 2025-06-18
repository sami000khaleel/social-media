const mongoose = require("mongoose");
// const User
const postSchema = new mongoose.Schema(
  {
    deletedFlag:{
      type:Boolean,
      default:false,
      required:true
    },
    reelFlag: { type: Boolean, required: true, default: false },
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
    description: {
      type: String,
    },

    files: [
      {
        type: String,
        _id: false,
      },
    ],
    likes: [{ type: mongoose.SchemaTypes.ObjectId, ref: "User" }],
    firstLayerComments: [{ type: mongoose.SchemaTypes.ObjectId, ref: "Comment" }],
    // createdAt: {
    //   type: Date,
    //   required: true,
    //   default: Date.now(),
    // },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Post", postSchema);
