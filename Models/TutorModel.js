const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  body: {
    type: String,
    required: true
  },
  read: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const tutorSchema = new mongoose.Schema(
  {
    full_name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      required: function() { return !this.googleId; },
      sparse: true
    },
    password: {
      type: String,
      required: function() { return !this.googleId; },
    },
    googleId: {
      type: String,
      default: null,
    },
    profile_image: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      default: "",
    },
    subject: {
      type: String,
      required: null,
    },
    status: {
      type: Boolean,
      default: true,
    },
    tutor_id: {
      type: String,
      required: true,
      unique: true
    },
    fcmToken: {
      type: String,
      default: null
    },
    courses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "courses"
      }
    ],
    is_verified: {
      type: Boolean,
      default: false,
    },
    lastActive: { type: Date },
    lastLogin: { type: Date },
    notifications: [notificationSchema]  // Added notifications array
  },
  { timestamps: true }
);

tutorSchema.index({ email: 1 });
tutorSchema.index({ googleId: 1 });

module.exports = mongoose.model("Tutor", tutorSchema);