// models/VideoProgress.js
const mongoose = require('mongoose');

const videoProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'courses',
    required: true
  },
  lessonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'lessons',
    required: true
  },
  currentTime: {
    type: Number,
    default: 0,
    min: 0
  },
  duration: {
    type: Number,
    required: true,
    min: 0
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  completed: {
    type: Boolean,
    default: false
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create a compound index for efficient querying
videoProgressSchema.index({ userId: 1, courseId: 1, lessonId: 1 }, { unique: true });

const VideoProgress = mongoose.model('VideoProgress', videoProgressSchema);

module.exports = VideoProgress;