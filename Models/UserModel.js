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

const userSchema = new mongoose.Schema(
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
    user_id: {
      type: String,
      required: true,
      unique: true
    },
    googleId: {
      type: String,
      default: null,
    },
    profileImage: {
      type: String,
      default: null,
    },
    image: {
      type: String,
      default: null
    },
    fcmToken: {
      type: String,
      default: null
    },
    status: {
      type: Boolean,
      default: true
    },
    courses: [
      {
        course: { type: mongoose.Schema.Types.ObjectId, ref: "courses" },
        enrollmentDate: { type: Date, default: Date.now },
        progress: { type: Number, default: 0 },
        completionStatus: { type: Boolean, default: false }
      }
    ],
    wallet: {
      type: Number,
      default: 0,
      min: [0, "Wallet balance cannot be negative"]
    },
    refreshToken: {
      type: String,
      default: null
    },
    is_verified: {
      type: Boolean,
      default: false
    },
    lastActive: { type: Date },
    lastLogin: { type: Date },
    notifications: [notificationSchema]
  },
  { timestamps: true }
);

userSchema.index({ email: 1 });
userSchema.index({ user_id: 1 });
userSchema.index({ googleId: 1 });

module.exports = mongoose.model("User", userSchema);

