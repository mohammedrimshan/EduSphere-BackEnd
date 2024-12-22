const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to the User model
      required: true,
    },
    items: [
      {
        courseId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "courses", // Reference to the Course model
          required: true,
        },
        price: {
          type: Number,
          required: true,
          min: 0,
        },
        offerPrice: {
          type: Number,
          default: function () {
            return this.price * (1 - (this.offer_percentage || 0) / 100);
          }, // Calculate offer price if any
        },
        offer_percentage: {
          type: Number,
          default: 0,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    totalCartPrice: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true, // Automatically track createdAt and updatedAt fields
  }
);

// Pre-save hook to calculate total cart price
cartSchema.pre("save", function (next) {
  this.totalCartPrice = this.items.reduce(
    (total, item) => total + (item.offerPrice || item.price),
    0
  );
  next();
});

// Method to add an item to the cart
cartSchema.methods.addItem = async function (courseId, price, offer_percentage = 0) {
  // Check if the course is already in the cart
  const existingItem = this.items.find(item => item.courseId.toString() === courseId.toString());

  if (existingItem) {
    throw new Error("Course is already in your cart.");
  }

  // Add the new course to the cart
  this.items.push({
    courseId,
    price,
    offer_percentage,
    offerPrice: price * (1 - offer_percentage / 100),
  });

  // Recalculate the total price
  this.totalCartPrice = this.items.reduce(
    (total, item) => total + (item.offerPrice || item.price),
    0
  );

  await this.save();
};

// Method to remove an item from the cart
cartSchema.methods.removeItem = async function (courseId) {
  this.items = this.items.filter(item => item.courseId.toString() !== courseId.toString());

  // Recalculate the total price
  this.totalCartPrice = this.items.reduce(
    (total, item) => total + (item.offerPrice || item.price),
    0
  );

  await this.save();
};

// Method to clear the cart
cartSchema.methods.clearCart = async function () {
  this.items = [];
  this.totalCartPrice = 0;
  await this.save();
};

const Cart = mongoose.model("Cart", cartSchema);

module.exports = Cart;
