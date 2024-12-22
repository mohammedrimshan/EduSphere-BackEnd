// ReviewModel.js
const mongoose = require("mongoose");

const ReportSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  // Add the course field
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "courses",
    required: true
  },
  reason: {
    type: String,
    required: true,
    enum: ['inappropriate', 'spam', 'misleading', 'offensive', 'other']
  },
  description: String,
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'resolved', 'dismissed','banned'],
    default: 'pending'
  }
}, {
  timestamps: true
});

const TutorResponseSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

const ReviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "courses",
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  review: {
    type: String,
    required: true
  },
  helpful_votes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  }],
  tutorResponse: TutorResponseSchema,
  status: {
    type: String,
    enum: ['active', 'hidden', 'deleted'],
    default: 'active'
  },
  verifiedPurchase: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const CourseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "categories",
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    offer_percentage: {
      type: Number,
      default: 0,
    },
    tutor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tutor",
      required: true,
    },
    duration: {
      type: Number,
    },
    isActive: {
      type: Boolean,
      default: true
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "categories",
      required: true,
    },
    enrolled_count: {
      type: Number,
      default: 0,
    },
    // Updated rating field to be calculated average
    average_rating: {
      type: Number,
      default: 0,
    },
    rating_breakdown: {
      five_star: { type: Number, default: 0 },
      four_star: { type: Number, default: 0 },
      three_star: { type: Number, default: 0 },
      two_star: { type: Number, default: 0 },
      one_star: { type: Number, default: 0 }
    },
    total_reviews: {
      type: Number,
      default: 0
    },
    // Array to store individual reviews
    reviews: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Review' }],
    lessons: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "lessons",
      },
    ],
    quiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "quizes",
    },
    course_thumbnail: {
      type: String,
      required: true,
    },
    level: {
      type: String,
      required: true,
    },
    notificationSent: {
      type: Boolean,
      default: false
    },
    listed: {
      type: Boolean,
      default: false
    },
    isBanned: {
      type: Boolean,
      default: false
    },
    banReason: {
      type: String
    },
    bannedAt: {
      type: Date
    },
    banReportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Report'
    }
  },
  {
    timestamps: true,
  }
);

// Enhanced methods for CourseSchema
CourseSchema.methods = {
  async canUserReview(userId) {
    // First check if user has received a certificate for this course
    const certificate = await mongoose.model('Certificate').findOne({
      userId: userId,
      courseId: this._id,
      status: 'active'
    });

    if (!certificate) return false;

    // Check if user has already reviewed
    const existingReview = await mongoose.model('Review').findOne({
      user: userId,
      course: this._id,
      status: 'active'
    });

    return !existingReview;
  },

  calculateRatingBreakdown() {
    return mongoose.model('Review').aggregate([
      {
        $match: {
          course: this._id,
          status: 'active'
        }
      },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      }
    ]).then(results => {
      const breakdown = {
        five_star: 0,
        four_star: 0,
        three_star: 0,
        two_star: 0,
        one_star: 0
      };

      results.forEach(result => {
        switch(result._id) {
          case 5: breakdown.five_star = result.count; break;
          case 4: breakdown.four_star = result.count; break;
          case 3: breakdown.three_star = result.count; break;
          case 2: breakdown.two_star = result.count; break;
          case 1: breakdown.one_star = result.count; break;
        }
      });

      this.rating_breakdown = breakdown;
      return this.save();
    });
  },

  async updateAverageRating() {
    const result = await mongoose.model('Review').aggregate([
      {
        $match: {
          course: this._id,
          status: 'active'
        }
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ]);

    if (result.length > 0) {
      this.average_rating = Math.round(result[0].averageRating * 10) / 10;
      this.total_reviews = result[0].totalReviews;
    } else {
      this.average_rating = 0;
      this.total_reviews = 0;
    }

    return this.save();
  }
};

// Static method for getting filtered reviews
CourseSchema.statics.getReviews = async function(courseId, options = {}) {
  const {
    sort = 'newest',
    rating = 'all',
    verified = false,
    page = 1,
    limit = 10
  } = options;

  const query = { 
    course: courseId,
    status: 'active'
  };

  if (rating !== 'all') {
    query.rating = parseInt(rating);
  }

  if (verified) {
    query.verifiedPurchase = true;
  }

  let sortOption = {};
  switch(sort) {
    case 'newest':
      sortOption = { createdAt: -1 };
      break;
    case 'highest':
      sortOption = { rating: -1 };
      break;
    case 'lowest':
      sortOption = { rating: 1 };
      break;
    case 'most_helpful':
      sortOption = { 'helpful_votes.length': -1 };
      break;
  }

  return mongoose.model('Review').find(query)
    .populate('user', 'full_name profileImage')
    .sort(sortOption)
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
};

// Update UserSchema to track review activity
const userSchema = require('./UserModel').schema;
userSchema.add({
  reviews: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review'
  }],
  helpful_votes_given: [{
    review: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Review'
    },
    timestamp: Date
  }]
});

const updateCoursesByCategory = async (categoryId, isVisible) => {
  try {
    await Course.updateMany(
      { category: categoryId },
      { isActive: isVisible }
    );
  } catch (error) {
    console.error('Error updating courses for category:', error);
    throw error;
  }
};


const Review = mongoose.model('Review', ReviewSchema);
const Course = mongoose.model('courses', CourseSchema);
const Report = mongoose.model('Report', ReportSchema);
module.exports = {
  Review,
  Course,
  Report,
  updateCoursesByCategory
};