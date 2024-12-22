const { Review, Course } = require("../Models/CourseModel");
const User = require("../Models/UserModel");
const Tutor = require("../Models/TutorModel");
const Certificate = require("../Models/CertificateModel");

//Create a new course review
const createReview = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { rating, review } = req.body;
    const userId = req.user._id;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const certificate = await Certificate.findOne({
      userId: userId,
      courseId: courseId,
      status: "active",
    });

    if (!certificate) {
      return res.status(403).json({
        message:
          "You must complete the course and receive a certificate before reviewing",
      });
    }

    const existingReview = await Review.findOne({
      user: userId,
      course: courseId,
      status: "active",
    });

    if (existingReview) {
      return res.status(403).json({
        message: "You have already submitted a review for this course",
      });
    }

    const newReview = new Review({
      user: userId,
      course: courseId,
      rating,
      review,
      verifiedPurchase: true,
    });

    await newReview.save();

    course.reviews.push(newReview._id);
    await course.calculateRatingBreakdown();
    await course.updateAverageRating();
    await User.findByIdAndUpdate(userId, {
      $push: { reviews: newReview._id },
    });

    res.status(201).json({
      message: "Review created successfully",
      review: newReview,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get reviews for a specific course
const getCourseReviews = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { sort, rating, verified, page = 1, limit = 10 } = req.query;

    const reviews = await Course.getReviews(courseId, {
      sort,
      rating,
      verified: verified === "true",
      page: parseInt(page),
      limit: parseInt(limit),
    });

    const course = await Course.findById(courseId).select(
      "average_rating rating_breakdown total_reviews"
    );

    res.json({
      reviews,
      course_stats: {
        average_rating: course.average_rating,
        rating_breakdown: course.rating_breakdown,
        total_reviews: course.total_reviews,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all reviews

const getTutorReviews = async (req, res) => {
  try {
    const tutorId = req.user._id;
    const {
      sort = "newest",
      status = "active",
      page = 1,
      limit = 10,
    } = req.query;

    const tutor = await Tutor.findById(tutorId).populate("courses");
    const courseIds = tutor.courses.map((course) => course._id);

    const query = {
      course: { $in: courseIds },
      status,
    };

    let sortOption = {};
    switch (sort) {
      case "newest":
        sortOption = { createdAt: -1 };
        break;
      case "oldest":
        sortOption = { createdAt: 1 };
        break;
      case "rating-high":
        sortOption = { rating: -1 };
        break;
      case "rating-low":
        sortOption = { rating: 1 };
        break;
    }

    const reviews = await Review.find(query)
      .populate("user", "full_name profileImage")
      .populate("course", "title")
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Review.countDocuments(query);

    res.json({
      reviews,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        current: page,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get review statistics

const getTutorReviewStats = async (req, res) => {
  try {
    const tutorId = req.user._id;

    const courses = await Course.find({ tutor: tutorId });
    const courseIds = courses.map((course) => course._id);

    const stats = await Review.aggregate([
      {
        $match: {
          course: { $in: courseIds },
          status: "active",
        },
      },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: "$rating" },
          ratingCounts: { $push: "$rating" },
        },
      },
    ]);

    if (stats.length === 0) {
      return res.json({
        totalReviews: 0,
        averageRating: 0,
        ratingBreakdown: {
          five_star: 0,
          four_star: 0,
          three_star: 0,
          two_star: 0,
          one_star: 0,
        },
      });
    }

    const ratingBreakdown = {
      five_star: stats[0].ratingCounts.filter((r) => r === 5).length,
      four_star: stats[0].ratingCounts.filter((r) => r === 4).length,
      three_star: stats[0].ratingCounts.filter((r) => r === 3).length,
      two_star: stats[0].ratingCounts.filter((r) => r === 2).length,
      one_star: stats[0].ratingCounts.filter((r) => r === 1).length,
    };

    res.json({
      totalReviews: stats[0].totalReviews,
      averageRating: Math.round(stats[0].averageRating * 10) / 10,
      ratingBreakdown,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get reviews written by a specific user
const getUserReviews = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;

    const reviews = await Review.find({ user: userId })
      .populate("course", "title course_thumbnail")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Review.countDocuments({ user: userId });

    res.json({
      reviews,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        current: page,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//Get review statistics for a user
const getUserReviewStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const stats = await Review.aggregate([
      {
        $match: {
          user: userId,
          status: "active",
        },
      },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: "$rating" },
          helpfulVotesReceived: {
            $sum: { $size: "$helpful_votes" },
          },
        },
      },
    ]);

    const user = await User.findById(userId);
    const helpfulVotesGiven = user.helpful_votes_given.length;

    res.json({
      totalReviews: stats.length ? stats[0].totalReviews : 0,
      averageRating: stats.length
        ? Math.round(stats[0].averageRating * 10) / 10
        : 0,
      helpfulVotesReceived: stats.length ? stats[0].helpfulVotesReceived : 0,
      helpfulVotesGiven,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//Edit an existing review
const editReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, review } = req.body;
    const userId = req.user._id;

    const existingReview = await Review.findOne({
      _id: reviewId,
      user: userId,
      status: "active",
    });

    if (!existingReview) {
      return res
        .status(404)
        .json({ message: "Review not found or cannot be edited" });
    }

    existingReview.rating = rating;
    existingReview.review = review;
    await existingReview.save();

    const course = await Course.findById(existingReview.course);
    await course.calculateRatingBreakdown();
    await course.updateAverageRating();

    res.json({
      message: "Review updated successfully",
      review: existingReview,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//Deletea review
const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user._id;

    const review = await Review.findOne({
      _id: reviewId,
      user: userId,
    });

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }
    await Course.findByIdAndUpdate(review.course, {
      $pull: { reviews: reviewId },
    });

    await User.findByIdAndUpdate(userId, {
      $pull: { reviews: reviewId },
    });

    await review.deleteOne();

    const course = await Course.findById(review.course);
    if (course) {
      await course.calculateRatingBreakdown();
      await course.updateAverageRating();
    }

    res.json({ message: "Review deleted successfully" });
  } catch (error) {
    console.error("Error deleting review:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Toggle helpful vote on a review
 * Users can vote once per review
 */
const toggleHelpfulVote = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user._id;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    const voteIndex = review.helpful_votes.findIndex(
      (vote) => vote.user.toString() === userId.toString()
    );

    if (voteIndex === -1) {
      review.helpful_votes.push({ user: userId });
      await User.findByIdAndUpdate(userId, {
        $push: {
          helpful_votes_given: {
            review: reviewId,
            timestamp: new Date(),
          },
        },
      });
    } else {
      review.helpful_votes.splice(voteIndex, 1);
      await User.findByIdAndUpdate(userId, {
        $pull: {
          helpful_votes_given: { review: reviewId },
        },
      });
    }

    await review.save();
    res.json({
      helpful_votes: review.helpful_votes.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Add tutor response to a review
 * Only the course tutor can respond
 */
const addTutorResponse = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { content } = req.body;
    const tutorId = req.user._id;

    const review = await Review.findById(reviewId).populate("course");
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (review.course.tutor.toString() !== tutorId.toString()) {
      return res
        .status(403)
        .json({ message: "Unauthorized to respond to this review" });
    }

    review.tutorResponse = { content };
    await review.save();

    res.json({
      message: "Response added successfully",
      review,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createReview,
  getCourseReviews,
  getTutorReviews,
  getTutorReviewStats,
  getUserReviews,
  getUserReviewStats,
  editReview,
  deleteReview,
  toggleHelpfulVote,
  addTutorResponse,
};
