const Wishlist = require("../Models/WishlistModel");
const { Course } = require("../Models/CourseModel");

const addToWishlist = async (req, res) => {
  try {
    const { courseId } = req.body;
    const userId = req.user._id;
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    let wishlist = await Wishlist.findOne({ user: userId });

    if (!wishlist) {
      wishlist = new Wishlist({
        user: userId,
        courses: [courseId],
      });
    } else {
      if (wishlist.courses.includes(courseId)) {
        return res.status(400).json({ message: "Course already in wishlist" });
      }

      wishlist.courses.push(courseId);
    }

    await wishlist.save();

    res.status(201).json({
      message: "Course added to wishlist",
      wishlist,
    });
  } catch (error) {
    console.error("Add to Wishlist Error:", error);
    res.status(500).json({
      message: "Server error adding to wishlist",
      error: error.message,
    });
  }
};

const removeFromWishlist = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user._id;

    const wishlist = await Wishlist.findOneAndUpdate(
      { user: userId },
      { $pull: { courses: courseId } },
      { new: true }
    );

    if (!wishlist) {
      return res.status(404).json({ message: "Wishlist not found" });
    }

    res.status(200).json({
      message: "Course removed from wishlist",
      wishlist,
    });
  } catch (error) {
    console.error("Remove from Wishlist Error:", error);
    res.status(500).json({
      message: "Server error removing from wishlist",
      error: error.message,
    });
  }
};

const getWishlist = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const wishlist = await Wishlist.findOne({ user: userId }).populate({
      path: "courses",
      select:
        "title course_thumbnail price average_rating lessons total_reviews offer_percentage duration level category tutor",
      populate: [
        {
          path: "category",
          select: "title",
        },
        {
          path: "tutor",
          select: "full_name",
        },
      ],
      options: {
        skip,
        limit,
      },
    });

    if (!wishlist) {
      return res.status(200).json({
        message: "Wishlist is empty",
        wishlist: [],
        total: 0,
      });
    }

    const total = wishlist.courses.length;

    const formattedWishlist = wishlist.courses.map((course) => {
      const offerPrice =
        course.price - course.price * (course.offer_percentage / 100);

      return {
        id: course._id,
        title: course.title,
        thumbnail: course.course_thumbnail,
        originalPrice: course.price,
        duration: course.duration,
        level: course.level,
        lesson: course.lessons.length,
        offerPercentage: course.offer_percentage,
        offerPrice: offerPrice.toFixed(2),
        rating: course.average_rating,
        totalReviews: course.total_reviews,
        category: course.category?.title || "Uncategorized",
        tutor: course.tutor?.full_name || "Unknown",
      };
    });

    res.status(200).json({
      wishlist: formattedWishlist,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Get Wishlist Error:", error);
    res.status(500).json({
      message: "Server error fetching wishlist",
      error: error.message,
    });
  }
};

const checkWishlistStatus = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user._id;

    const wishlist = await Wishlist.findOne({
      user: userId,
      courses: courseId,
    });

    res.status(200).json({
      isInWishlist: !!wishlist,
    });
  } catch (error) {
    console.error("Check Wishlist Status Error:", error);
    res.status(500).json({
      message: "Server error checking wishlist status",
      error: error.message,
    });
  }
};

module.exports = {
  addToWishlist,
  removeFromWishlist,
  getWishlist,
  checkWishlistStatus,
};
