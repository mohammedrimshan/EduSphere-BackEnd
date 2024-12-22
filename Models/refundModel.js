// models/RefundModel.js
const mongoose = require("mongoose");

const refundSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true // Add index for frequent user queries
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "courses", // Matches the collection name used in populate
    required: true
  },
  purchaseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Purchase",
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
    index: true // Add index for status filtering
  },
  adminNote: {
    type: String,
    default: null
  },
  processedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true // Enables createdAt field used in queries
});

// Index for sorting by createdAt
refundSchema.index({ createdAt: -1 });

const walletTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ["credit", "debit"],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "completed" // Default to completed as per controller usage
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: "referenceModel",
    required: true
  },
  referenceModel: {
    type: String,
    enum: ["Purchase", "Refund"],
    required: true
  }
}, {
  timestamps: true
});

const Refund = mongoose.model("Refund", refundSchema);
const WalletTransaction = mongoose.model("WalletTransaction", walletTransactionSchema);

module.exports = { Refund, WalletTransaction };