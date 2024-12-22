const mongoose = require('mongoose');

const CertificateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Matching your User model reference
      required: true,
    },
    tutorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tutor', // Matching your Tutor model reference
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'courses', // Matching your Course model reference
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    tutorName: {
      type: String,
      required: true,
    },
    courseName: {
      type: String,
      required: true,
    },
    quizScorePercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    issuedDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['active', 'revoked'],
      default: 'active'
    }
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
  }
);

// Add a compound index to prevent duplicate certificates
CertificateSchema.index({ userId: 1, courseId: 1 }, { unique: true });

const Certificate = mongoose.model('Certificate', CertificateSchema);
module.exports = Certificate;