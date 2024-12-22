const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [
      {
        courseId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "courses",
          required: true,
        },
        isReported: {
          type: Boolean,
          default: false,
        },
      },
    ],
    purchaseDate: {
      type: Date,
      default: Date.now,
    },
    // Razorpay Integration
    razorpay: {
      orderId: {
        type: String, // Razorpay Order ID
        required: true,
      },
      paymentId: {
        type: String, // Razorpay Payment ID
      },
      signature: {
        type: String, // Razorpay Signature
      },
      amount: {
        type: Number, // Total Payment Amount
        required: true,
      },
      currency: {
        type: String, // Payment Currency (e.g., INR, USD)
        default: "INR",
      },
      status: {
        type: String, // Payment Status (e.g., success, failed)
        enum: ["created", "success", "failed", "pending"],
        default: "created",
      },
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  }
);

const Purchase = mongoose.model("Purchase", purchaseSchema);

module.exports = Purchase;
