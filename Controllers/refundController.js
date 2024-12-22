const mongoose = require("mongoose");
const User = require("../Models/UserModel");
const {Course} = require("../Models/CourseModel");
const Purchase = require("../Models/PaymentModel");
const VideoProgress = require("../Models/ProgressModel");
const {WalletTransaction , Refund} = require("../Models/refundModel");
 

// User Controllers
const userGetRefunds = async (req, res) => {
  try {
    const userId = req.user._id; // Already an ObjectId from auth middleware
    const { status, page = 1, limit = 10 } = req.query;

    // Validate page and limit
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
      return res.status(400).json({ message: "Invalid pagination parameters" });
    }

    // Build query
    const query = { userId }; // No need to convert userId since it's already an ObjectId
    if (status && status.trim() !== '') {
      query.status = status;
    }

    // Get refunds with proper error handling
    const refunds = await Refund.find(query)
      .populate('courseId', 'title course_thumbnail price')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    const total = await Refund.countDocuments(query);

    const enhancedRefunds = await Promise.all(refunds.map(async (refund) => {
      try {
        if (!refund.courseId) {
          return {
            refundId: refund._id,
            course: {
              title: "Course Unavailable",
              thumbnail: null,
              price: refund.amount || 0
            },
            amount: refund.amount,
            reason: refund.reason,
            status: refund.status,
            requestDate: refund.createdAt,
            processedAt: refund.processedAt,
            adminNote: refund.adminNote,
            progress: 0
          };
        }

        const progress = await VideoProgress.aggregate([
          {
            $match: {
              userId: userId, // userId is already an ObjectId
              courseId: refund.courseId._id // courseId._id from populated document is already an ObjectId
            }
          },
          {
            $group: {
              _id: null,
              totalProgress: { $avg: "$progress" }
            }
          }
        ]);

        return {
          refundId: refund._id,
          course: {
            title: refund.courseId.title || "Untitled Course",
            thumbnail: refund.courseId.course_thumbnail,
            price: refund.courseId.price
          },
          amount: refund.amount,
          reason: refund.reason,
          status: refund.status,
          requestDate: refund.createdAt,
          processedAt: refund.processedAt,
          adminNote: refund.adminNote,
          progress: progress[0]?.totalProgress || 0
        };
      } catch (err) {
        console.error(`Error processing refund ${refund._id}:`, err);
        return {
          refundId: refund._id,
          course: {
            title: refund.courseId?.title || "Error Loading Course",
            thumbnail: refund.courseId?.course_thumbnail,
            price: refund.courseId?.price
          },
          amount: refund.amount,
          reason: refund.reason,
          status: refund.status,
          requestDate: refund.createdAt,
          processedAt: refund.processedAt,
          adminNote: refund.adminNote,
          progress: 0
        };
      }
    }));

    res.status(200).json({
      refunds: enhancedRefunds,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error("Error in userGetRefunds:", error);
    res.status(500).json({ 
      message: "Error fetching refund history",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
};


const userGetRefundDetails = async (req, res) => {
  try {
    const userId = req.user._id; // Already an ObjectId from auth middleware
    const { refundId } = req.params;

    // Validate refundId
    if (!mongoose.Types.ObjectId.isValid(refundId)) {
      return res.status(400).json({ message: "Invalid refund ID format" });
    }

    const refund = await Refund.findOne({ 
      _id: refundId, 
      userId 
    })
    .populate('courseId', 'title course_thumbnail price description')
    .populate('purchaseId')
    .lean();

    if (!refund) {
      return res.status(404).json({ message: "Refund request not found" });
    }

    // Ensure courseId exists before proceeding
    if (!refund.courseId) {
      return res.status(404).json({ message: "Associated course not found" });
    }

    let progress = [];
    try {
      progress = await VideoProgress.aggregate([
        {
          $match: {
            userId: userId, // Already an ObjectId
            courseId: refund.courseId._id // Already an ObjectId from populated document
          }
        },
        {
          $group: {
            _id: null,
            totalProgress: { $avg: "$progress" },
            lastAccessDate: { $max: "$lastUpdated" }
          }
        }
      ]);
    } catch (err) {
      console.error('Error calculating video progress:', err);
      // Continue execution with default values if progress calculation fails
    }

    // Ensure purchaseDate exists before calculation
    const daysSincePurchase = refund.purchaseId && refund.purchaseId.purchaseDate
      ? Math.floor((Date.now() - new Date(refund.purchaseId.purchaseDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    res.status(200).json({
      refundId: refund._id,
      course: {
        title: refund.courseId.title || 'Untitled Course',
        thumbnail: refund.courseId.course_thumbnail,
        price: refund.courseId.price || 0,
        description: refund.courseId.description || ''
      },
      refund: {
        amount: refund.amount,
        reason: refund.reason,
        status: refund.status,
        requestDate: refund.createdAt,
        processedAt: refund.processedAt,
        adminNote: refund.adminNote
      },
      metrics: {
        progress: progress[0]?.totalProgress || 0,
        lastAccessDate: progress[0]?.lastAccessDate || null,
        daysSincePurchase
      }
    });
  } catch (error) {
    console.error("Error in userGetRefundDetails:", error);
    res.status(500).json({ 
      message: "Error fetching refund details",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const requestRefund = async (req, res) => {
  try {
    const { courseId, reason } = req.body;
    const userId = req.user._id;

    console.log('Refund request details:', {
      userId: userId.toString(),
      courseId,
      reason
    });

    // Validation checks remain the same...
    if (!courseId || !reason) {
      return res.status(400).json({
        message: "Missing required fields"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        message: "Invalid course ID format"
      });
    }

    const courseObjectId = new mongoose.Types.ObjectId(courseId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Check existing refund...
    const existingRefund = await Refund.findOne({
      userId: userObjectId,
      courseId: courseObjectId
    });

    if (existingRefund) {
      return res.status(400).json({
        message: "Refund already requested for this course"
      });
    }

    // Get progress records
    const progress = await VideoProgress.find({
      userId: userObjectId,
      courseId: courseObjectId
    });

    const totalLessons = progress.length;
    
    // Calculate overall course progress
    let totalCourseProgress = 0;
    progress.forEach(lesson => {
      // Each lesson contributes its portion to the total course progress
      // For example, if there are 4 lessons, each lesson is worth 25% of the total
      const lessonWeight = 100 / totalLessons;
      // If lesson has any progress, count it as completed (100%)
      const lessonContribution = lesson.currentTime > 0 ? lessonWeight : 0;
      totalCourseProgress += lessonContribution;
    });

    console.log('Course progress calculation:', {
      totalLessons,
      totalCourseProgress
    });

    if (totalCourseProgress > 25) {
      return res.status(400).json({
        message: "Cannot refund course with progress over 25%"
      });
    }

    // Find purchase and check 30-day limit...
    const purchase = await Purchase.findOne({
      userId: userObjectId,
      'items.courseId': courseObjectId
    });

    if (!purchase) {
      return res.status(404).json({
        message: "Purchase not found"
      });
    }

    const daysSincePurchase = (Date.now() - purchase.purchaseDate) / (1000 * 60 * 60 * 24);
    
    if (daysSincePurchase > 30) {
      return res.status(400).json({
        message: "Refund period has expired"
      });
    }

    const refund = await Refund.create({
      userId: userObjectId,
      courseId: courseObjectId,
      purchaseId: purchase._id,
      amount: purchase.razorpay.amount,
      reason,
      status: 'pending'
    });

    res.status(200).json({
      message: "Refund request submitted successfully",
      refundId: refund._id
    });

  } catch (error) {
    console.error('Refund request error:', error);
    res.status(500).json({
      message: "Error requesting refund",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
// Admin Controllers
const adminGetAllRefunds = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const query = {};
    if (status) {
      query.status = status;
    }

    const refunds = await Refund.find(query)
      .populate('userId', 'full_name email')
      .populate('courseId', 'title price')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Refund.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        refunds,
        totalRefunds: total,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page)
      }
    });
  } catch (error) {
    console.error("Error in adminGetAllRefunds:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching refund requests",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const adminGetRefundDetails = async (req, res) => {
  try {
    const { refundId } = req.params;

    const refund = await Refund.findById(refundId)
      .populate('userId', 'full_name email phone')
      .populate('courseId', 'title price tutor')
      .populate('purchaseId');

    if (!refund) {
      return res.status(404).json({ message: "Refund request not found" });
    }

    const progress = await VideoProgress.aggregate([
      {
        $match: {
          userId: refund.userId._id,
          courseId: refund.courseId._id
        }
      },
      {
        $group: {
          _id: null,
          totalProgress: { $avg: "$progress" },
          lastAccessDate: { $max: "$lastUpdated" }
        }
      }
    ]);

    res.status(200).json({
      refund,
      progress: progress[0] || { totalProgress: 0 }
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching refund details" });
  }
};

const adminProcessRefund = async (req, res) => {
  try {
    const { refundId } = req.params;
    const { status, adminNote } = req.body;

    // Input validation
    if (!refundId || !mongoose.Types.ObjectId.isValid(refundId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid refund ID provided"
      });
    }

    // Find and verify refund request
    const refund = await Refund.findById(refundId)
      .populate('userId')
      .populate('courseId');

    if (!refund) {
      return res.status(404).json({
        success: false,
        message: "Refund request not found"
      });
    }

    // Verify user and course exist
    if (!refund.userId || !refund.courseId) {
      return res.status(400).json({
        success: false,
        message: "Associated user or course not found"
      });
    }

    // Check if refund is already processed
    if (refund.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Refund cannot be processed - current status: ${refund.status}`
      });
    }

    if (status === 'approved') {
      try {
        // Create wallet transaction first
        const walletTransaction = await WalletTransaction.create({
          userId: refund.userId._id,
          type: "credit",
          amount: refund.amount,
          description: `Refund approved for course: ${refund.courseId.title}`,
          status: "completed",
          referenceId: refund._id,
          referenceModel: "Refund"
        });

        // Update user wallet and remove course
        const updatedUser = await User.findByIdAndUpdate(
          refund.userId._id,
          {
            $inc: { wallet: refund.amount },
            $pull: { courses: { course: refund.courseId._id } }
          },
          { new: true }
        );

        if (!updatedUser) {
          await WalletTransaction.findByIdAndDelete(walletTransaction._id);
          throw new Error('Failed to update user wallet and courses');
        }

        // Store original purchase before updating
        const originalPurchases = await Purchase.find({
          userId: refund.userId._id,
          'items.courseId': refund.courseId._id
        });

        // Remove course from Purchase collection's items array
        const updateResult = await Purchase.updateMany(
          { 
            userId: refund.userId._id,
            'items.courseId': refund.courseId._id 
          },
          { 
            $pull: { 
              items: { courseId: refund.courseId._id }
            }
          }
        );

        // Update course enrollment count
        const updatedCourse = await Course.findByIdAndUpdate(
          refund.courseId._id,
          { $inc: { enrolled_count: -1 } },
          { new: true }
        );

        if (!updatedCourse) {
          // Revert all changes if course update fails
          await User.findByIdAndUpdate(
            refund.userId._id,
            {
              $inc: { wallet: -refund.amount },
              $push: { courses: { course: refund.courseId._id } }
            }
          );
          await WalletTransaction.findByIdAndDelete(walletTransaction._id);
          
          // Restore original purchase items
          for (const purchase of originalPurchases) {
            await Purchase.findByIdAndUpdate(
              purchase._id,
              { items: purchase.items }
            );
          }
          
          throw new Error('Failed to update course enrollment count');
        }

        // Clean up empty purchases
        await Purchase.deleteMany({
          userId: refund.userId._id,
          items: { $size: 0 }
        });

        // Update refund status last
        refund.status = status;
        refund.adminNote = adminNote || '';
        refund.processedAt = new Date();
        await refund.save();

      } catch (error) {
        throw new Error(`Refund processing failed: ${error.message}`);
      }
    } else if (status === 'rejected') {
      // Simply update refund status for rejection
      refund.status = status;
      refund.adminNote = adminNote || '';
      refund.processedAt = new Date();
      await refund.save();
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid status provided. Must be 'approved' or 'rejected'"
      });
    }

    // Send success response
    return res.status(200).json({
      success: true,
      message: `Refund ${status} successfully`,
      data: {
        refundId: refund._id,
        status: refund.status,
        processedAt: refund.processedAt
      }
    });

  } catch (error) {
    console.error('Error in adminProcessRefund:', error);
    return res.status(500).json({
      success: false,
      message: "Error processing refund",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

const adminGetStats = async (req, res) => {
  try {
    const stats = await Refund.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ message: "Error fetching refund statistics" });
  }
};


const getWalletDetails = async (req, res) => {
  try {
    const userId = req.user._id; // Assuming user ID comes from auth middleware

    // Get user's wallet balance and basic info
    const user = await User.findById(userId)
      .select('wallet full_name email');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's transactions with pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get transactions
    const transactions = await WalletTransaction.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('type amount description status createdAt')
      .lean();

    // Get total count for pagination
    const totalTransactions = await WalletTransaction.countDocuments({ userId });

    return res.status(200).json({
      success: true,
      data: {
        user: {
          full_name: user.full_name,
          email: user.email,
          wallet_balance: user.wallet
        },
        transactions: transactions.map(transaction => ({
          ...transaction,
          createdAt: transaction.createdAt.toISOString()
        })),
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalTransactions / limit),
          totalTransactions,
          hasNextPage: skip + transactions.length < totalTransactions
        }
      }
    });
  } catch (error) {
    console.error('Error in getWalletDetails:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving wallet details',
      error: error.message
    });
  }
};


module.exports = {
  userGetRefunds,
  userGetRefundDetails,
  requestRefund,
  adminGetAllRefunds,
  adminGetRefundDetails,
  adminProcessRefund,
  adminGetStats,
  getWalletDetails
};