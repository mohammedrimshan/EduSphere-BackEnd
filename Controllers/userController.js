const express = require("express");
const User = require("../Models/UserModel");
const otpSchema = require("../Models/otpModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const otpGenerator = require("otp-generator");
const cloudinary = require("../Config/cloudinaryConfig");
const Quiz = require("../Models/QuizModel");
const admin = require("../Config/firebase"); // Adjust path as necessary
const { Course } = require("../Models/CourseModel");
const Tutor = require("../Models/TutorModel");
const { Chat } = require("../Models/ChatModel");

require("dotenv").config();
const {
  mailSender,
  otpEmailTemplate,
  passwordResetOtpTemplate,
} = require("../utils/mailSender");
const mongoose = require('mongoose');
//UniqueID for Users
const generateUniqueUserID = async (prefix = "edusphereUser") => {
  const randomNumber = Math.floor(100000 + Math.random() * 900000);
  const userId = `${prefix}${randomNumber}`;
  const exists = await User.findOne({ user_id: userId });
  return exists ? generateUniqueUserID(prefix) : userId;
};

//Send OTP user
const sendOtp = async (req, res) => {
  const { email } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
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

//verify OTP user
const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  console.log("Received OTP verification request:", { email, otp });

  try {
    const otpRecord = await otpSchema.findOne({ email, otp });
    console.log("OTP record found:", otpRecord);

    if (!otpRecord) {
      console.log("Invalid or expired OTP for email:", email);
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    otpRecord.used = true;
    await otpRecord.save();
    console.log("OTP record marked as used");

    res.status(200).json({ message: "OTP verified successfully" });
  } catch (error) {
    console.error("Error in verifyOtp:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const securePassword = async (password) => bcrypt.hash(password, 10);

// user Signup
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

    const userExists = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone: phone }],
    });

    if (userExists) {
      return res.status(409).json({
        message: "User already exists with this email or phone",
      });
    }

    const userId = await generateUniqueUserID();

    const passwordHash = await securePassword(password);

    const newUser = await User.create({
      full_name,
      password: passwordHash,
      email: email.toLowerCase(),
      phone,
      user_id: userId,
      is_verified: false,
      status: true,
      wallet: 0,
      courses: [],
      lastActive: new Date(),
      lastLogin: null,
      googleId: null,
      profileImage: null,
      image: null,
    });

    const userResponse = {
      id: newUser._id,
      full_name: newUser.full_name,
      email: newUser.email,
      phone: newUser.phone,
      user_id: newUser.user_id,
      is_verified: newUser.is_verified,
      wallet: newUser.wallet,
      courses: newUser.courses,
      lastActive: newUser.lastActive,
      lastLogin: newUser.lastLogin,
      profileImage: newUser.profileImage,
    };

    res.status(201).json({
      message: "User registered successfully",
      user: userResponse,
    });
  } catch (error) {
    console.error("Error in signUp:", error);
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

//Login For User
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if email and password are provided
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (!user.status) {
      return res.status(403).json({
        message:
          "Your account has been blocked. Please contact support for assistance.",
        code: "ACCOUNT_BLOCKED",
      });
    }

    if (!user.password) {
      console.error("No password found for user:", user);
      return res.status(500).json({ message: "User password is missing" });
    }

    console.log("Password from request:", password);
    console.log("Hashed password in DB:", user.password);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const accessToken = jwt.sign(
      { id: user._id, role: "user" },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    const refreshToken = jwt.sign(
      { id: user._id, role: "user" },
      process.env.REFRESH_TOKEN_SECRET,
      {
        expiresIn: "7d",
      }
    );

    user.lastLogin = new Date();
    await user.save();

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
      refreshToken,
      user: {
        id: user._id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        user_id: user.user_id,
        is_verified: user.is_verified,
        wallet: user.wallet,
        courses: user.courses,
        lastActive: user.lastActive,
        lastLogin: user.lastLogin,
        profileImage: user.profileImage,
      },
    });
  } catch (error) {
    console.error("Error in login:", error);
    res.status(500).json({ message: "Server error" });
  }
};

//Resend OTP for User
const resendOtp = async (req, res) => {
  const { email } = req.body;
  console.log("Email:", email);
  try {
    const newOtp = Math.floor(100000 + Math.random() * 900000);
    console.log("Generated OTP:", newOtp);

    const result = await otpSchema.findOneAndUpdate(
      { email },
      { email, otp: newOtp },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (!result) {
      return res.status(500).json({ message: "Failed to save OTP" });
    }

    const { subject, htmlContent } = otpEmailTemplate(newOtp);
    await mailSender(email, subject, htmlContent);

    res.status(200).json({ message: "OTP resent successfully" });
  } catch (error) {
    console.error("Error in resendOtp:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

//Forgot password user
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.resetRequestedAt) {
      const currentTime = Date.now();
      const resetExpirationTime =
        user.resetRequestedAt.getTime() + 15 * 60 * 1000;
      if (currentTime < resetExpirationTime) {
        return res.status(400).json({
          message:
            "A reset token has already been sent. Please check your email.",
        });
      }
    }

    const resetToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "15m",
    });
    console.log(resetToken);

    const resetLink = `${process.env.CORS_ORIGIN}/user/reset-password/${resetToken}`;
    await mailSender(
      email,
      passwordResetOtpTemplate(resetLink).subject,
      passwordResetOtpTemplate(resetLink).htmlContent
    );

    user.resetRequestedAt = new Date();
    await user.save();

    res.status(200).json({
      message: "Password reset link has been sent to your email.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

//Reset Password User
const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token has expired" });
    }
    console.error(error);
    return res.status(400).json({ message: "Invalid or expired token" });
  }
};

//Verify Reset Token
const verifyResetToken = (req, res) => {
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({ message: "Token is required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(decoded);

    res.status(200).json({ message: "Token is valid", userId: decoded.userId });
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(400).json({
      message: "Invalid or expired reset token. Please request a new one.",
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id, _id, email, full_name, phone, profileImage } = req.body;

    const userId = _id || id;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (email && email !== user.email) {
      const otpRecord = await otpSchema.findOne({
        email: email,
      });

      if (!otpRecord) {
        return res.status(400).json({
          message: "Email update requires OTP verification",
        });
      }
    }

    if (phone && phone !== user.phone) {
      const existingUserWithPhone = await User.findOne({ phone: phone });
      if (
        existingUserWithPhone &&
        existingUserWithPhone._id.toString() !== userId
      ) {
        return res.status(400).json({
          message: "Phone number is already in use by another user",
        });
      }
    }

    const updatedData = {
      ...(full_name && { full_name }),
      ...(email && { email }),
      ...(phone && { phone }),
      ...(profileImage && { profileImage }),
    };

    const updatedUser = await User.findByIdAndUpdate(userId, updatedData, {
      new: true,
    });

    res.json({ message: "Update successful", user: updatedUser });
  } catch (error) {
    console.error("Error in updateUser:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const fetchNotifications = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const user = await User.findOne({ user_id: userId }).select(
      "notifications"
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const sortedNotifications = user.notifications.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.status(200).json(sortedNotifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
};

const addNotification = async (userId, notificationData) => {
  try {
    const user = await User.findOne({ user_id: userId });
    if (!user) {
      throw new Error("User not found");
    }

    user.notifications.push(notificationData);
    await user.save();
    const eventData = {
      type: "COURSE_OFFER",
      title: notificationData.title,
      message: notificationData.body,
      courseId: notificationData.courseId,
    };
    res.write(`data: ${JSON.stringify(eventData)}\n\n`);
    if (user.fcmToken && notificationData.courseId) {
      const message = {
        notification: {
          title: notificationData.title,
          body: notificationData.body,
        },
        data: {
          courseId: notificationData.courseId.toString(),
          offerPercentage: notificationData.offerPercentage.toString(),
          type: "course_offer",
        },
        token: user.fcmToken,
      };

      await admin.messaging().send(message);
      console.log("Successfully sent course offer notification:", message);
    }

    return notificationData;
  } catch (error) {
    console.error("Error adding notification:", error);
    throw error;
  }
};

const markNotificationAsRead = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const notificationId = req.params.notificationId;

    const user = await User.findOne({ user_id: userId });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const notification = user.notifications.id(notificationId);
    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    notification.read = true;
    await user.save();

    res.status(200).json({ message: "Notification marked as read" });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
};

const Pushnotification = async (req, res) => {
  try {
    const { token, platform } = req.body;
    const userId = req.user.user_id;
    await User.findOneAndUpdate(
      { user_id: userId },
      { fcmToken: token },
      { new: true }
    );

    res.status(200).json({ message: "Token saved successfully" });
  } catch (error) {
    console.error("Error in Pushnotification:", error);
    res.status(500).json({ error: "Failed to save token" });
  }
};

const notificationStream = async (req, res) => {
  const userId = req.user.user_id;
  let lastSentCount = null;
  let lastSentData = null;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "https://edusphere.rimshan.in",
    "Access-Control-Allow-Credentials": "true",
  });

  const sendNotificationCount = async () => {
    try {
      const user = await User.findOne({ user_id: userId });
      if (!user) {
        const errorEvent = {
          type: "ERROR",
          message: "User not found",
        };
        res.write(`event: error\ndata: ${JSON.stringify(errorEvent)}\n\n`);
        return;
      }

      const unreadNotifications = user.notifications.filter((n) => !n.read);
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

// Get quiz by course ID
const getQuizByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const quiz = await Quiz.findOne({ courseId });
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "No quiz found for this course",
      });
    }
    const course = await Course.findById(courseId).select("tutor");
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }
    const quizData = {
      ...quiz.toObject(),
      tutorId: course.tutor,
    };
    console.log(quizData);

    res.status(200).json({
      success: true,
      data: quizData,
    });
  } catch (error) {
    console.error("Error in getQuizByCourse:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch quiz",
      error: error.message,
    });
  }
};

const getUserProfile = async (req, res) => {
  try {
    if (!req.user) {
      console.log("Authentication middleware did not set req.user");
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userId = req.user.id || req.user._id || req.user.user_id;

    if (!userId) {
      console.log("User ID not found in req.user:", req.user);
      return res.status(400).json({
        success: false,
        message: "User ID not found in request",
      });
    }

    console.log("Attempting to fetch user profile for ID:", userId);

    const user = await User.findOne({
      $or: [{ _id: userId }, { user_id: userId }],
    }).select("-password -resetRequestedAt -__v");

    if (!user) {
      console.log("No user found for ID:", userId);
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    console.log("User profile fetched successfully for ID:", userId);

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        is_verified: user.is_verified,
        wallet: user.wallet,
        courses: user.courses,
        lastActive: user.lastActive,
        lastLogin: user.lastLogin,
        profileImage: user.profileImage,
      },
    });
  } catch (error) {
    console.error("Error in getUserProfile:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user profile",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};
const getTutorInfo = async (req, res) => {
  try {
    const tutorId = req.params.tutorId;
    console.log(tutorId, "Tacher ");
    // Get tutor basic info
    const tutor = await Tutor.findById(tutorId);

    if (!tutor) {
      return res.status(404).json({ message: "Tutor not found" });
    }

    // Find the most recent chat where this tutor is involved to get online status
    const latestChat = await Chat.findOne(
      { tutor_id: tutorId },
      { tutor_is_online: 1 },
      { sort: { updated_at: -1 } }
    );

    // Determine online status from chat, default to false if no chat exists
    const isOnline = latestChat ? latestChat.tutor_is_online : false;

    return res.status(200).json({
      full_name: tutor.full_name,
      is_online: isOnline,
      tutor_image: tutor.profile_image,
    });
  } catch (error) {
    console.error("Error in getTutorInfo:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const getAllTutors = async (req, res) => {
  try {
    const tutors = await Tutor.aggregate([
      // Stage 1: Lookup courses
      {
        $lookup: {
          from: "courses",
          let: { tutorId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { 
                  $eq: ["$tutor", "$$tutorId"]
                }
              }
            }
          ],
          as: "courseDetails",
        },
      },
      // Stage 2: Project required fields
      {
        $project: {
          _id: 1,
          full_name: 1,
          profile_image: 1,
          bio: { $ifNull: ["$bio", ""] },
          subject: { $ifNull: ["$subject", "General"] },
          totalCourses: { 
            $size: { 
              $ifNull: ["$courseDetails", []] 
            }
          },
          averageRating: {
            $cond: {
              if: { $eq: [{ $size: "$courseDetails" }, 0] },
              then: 0,
              else: {
                $avg: {
                  $map: {
                    input: "$courseDetails",
                    as: "course",
                    in: { $ifNull: ["$$course.average_rating", 0] }
                  }
                }
              }
            }
          },
          totalStudents: {
            $sum: {
              $map: {
                input: "$courseDetails",
                as: "course",
                in: { $ifNull: ["$$course.enrolled_count", 0] }
              }
            }
          },
        },
      },
      // Stage 3: Sort by total students
      {
        $sort: {
          totalStudents: -1
        }
      }
    ]).exec();

    console.log('Total tutors found:', tutors.length);

    res.status(200).json({
      status: "success",
      data: tutors,
    });
  } catch (error) {
    console.error('Aggregation error:', error);
    res.status(500).json({
      status: "error",
      message: "Error fetching tutors",
      error: error.message,
    });
  }
};
// Get specific tutor details with courses
const getTutorDetails = async (req, res) => {
  const { tutorId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(tutorId)) {
    return res.status(400).json({
      status: "error",
      message: "Invalid tutor ID format"
    });
  }

  try {
    // Get tutor details with courses
    const tutorDetails = await Tutor.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(tutorId),
          status: true,
        },
      },
      {
        $lookup: {
          from: "courses",
          localField: "courses",
          foreignField: "_id",
          as: "courses",
        },
      },
      {
        $lookup: {
          from: "users",
          let: { courseIds: "$courses._id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: { $ifNull: ["$courses", []] }, // Handle null courses
                          as: "userCourse",
                          cond: {
                            $in: ["$$userCourse.course", "$$courseIds"],
                          },
                        },
                      },
                    },
                    0,
                  ],
                },
              },
            },
          ],
          as: "enrolledStudents",
        },
      },
      {
        $project: {
          _id: 1,
          full_name: 1,
          profile_image: 1,
          email:1,
          bio: 1,
          subject: 1,
          totalStudents: { $size: "$enrolledStudents" },
          totalCourses: { $size: "$courses" },
          averageRating: {
            $avg: {
              $map: {
                input: "$courses",
                as: "course",
                in: { $ifNull: ["$$course.average_rating", 0] }
              }
            }
          },
          courses: {
            $map: {
              input: "$courses",
              as: "course",
              in: {
                _id: "$$course._id",
                title: "$$course.title",
                description: "$$course.description",
                course_thumbnail: "$$course.course_thumbnail",
                price: "$$course.price",
                offer_percentage: { $ifNull: ["$$course.offer_percentage", 0] },
                enrolled_count: { $ifNull: ["$$course.enrolled_count", 0] },
                average_rating: { $ifNull: ["$$course.average_rating", 0] },
                total_reviews: { $ifNull: ["$$course.total_reviews", 0] },
                level: "$$course.level",
                duration: "$$course.duration",
              },
            },
          },
        },
      },
    ]);

    if (!tutorDetails.length) {
      return res.status(404).json({
        status: "error",
        message: "Tutor not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: tutorDetails[0],
    });
  } catch (error) {
    // Add more detailed error logging
    console.error('Error in getTutorDetails:', error);
    res.status(500).json({
      status: "error",
      message: "Error fetching tutor details",
      error: error.message,
    });
  }
};

const searchCourses = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(200).json({ courses: [] });
    }

    const courses = await Course.find({
      $and: [
        { isActive: true, listed: true, isBanned: false },
        {
          $or: [
            { title: { $regex: query, $options: 'i' } },
            { description: { $regex: query, $options: 'i' } },
            { level: { $regex: query, $options: 'i' } }
          ]
        }
      ]
    })
    .populate('tutor', 'full_name profileImage')
    .populate('category', 'title')
    .select('title description price course_thumbnail average_rating level tutor category')
    .limit(5);

    res.status(200).json({ courses });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Error searching courses' });
  }
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
  updateUser,
  fetchNotifications,
  addNotification,
  markNotificationAsRead,
  Pushnotification,
  notificationStream,
  getQuizByCourse,
  getUserProfile,
  getTutorInfo,
  getTutorDetails,
  getAllTutors,
  searchCourses
};
