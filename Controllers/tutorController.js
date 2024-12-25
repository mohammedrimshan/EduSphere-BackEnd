const express = require("express");
const Tutor = require("../Models/TutorModel");
const otpSchema = require("../Models/otpModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require('../Models/UserModel')
const Purchase = require('../Models/PaymentModel')
const cloudinary = require("../Config/cloudinaryConfig");
const { Chat } = require('../Models/ChatModel')
const {Course} = require('../Models/CourseModel')
const mongoose = require("mongoose");
require("dotenv").config();
const {
  mailSender,
  otpEmailTemplate,
  passwordResetOtpTemplate,
} = require("../utils/mailSender");

//Tutor UniqueID
const generateUniqueTutorID = async () => {
  try {
    const lastTutor = await Tutor.findOne().sort({ _id: -1 });

    if (!lastTutor) {
      return "TUTOR-0001";
    }
    const lastId = lastTutor.tutor_id;
    const numericPart = parseInt(lastId.split("-")[1]);
    const newNumericPart = numericPart + 1;

    const newTutorId = `TUTOR-${newNumericPart.toString().padStart(4, "0")}`;

    return newTutorId;
  } catch (error) {
    console.error("Error generating tutor ID:", error);
    throw new Error("Could not generate unique tutor ID");
  }
};

//Tutor OTP send
const sendOtp = async (req, res) => {
  const { email } = req.body;
  try {
    const existingTutor = await Tutor.findOne({ email });
    if (existingTutor) {
      return res.status(409).json({ message: "E-mail already exists" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    console.log(otp);
    await otpSchema.findOneAndUpdate(
      { email },
      { email, otp },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const { subject, htmlContent } = otpEmailTemplate(otp);
    await mailSender(email, subject, htmlContent);

    res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error in sendOtp:", error);
    res.status(500).json({ message: "Server error" });
  }
};

//TUtor Verify OTP
const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  try {
    const otpRecord = await otpSchema.findOne({ email, otp });
    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }
    otpRecord.used = true;
    await otpRecord.save();
    res.status(200).json({ message: "OTP verified successfully" });
  } catch (error) {
    console.error("Error in verifyOtp:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const securePassword = async (password) => bcrypt.hash(password, 10);

//Tutor SignUp
const signUp = async (req, res) => {
  try {
    const { full_name, password, email, phone } = req.body;

    if (!full_name || !password || !email) {
      return res.status(400).json({
        message: "Required fields missing",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: "Invalid email format",
      });
    }

    if (phone) {
      const phoneRegex = /^\+?[\d\s-]{10,}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({
          message: "Invalid phone format",
        });
      }
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters long",
      });
    }

    const existingTutor = await Tutor.findOne({
      $or: [{ email: email.toLowerCase() }, { phone: phone }],
    });

    if (existingTutor) {
      return res.status(409).json({
        message: "Tutor already exists with this email or phone",
      });
    }

    const tutorId = await generateUniqueTutorID();

    const passwordHash = await securePassword(password);

    const newTutor = await Tutor.create({
      full_name,
      password: passwordHash,
      email: email.toLowerCase(),
      phone,
      tutor_id: tutorId,
      is_verified: false,
      status: true,
      courses: [],
      lastActive: new Date(),
      lastLogin: null,
      googleId: null,
      profileImage: null,
      image: null,
    });

    const tutorResponse = {
      id: newTutor._id,
      full_name: newTutor.full_name,
      email: newTutor.email,
      phone: newTutor.phone,
      tutor_id: newTutor.tutor_id,
      is_verified: newTutor.is_verified,
      profileImage: newTutor.profileImage,
      status: newTutor.status,
      courses: newTutor.courses,
      lastActive: newTutor.lastActive,
      lastLogin: newTutor.lastLogin,
    };

    res.status(201).json({
      message: "Tutor registered successfully",
      tutor: tutorResponse,
    });
  } catch (error) {
    console.error("Error in signUpTutor:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "Duplicate key error",
      });
    }

    res.status(500).json({
      message: "Server error during registration",
    });
  }
};

//Tutor Login
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    console.log("Login attempt for email:", email);

    const tutor = await Tutor.findOne({ email });
    if (!tutor) {
      return res.status(401).json({
        message: "No account found with this email",
        code: "TUTOR_NOT_FOUND",
      });
    }

    if (!tutor.tutor_id) {
      tutor.tutor_id = await generateUniqueTutorID();
      await tutor.save();
    }

    console.log("Tutor found - tutor_id:", tutor.tutor_id);

    if (!tutor.status) {
      return res.status(403).json({
        message:
          "Your account has been blocked. Please contact support for assistance.",
        code: "ACCOUNT_BLOCKED",
      });
    }

    const isMatch = await bcrypt.compare(password, tutor.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const accessToken = jwt.sign(
      { id: tutor._id, role: "tutor" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const refreshToken = jwt.sign(
      { id: tutor._id, role: "tutor" },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    tutor.lastLogin = new Date();
    await tutor.save();

    res.cookie("token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      accessToken,
      tutor: {
        id: tutor._id,
        full_name: tutor.full_name,
        email: tutor.email,
        phone: tutor.phone,
        tutor_id: tutor.tutor_id,
        profile_image: tutor.profile_image,
        bio: tutor.bio,
        subject: tutor.subject,
        status: tutor.status,
        courses: tutor.courses,
        is_verified: tutor.is_verified,
        lastActive: tutor.lastActive,
        lastLogin: tutor.lastLogin,
      },
    });
  } catch (error) {
    console.error("Error in loginTutor:", error);
    res.status(500).json({ message: "Server error during login" });
  }
};

//Tutor Resend OTP
const resendOtp = async (req, res) => {
  const { email } = req.body;
  try {
    const newOtp = Math.floor(100000 + Math.random() * 900000);
    console.log(newOtp);
    await otpSchema.findOneAndUpdate(
      { email },
      { email, otp: newOtp },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const { subject, htmlContent } = otpEmailTemplate(newOtp);
    await mailSender(email, subject, htmlContent);

    res.status(200).json({ message: "OTP resent successfully" });
  } catch (error) {
    console.error("Error in resendOtp:", error);
    res.status(500).json({ message: "Server error" });
  }
};

//Tutor ForgotPassword
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const tutor = await Tutor.findOne({ email });
    if (!tutor) {
      return res.status(404).json({ message: "Tutor not found" });
    }

    const resetToken = jwt.sign(
      { tutorId: tutor._id },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );
    const resetLink = `${process.env.CORS_ORIGIN}/tutor/tutorreset-password/${resetToken}`;
    await mailSender(
      email,
      passwordResetOtpTemplate(resetLink).subject,
      passwordResetOtpTemplate(resetLink).htmlContent
    );

    res
      .status(200)
      .json({ message: "Password reset link has been sent to your email." });
  } catch (error) {
    console.error("Error in forgotPassword:", error);
    res.status(500).json({ message: "Server error" });
  }
};

//Tutor ResetPassword
const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const tutorId = decoded.tutorId;

    const tutor = await Tutor.findById(tutorId);
    if (!tutor) {
      return res.status(404).json({ message: "Tutor not found" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    tutor.password = hashedPassword;
    await tutor.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error in resetPassword:", error);
    res.status(400).json({ message: "Invalid or expired token" });
  }
};

//Tutor Verify Token
const verifyResetToken = (req, res) => {
  const { token } = req.params;
  if (!token) {
    return res.status(400).json({ message: "Token is required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res
      .status(200)
      .json({ message: "Token is valid", tutorId: decoded.tutorId });
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(400).json({
      message: "Invalid or expired reset token. Please request a new one.",
    });
  }
};

//update tutor
const updateTutor = async (req, res) => {
  try {
    const { id, _id, email, full_name, phone, profileImage } = req.body;

    const tutorId = _id || id;
    if (!tutorId) {
      console.log("Missing tutor ID");
      return res.status(400).json({ message: "Tutor ID is required" });
    }

    console.log("Received update request:", {
      tutorId,
      email,
      full_name,
      phone,
      profileImage,
    });

    const tutor = await Tutor.findById(tutorId);
    if (!tutor) {
      console.log("Tutor not found:", tutorId);
      return res.status(404).json({ message: "Tutor not found" });
    }

    if (phone && phone !== tutor.phone) {
      const existingTutorWithPhone = await Tutor.findOne({ phone: phone });
      if (existingTutorWithPhone && existingTutorWithPhone._id.toString() !== tutorId) {
        console.log("Phone number already in use:", phone);
        return res.status(400).json({ 
          message: "Phone number is already in use by another tutor" 
        });
      }
    }

    const updatedData = {
      ...(full_name && { full_name }),
      ...(email && { email }),
      ...(phone && { phone }),
      ...(profileImage && { profile_image: profileImage }),
    };

    console.log("Updating tutor with data:", updatedData);

    const updatedTutor = await Tutor.findByIdAndUpdate(tutorId, updatedData, {
      new: true,
    });
    console.log("Updated tutor:", updatedTutor);

    res.json({ message: "Update successful", tutor: updatedTutor });
  } catch (error) {
    console.error("Error in updateTutor:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getUserInfo = async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log(userId,"sfgsfgs")
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const latestChat = await Chat.findOne(
      { user_id: userId },
      { student_is_online: 1 }
    ).sort({ updated_at: -1 });
    
    const isOnline = latestChat ? latestChat.student_is_online : false;
    console.log(isOnline)
    return res.status(200).json({
      full_name: user.full_name,
      is_online: isOnline,
      user_image: user.profileImage
    });
  } catch (error) {
    console.error('Error in getUserInfo:', error);
    return res.status(500).json({ message: "Internal server error" });
  }
};


const calculateTutorRevenue = async (req, res) => {
  try {
    const tutorId = req.user._id;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(tutorId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tutor ID format'
      });
    }

    // Get revenue data using the existing calculation function
    const revenueData = await calculateRevenue(tutorId);

    // Get additional tutor stats
    const tutorStats = await getTutorStats(tutorId);

    return res.status(200).json({
      success: true,
      data: {
        revenue: revenueData,
        stats: tutorStats
      }
    });

  } catch (error) {
    console.error('Revenue dashboard error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching revenue data',
      error: error.message
    });
  }
};

// Function to get additional tutor statistics
async function getTutorStats(tutorId) {
  const courses = await mongoose.model('courses').find({
    tutor: tutorId,
    isActive: true,
    isBanned: false
  }).select('enrolled_count average_rating total_reviews');

  return {
    totalCourses: courses.length,
    totalEnrollments: courses.reduce((sum, course) => sum + course.enrolled_count, 0),
    averageRating: courses.length ? 
      (courses.reduce((sum, course) => sum + course.average_rating, 0) / courses.length).toFixed(1) : 
      0,
    totalReviews: courses.reduce((sum, course) => sum + course.total_reviews, 0)
  };
}

async function calculateRevenue(tutorId) {
  try {
    const tutorCourses = await mongoose.model('courses').find({
      tutor: tutorId,
      isActive: true,
      isBanned: false
    }).select('_id price offer_percentage');
    
    const purchases = await mongoose.model('Purchase').aggregate([
      {
        $match: {
          'razorpay.status': 'success'
        }
      },
      {
        $unwind: '$items'
      },
      {
        $match: {
          'items.courseId': {
            $in: tutorCourses.map(course => course._id)
          }
        }
      },
      {
        $lookup: {
          from: 'courses',
          localField: 'items.courseId',
          foreignField: '_id',
          as: 'courseDetails'
        }
      },
      {
        $unwind: '$courseDetails'
      },
      {
        $group: {
          _id: '$items.courseId',
          courseName: { $first: '$courseDetails.title' },
          coursePrice: { $first: '$courseDetails.price' },
          offerPercentage: { $first: '$courseDetails.offer_percentage' },
          totalPurchases: { $sum: 1 },
          revenue: {
            $sum: {
              $multiply: [
                '$courseDetails.price',
                { 
                  $subtract: [
                    1,
                    { $divide: ['$courseDetails.offer_percentage', 100] }
                  ]
                }
              ]
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$revenue' },
          totalPurchases: { $sum: '$totalPurchases' },
          courses: {
            $push: {
              courseId: '$_id',
              courseName: '$courseName',
              coursePrice: '$coursePrice',
              offerPercentage: '$offerPercentage',
              purchases: '$totalPurchases',
              revenue: '$revenue'
            }
          }
        }
      }
    ]);

    return purchases.length > 0 ? {
      totalRevenue: purchases[0].totalRevenue,
      totalPurchases: purchases[0].totalPurchases,
      courses: purchases[0].courses
    } : {
      totalRevenue: 0,
      totalPurchases: 0,
      courses: []
    };
    
  } catch (error) {
    console.error('Error calculating tutor revenue:', error);
    throw error;
  }
}

const getTutorDashboardData = async (req, res) => {
  try {
    const tutorId = req.user._id;

    const tutor = await Tutor.findById(tutorId).select('-password');
    if (!tutor) {
      return res.status(404).json({ message: 'Tutor not found' });
    }

    const courses = await Course.find({ tutor: tutorId });

    const uniqueStudents = await Purchase.distinct('userId', {
      'items.courseId': { $in: courses.map(c => c._id) }
    });
    const totalStudents = uniqueStudents.length;

    const purchases = await Purchase.find({
      'items.courseId': { $in: courses.map(c => c._id) }
    });

    let totalEarnings = 0;
    purchases.forEach(purchase => {
      purchase.items.forEach(item => {
        const course = courses.find(c => c._id.equals(item.courseId));
        if (course) {
          const discountedPrice = course.price * (1 - (course.offer_percentage / 100));
          totalEarnings += discountedPrice;
        }
      });
    });

    const totalRating = courses.reduce((sum, course) => sum + (course.average_rating || 0), 0);
    const averageRating = courses.length > 0 ? totalRating / courses.length : 0;

    const revenueData = await Purchase.aggregate([
      {
        $match: {
          'items.courseId': { $in: courses.map(c => c._id) },
          'razorpay.status': 'success'
        }
      },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'courses',
          localField: 'items.courseId',
          foreignField: '_id',
          as: 'courseDetails'
        }
      },
      {
        $unwind: '$courseDetails'
      },
      {
        $group: {
          _id: { 
            month: { $month: '$purchaseDate' },
            year: { $year: '$purchaseDate' }
          },
          revenue: {
            $sum: {
              $multiply: [
                '$courseDetails.price',
                {
                  $subtract: [
                    1,
                    { $divide: ['$courseDetails.offer_percentage', 100] }
                  ]
                }
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          month: {
            $arrayElemAt: [
              ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
              { $subtract: ['$_id.month', 1] }
            ]
          },
          year: '$_id.year',
          revenue: 1
        }
      },
      { 
        $sort: { 
          'year': 1,
          'month': 1 
        } 
      }
    ]);
    
    // Get top performing courses
    const topCourses = await Course.aggregate([
      { $match: { tutor: new mongoose.Types.ObjectId(tutorId) } },
      {
        $lookup: {
          from: 'purchases',
          localField: '_id',
          foreignField: 'items.courseId',
          as: 'purchases'
        }
      },
      {
        $project: {
          title: 1,
          rating: '$average_rating',
          students: { $size: '$purchases' },
          earnings: {
            $multiply: [
              { $subtract: [1, { $divide: ['$offer_percentage', 100] }] },
              { $multiply: ['$price', { $size: '$purchases' }] }
            ]
          }
        }
      },
      { $sort: { earnings: -1 } },
      { $limit: 3 }
    ]);

    // Get recent enrollments
    const recentEnrollments = await Purchase.aggregate([
      { $match: { 'items.courseId': { $in: courses.map(c => c._id) } } },
      { $unwind: '$items' },
      { $match: { 'items.courseId': { $in: courses.map(c => c._id) } } },
      { $sort: { purchaseDate: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $lookup: {
          from: 'courses',
          localField: 'items.courseId',
          foreignField: '_id',
          as: 'course'
        }
      },
      {
        $project: {
          student: { $arrayElemAt: ['$user.full_name', 0] },
          course: { $arrayElemAt: ['$course.title', 0] },
          date: '$purchaseDate'
        }
      }
    ]);

    // Get latest courses
    const latestCourses = await Course.aggregate([
      { $match: { tutor: new mongoose.Types.ObjectId(tutorId) } },
      { $sort: { createdAt: -1 } },
      { $limit: 3 },
      {
        $lookup: {
          from: 'purchases',
          localField: '_id',
          foreignField: 'items.courseId',
          as: 'enrollments'
        }
      },
      {
        $project: {
          id: '$_id',
          title: 1,
          lessons: { $size: '$lessons' },
          students: { $size: '$enrollments' }
        }
      }
    ]);

    res.json({
      tutor,
      totalStudents,
      totalCourses: courses.length,
      totalEarnings,
      averageRating,
      revenueData,
      topCourses,
      recentEnrollments,
      latestCourses
    });
  } catch (error) {
    console.error('Error fetching tutor dashboard data:', error);
    res.status(500).json({ message: 'Error fetching dashboard data', error: error.message });
  }
};


// Fetch notifications for a tutor
const fetchTutorNotifications = async (req, res) => {
  try {
    const tutorId = req.user._id;

    const tutor = await Tutor.findById(tutorId).select("notifications");

    if (!tutor) {
      return res.status(404).json({ error: "Tutor not found" });
    }

    const sortedNotifications = tutor.notifications.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.status(200).json(sortedNotifications);
  } catch (error) {
    console.error("Error fetching tutor notifications:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
};

// Add notification for a tutor
const addTutorNotification = async (tutorId, notificationData) => {
  try {
    const tutor = await Tutor.findById(tutorId);
    if (!tutor) {
      throw new Error("Tutor not found");
    }

    tutor.notifications.push(notificationData);
    await tutor.save();

    const eventData = {
      type: notificationData.type || "GENERAL_NOTIFICATION",
      title: notificationData.title,
      message: notificationData.body,
      courseId: notificationData.courseId,
    };

    // If using SSE, write to response stream
    if (res && res.write) {
      res.write(`data: ${JSON.stringify(eventData)}\n\n`);
    }

    // Send push notification if FCM token exists
    if (tutor.fcmToken) {
      const message = {
        notification: {
          title: notificationData.title,
          body: notificationData.body,
        },
        data: {
          ...eventData,
          type: eventData.type.toLowerCase()
        },
        token: tutor.fcmToken,
      };

      await admin.messaging().send(message);
      console.log("Successfully sent notification to tutor:", message);
    }

    return notificationData;
  } catch (error) {
    console.error("Error adding tutor notification:", error);
    throw error;
  }
};

// Mark tutor notification as read
const markTutorNotificationAsRead = async (req, res) => {
  try {
    const tutorId = req.user._id;
    const notificationId = req.params.notificationId;

    const tutor = await Tutor.findById(tutorId);
    if (!tutor) {
      return res.status(404).json({ error: "Tutor not found" });
    }

    const notification = tutor.notifications.id(notificationId);
    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    notification.read = true;
    await tutor.save();

    res.status(200).json({ message: "Notification marked as read" });
  } catch (error) {
    console.error("Error marking tutor notification as read:", error);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
};

// Register FCM token for push notifications
const tutorPushNotification = async (req, res) => {
  try {
    const { token, platform } = req.body;
    const tutorId = req.user._id;
    
    await Tutor.findByIdAndUpdate(
      tutorId,
      { fcmToken: token },
      { new: true }
    );

    res.status(200).json({ message: "Token saved successfully" });
  } catch (error) {
    console.error("Error in tutorPushNotification:", error);
    res.status(500).json({ error: "Failed to save token" });
  }
};

// SSE stream for real-time notifications
const tutorNotificationStream = async (req, res) => {
  const tutorId = req.user._id;
  let lastSentCount = null;
  let lastSentData = null;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "http://localhost:5173",
    "Access-Control-Allow-Credentials": "true",
  });

  const sendNotificationCount = async () => {
    try {
      const tutor = await Tutor.findById(tutorId);
      if (!tutor) {
        const errorEvent = {
          type: "ERROR",
          message: "Tutor not found",
        };
        res.write(`event: error\ndata: ${JSON.stringify(errorEvent)}\n\n`);
        return;
      }

      const unreadNotifications = tutor.notifications.filter((n) => !n.read);
      const currentCount = unreadNotifications.length;

      const currentData = {
        type: "NOTIFICATION_UPDATE",
        unreadCount: currentCount,
        notifications: unreadNotifications.map((notification) => ({
          id: notification._id,
          type: notification.type,
          title: notification.title || "New Notification",
          message: notification.body || notification.message,
          courseId: notification.courseId,
          createdAt: notification.createdAt,
        })),
      };

      if (
        lastSentCount !== currentCount ||
        JSON.stringify(lastSentData) !== JSON.stringify(currentData)
      ) {
        lastSentCount = currentCount;
        lastSentData = currentData;

        res.write(
          `event: notification\ndata: ${JSON.stringify(currentData)}\n\n`
        );
      }
    } catch (error) {
      console.error("Error in sendNotificationCount:", error);
      const errorEvent = {
        type: "ERROR",
        message: "Internal server error",
      };
      res.write(`event: error\ndata: ${JSON.stringify(errorEvent)}\n\n`);
    }
  };

  await sendNotificationCount();

  const intervalId = setInterval(sendNotificationCount, 5000);

  const heartbeatId = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 30000);

  req.on("close", () => {
    clearInterval(intervalId);
    clearInterval(heartbeatId);
    res.end();
  });
};


module.exports = {
  signUp,
  login,
  sendOtp,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
  verifyResetToken,
  updateTutor,
  getUserInfo,
  calculateTutorRevenue,
  getTutorDashboardData,
  fetchTutorNotifications,
  addTutorNotification,
  markTutorNotificationAsRead,
  tutorPushNotification,
  tutorNotificationStream
};
