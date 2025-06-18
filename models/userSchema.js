const mongoose = require("mongoose");
// add the user name for all the code around
const userSchema = new mongoose.Schema(
  {
    userName: { type: String, required: true },
    describtion: { type: String },
    followers: [
      {
        type: mongoose.SchemaTypes.ObjectId,
        ref: "User",
      },
    ],
    following: [
      {
        type: mongoose.SchemaTypes.ObjectId,
        ref: "User",
      },
    ],
    certifiedDoctor: { type: Boolean, required: true },
    firstName: {
      type: String,
      required: true,
    },
    posts: [{ type: mongoose.SchemaTypes.ObjectId, ref: "Post" }],
    lastName: {
      type: String,
      required: true,
    },
    birthDate: {
      type: Date,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    location: {
      country: {  type: String },
      city: {  type: String },
    },
    profileImage: {
      type: String,
    },
    about: { type: String },
    preferredTopics: [
      {
        required: true,
        type: String,
        enum: [
          "Anxiety & Stress Management",
          "Depression & Mood Disorders",
          "Relationships & Interpersonal Issues",
          "Self-Esteem & Identity",
          "Trauma & PTSD",
          "Growth, Healing & Motivation",
        ],
      },
    ],
    verificationCodes: [
      {
        code: String,
        createdAt: {
          requried: true,
          type: Date,
          default: Date.now(),
        },
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
    files: [{ type: String, _id: false }],
  },
  {
    timestamps: true, // This automatically adds createdAt and updatedAt fields
  }
);
module.exports = mongoose.model("User", userSchema);
// 1. Anxiety & Stress Management
// Posts about panic attacks, daily stress, social anxiety, overthinking, etc.

// Keywords: nervousness, overwhelmed, pressure, fear, breathing techniques

// 2. Depression & Mood Disorders
// Posts discussing low mood, lack of energy, sadness, hopelessness, etc.

// Keywords: tired, numb, can't get out of bed, feeling empty, suicidal thoughts

// 3. Relationships & Interpersonal Issues
// Covers romantic, family, friendship, and social conflicts or struggles.

// Keywords: breakups, toxic relationships, loneliness, communication, trust

// 4. Self-Esteem & Identity
// Includes topics around self-worth, self-image, confidence, body image, gender identity, etc.

// Keywords: not good enough, imposter syndrome, self-love, identity crisis

// 5. Trauma & PTSD
// Posts related to abuse, loss, childhood trauma, accidents, war, etc.

// Keywords: flashbacks, nightmares, triggers, emotional numbness, dissociation

// 6. Growth, Healing & Motivation
// Positive reflections, recovery stories, coping strategies, life advice.

// Keywords: healing, progress, resilience, small wins, inspiration
