const mongoose = require("mongoose");
const { Course, Report } = require("../Models/CourseModel");
const User = require("../Models/UserModel");
const Tutor = require("../Models/TutorModel");
const Purchase = require("../Models/PaymentModel");
const { mailSender } = require("../utils/mailSender");
const admin = require("firebase-admin");
// Submit a new course report
const submitCourseReport = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { reason, description } = req.body;
    const userId = req.user._id;
    const validReasons = [
      "inappropriate",
      "spam",
      "misleading",
      "offensive",
      "other",
    ];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({
        success: false,
        message: "Invalid report reason",
      });
    }
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }
    const purchase = await Purchase.findOne({
      userId,
      "items.courseId": courseId,
    });
    if (!purchase) {
      return res.status(403).json({
        success: false,
        message: "Only purchased courses can be reported",
      });
    }
    const existingReport = await Report.findOne({
      course: courseId,
      user: userId,
      status: { $ne: "banned" },
    });

    if (existingReport) {
      return res.status(400).json({
        success: false,
        message: "You have already reported this course",
      });
    }
    const report = new Report({
      course: courseId,
      user: userId,
      tutorId: course.tutor,
      reason,
      description,
      status: "pending",
    });

    await report.save();

    course.reportedCount = (course.reportedCount || 0) + 1;

    const shouldUnlist =
      (course.enrolled_count > 10 &&
        course.reportedCount > 0.4 * course.enrolled_count) ||
      (course.enrolled_count <= 10 && course.reportedCount >= 6);

    const totalReports = await Report.countDocuments({
      course: courseId,
      status: { $in: ["pending", "reviewed"] },
    });

    if ((shouldUnlist || totalReports >= 30) && course.listed) {
      course.listed = false;
      const tutor = await Tutor.findById(course.tutor);
      if (tutor && tutor.email) {
        const emailBody = `
            Dear ${tutor.full_name},
  
            Your course "${course.title}" has been automatically unlisted due to receiving multiple reports from students.
            Please review your course content and contact support for more information.
  
            Best regards,
            EduSphere Team
          `;

        await mailSender(
          tutor.email,
          "Course Unlisted Due to Reports",
          emailBody
        );
      }
    }

    await course.save();

    res.status(201).json({
      success: true,
      message: "Report submitted successfully",
      report: {
        id: report._id,
        reason: report.reason,
        status: report.status,
      },
    });
  } catch (error) {
    console.error("Error in reportCourse:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit report",
      error: error.message,
    });
  }
};

// Get reports for a specific course
const getCourseReports = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;

    console.log("Received CourseId:", courseId);
    console.log("Received Status:", status);
    console.log("Received Page:", page);
    console.log("Received Limit:", limit);
    const courseObjectId = new mongoose.Types.ObjectId(courseId);
    console.log("Converted CourseObjectId:", courseObjectId);

    const query = { course: courseObjectId };
    if (status) {
      query.status = status;
    }

    console.log("Final Query:", query);

    const totalReportsCount = await mongoose
      .model("Report")
      .countDocuments(query);
    console.log("Total Reports Found:", totalReportsCount);

    const reports = await mongoose
      .model("Report")
      .find(query)
      .select("-user")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    console.log("Fetched Reports:", reports);
    const reportStats = await mongoose.model("Report").aggregate([
      { $match: { course: courseObjectId } },
      {
        $group: {
          _id: "$reason",
          count: { $sum: 1 },
        },
      },
    ]);

    console.log("Report Statistics:", reportStats);

    res.status(200).json({
      success: true,
      data: {
        reports,
        totalReports: totalReportsCount,
        totalPages: Math.ceil(totalReportsCount / limit),
        currentPage: page,
        reportStats,
      },
    });
  } catch (error) {
    console.error("Comprehensive Error in getCourseReports:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reports",
      fullError: error.toString(),
      errorDetails: error.message,
    });
  }
};

// Update report status
const updateReportStatus = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status } = req.body;
    console.log(`Updating report ${reportId} to status: ${status}`);
    console.log("Received Report ID:", reportId);
    console.log("Received Status:", status);
    console.log("Request Body:", req.body);
    if (!reportId || reportId === "undefined") {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing Report ID",
        details: "A valid Report ID must be provided",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Report ID format",
        details: "The provided Report ID is not a valid ObjectId",
      });
    }
    const validStatuses = ["reviewed", "resolved", "dismissed", "banned"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
        details: `Status must be one of: ${validStatuses.join(", ")}`,
      });
    }
    const report = await mongoose
      .model("Report")
      .findByIdAndUpdate(
        reportId,
        { status },
        {
          new: true,
          runValidators: true,
        }
      )
      .select("-user");

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
        details: `No report exists with ID: ${reportId}`,
      });
    }

    res.status(200).json({
      success: true,
      message: "Report status updated successfully",
      data: report,
    });
  } catch (error) {
    console.error("Comprehensive Error in updateReportStatus:", {
      error: error.message,
      stack: error.stack,
      reportId: req.params.reportId,
    });

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid Report ID",
        details: "The provided ID could not be converted to a valid ObjectId",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update report status",
      error: error.message,
    });
  }
};

// Get all reported courses
const getAllReportedCourses = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const reportedCoursesAggregate = await Course.aggregate([
      {
        $lookup: {
          from: "reports",
          localField: "_id",
          foreignField: "course",
          as: "reports",
        },
      },
      {
        $match: {
          "reports.0": { $exists: true },
          ...(status ? { "reports.status": status } : {}),
        },
      },
      {
        $project: {
          title: 1,
          reportCount: { $size: "$reports" },
          reportedReasons: {
            $reduce: {
              input: "$reports",
              initialValue: [],
              in: { $setUnion: ["$$value", ["$$this.reason"]] },
            },
          },
          lastReportDate: { $max: "$reports.createdAt" },
        },
      },
      { $sort: { reportCount: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: Number(limit) },
    ]);

    const totalReportedCoursesCount = await Course.aggregate([
      {
        $lookup: {
          from: "reports",
          localField: "_id",
          foreignField: "course",
          as: "reports",
        },
      },
      {
        $match: {
          "reports.0": { $exists: true },
        },
      },
      { $count: "totalCount" },
    ]);

    res.status(200).json({
      success: true,
      data: {
        courses: reportedCoursesAggregate,
        totalCourses: totalReportedCoursesCount[0]?.totalCount || 0,
        totalPages: Math.ceil(
          (totalReportedCoursesCount[0]?.totalCount || 0) / limit
        ),
        currentPage: Number(page),
      },
    });
  } catch (error) {
    console.error("Error in getAllReportedCourses:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reported courses",
      error: error.message,
    });
  }
};

//Course Ban
const courseBan = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { banned, reason, reportId } = req.body;

    const course = await Course.findByIdAndUpdate(
      courseId,
      {
        isBanned: banned,
        banReason: reason,
        bannedAt: new Date(),
        banReportId: reportId,
      },
      { new: true }
    );

    const enrollments = await Purchase.find({ "items.courseId": courseId });
    const userIds = enrollments.map((enrollment) => enrollment.userId);
    const users = await User.find(
      {
        _id: { $in: userIds },
        status: true,
      },
      "fcmToken email full_name"
    );
    const notificationData = {
      title: "Course Banned 🚫",
      body: `The course "${course.title}" has been banned due to policy violations.`,
    };
    await User.updateMany(
      {
        _id: { $in: userIds },
        status: true,
      },
      {
        $push: {
          notifications: {
            ...notificationData,
            createdAt: new Date(),
            read: false,
          },
        },
      }
    );

    const notificationPromises = users.map(async (user) => {
      if (user.fcmToken) {
        const message = {
          notification: notificationData,
          data: {
            courseId: course._id.toString(),
            type: "course_banned",
          },
          token: user.fcmToken,
        };

        try {
          await admin.messaging().send(message);
        } catch (error) {
          console.error(
            `Failed to send push notification to user ${user._id}:`,
            error
          );
        }
      }
      if (user.email) {
        try {
          const emailBody = `
              Hello ${user.full_name},
              
              We regret to inform you that the course "${
                course.title
              }" has been banned due to policy violations.
              
              Reason for ban: ${reason || "Violation of platform policies"}
              
              If you have any questions, please contact our support team.
              
              Best regards,
              EduSphere Team
            `;

          await mailSender(user.email, "Course Banned", emailBody);
        } catch (error) {
          console.error(`Failed to send email to user ${user._id}:`, error);
        }
      }
    });
    await Promise.all(notificationPromises);

    res.json({
      success: true,
      message: "Course banned successfully",
      data: course,
    });
  } catch (error) {
    console.error("Error in courseBan:", error);
    res.status(500).json({
      success: false,
      message: "Failed to ban course",
      error: error.message,
    });
  }
};

module.exports = {
  submitCourseReport,
  getCourseReports,
  updateReportStatus,
  getAllReportedCourses,
  courseBan,
};
