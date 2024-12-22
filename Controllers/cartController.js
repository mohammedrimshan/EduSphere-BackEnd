const mongoose = require("mongoose");
const { Course } = require("../Models/CourseModel");
const Category = require("../Models/CategoryModel");
const Tutor = require("../Models/TutorModel");
const Lesson = require("../Models/LessonModel");
const Cart = require("../Models/CartModel");

//Add to Cart function
const addToCart = async (req, res) => {
  const { userId } = req.params;
  const { courseId, price, offer_percentage } = req.body;

  try {
    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    await cart.addItem(courseId, price, offer_percentage);

    res
      .status(200)
      .json({ success: true, message: "Course added to cart", cart });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

//Remove from Cart function
const removeFromCart = async (req, res) => {
  const { userId } = req.params;
  const { courseId } = req.body;

  try {
    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }

    await cart.removeItem(courseId);

    res
      .status(200)
      .json({ success: true, message: "Course removed from cart", cart });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

//Clear full  Cart function
const clearUserCart = async (req, res) => {
  const { userId } = req.params;

  try {
    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }

    await cart.clearCart();

    res.status(200).json({
      success: true,
      message: "Cart cleared",
      cart: { items: [], totalCartPrice: 0 },
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

//Get user Cart
const getUserCart = async (req, res) => {
  const { userId } = req.params;

  try {
    const cart = await Cart.findOne({ userId }).populate({
      path: "items.courseId",
      select: "title price course_thumbnail level duration tutor lessons",
      populate: {
        path: "tutor",
        select: "full_name",
      },
    });

    if (!cart || cart.items.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Cart is empty",
        cart: { items: [], totalCartPrice: 0 },
      });
    }

    res.status(200).json({ success: true, cart });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

//Cartcount
const cartCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(200).json({ count: 0 });
    }

    const cartItemCount = cart.items.length;

    res.status(200).json({ count: cartItemCount });
  } catch (error) {
    console.error("Error fetching cart count:", error);
    res.status(500).json({ message: "Failed to fetch cart count." });
  }
};

module.exports = {
  addToCart,
  removeFromCart,
  clearUserCart,
  getUserCart,
  cartCount,
};
