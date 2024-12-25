const Admin = require("../Models/AdminModel");
const User = require("../Models/UserModel");
const Tutor = require("../Models/TutorModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Category = require("../Models/CategoryModel");
const { Course, updateCoursesByCategory } = require("../Models/CourseModel");
const { mailSender, passwordResetOtpTemplate } = require("../utils/mailSender");
const mongoose = require("mongoose");

//Admin Login
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const accessToken = jwt.sign(
      { id: admin._id, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const refreshToken = jwt.sign(
      { id: admin._id, role: "admin" },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("adminToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie("adminRefreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: "Login successful",
      accessToken,
      admin: {
        email: admin.email,
        fullName: admin.fullName,
        profileImage: admin.profileImage,
      },
    });
  } catch (error) {
    console.error("Error in admin login:", error);
    res.status(500).json({ message: "Server error" });
  }
};


//Admin Forgot Password
const AdminForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const resetToken = jwt.sign(
      { adminId: admin._id },
      process.env.JWT_SECRET,
      {
        expiresIn: "15m",
      }
    );

    const resetLink = `${process.env.CORS_ORIGIN}/admin/adminreset-password/${resetToken}`;
    await mailSender(
      email,
      passwordResetOtpTemplate(resetLink).subject,
      passwordResetOtpTemplate(resetLink).htmlContent
    );

    res.json({ message: "Password reset link sent to email" });
  } catch (error) {
    console.error("Error in forgot password:", error);
    res.status(500).json({ message: "Server error" });
  }
};


//Admin Reset Password
const AdminResetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const admin = await Admin.findById(decoded.adminId);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    admin.password = hashedPassword;
    await admin.save();

    res.json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Error in reset password:", error);
    res.status(400).json({ message: "Invalid or expired token" });
  }
};


// Admin verifyResetToken
const verifyResetToken = (req, res) => {
  const { token } = req.params;
  if (!token) {
    return res.status(400).json({ message: "Token is required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res
      .status(200)
      .json({ message: "Token is valid", adminId: decoded.adminId });
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(400).json({
      message: "Invalid or expired reset token. Please request a new one.",
    });
  }
};


//Admin get all user Data
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, "-password").sort({ createdAt: -1 });
    res.json(users);
    console.log(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server error" });
  }
};

//Admin block and unblock user 
const toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(userId);

    const user = await User.findOne({ user_id: userId });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.status = !user.status;
    await user.save();

    res.json({
      success: true,
      message: user.status
        ? "User has been unblocked"
        : "User has been blocked",
      status: user.status,
    });
  } catch (error) {
    console.error("Toggle user status error:", error);
    res.status(500).json({ message: "Server error" });
  }
};


//Get all tutor
const getAllTutors = async (req, res) => {
  try {
    const tutors = await Tutor.find({}, "-password").sort({ createdAt: -1 });
    res.json(tutors);
  } catch (error) {
    console.error("Error fetching tutors:", error);
    res.status(500).json({ message: "Server error" });
  }
};

//Admin block and unblock tutor 
const toggleTutorStatus = async (req, res) => {
  try {
    const { tutorId } = req.params;
    // Change findById to findOne with tutor_id
    const tutor = await Tutor.findOne({ tutor_id: tutorId });

    if (!tutor) {
      return res
        .status(404)
        .json({ success: false, message: "Tutor not found" });
    }

    tutor.status = !tutor.status;
    await tutor.save();

    res.json({
      success: true,
      message: `Tutor ${tutor.status ? "unblocked" : "blocked"} successfully`,
      status: tutor.status,
    });
  } catch (error) {
    console.error("Error toggling tutor status:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
const getDashboardStats = async (req, res) => {
  try {
    const [totalUsers, activeUsers, totalTutors, activeTutors] =
      await Promise.all([
        User.countDocuments(),
        User.countDocuments({ status: true }),
        Tutor.countDocuments(),
        Tutor.countDocuments({ status: true }),
      ]);

    res.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        blocked: totalUsers - activeUsers,
      },
      tutors: {
        total: totalTutors,
        active: activeTutors,
        blocked: totalTutors - activeTutors,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ message: "Server error" });
  }
};

//Search Tutor And User
const searchUsersAndTutors = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }

    const users = await User.find({
      $or: [
        { full_name: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ],
    })
      .select("-password")
      .limit(5);

    const tutors = await Tutor.find({
      $or: [
        { full_name: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
        { specialization: { $regex: query, $options: "i" } },
      ],
    })
      .select("-password")
      .limit(5);

    res.json({ users, tutors });
  } catch (error) {
    console.error("Error in search:", error);
    res.status(500).json({ message: "Server error" });
  }
};


//Add category
const addCategory = async (req, res) => {
  const { title, description } = req.body;
  if (!title || !description) {
    return res
      .status(400)
      .json({ message: "Title and Description are required" });
  }
  try {
    const category = new Category({ title, description });
    await category.save();
    res.status(201).json({ message: "Category Added Successfully", category });
  } catch (error) {
    console.error("Error Creating Category", error);
    res.status(500).json({ message: "Failed to create category" });
  }
};


//Get All Vategory 
const getAllCategories = async (req, res) => {
  try {
    const skipPagination = req.query.all === "true";

    if (skipPagination) {
      const categories = await Category.find().sort({ createdAt: -1 });

      const formattedCategories = categories.map((category) => ({
        id: category._id,
        title: category.title,
        description: category.description,
        isVisible: category.isVisible,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      }));

      return res.json({
        categories: formattedCategories,
        pagination: null,
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    const totalCategories = await Category.countDocuments();
    const totalPages = Math.ceil(totalCategories / limit);

    const categories = await Category.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const formattedCategories = categories.map((category) => ({
      id: category._id,
      title: category.title,
      description: category.description,
      isVisible: category.isVisible,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    }));

    res.json({
      categories: formattedCategories,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: totalCategories,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching categories", error);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
};




//Update Category
const updateCategory = async (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid category ID" });
  }

  try {
    const category = await Category.findByIdAndUpdate(
      id,
      { title, description },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    res
      .status(200)
      .json({ message: "Category updated successfully", category });
  } catch (error) {
    console.error("Error updating category", error);
    res.status(500).json({ message: "Failed to update category" });
  }
};


//Delete category
const deleteCategory = async (req, res) => {
  const { id } = req.params;

  try {
    const category = await Category.findByIdAndDelete(id);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Error deleting category", error);
    res.status(500).json({ message: "Failed to delete category" });
  }
};


//Category Status change
const toggleCategoryVisibility = async (req, res) => {
  const { id } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid category ID format",
      });
    }

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    category.isVisible = !category.isVisible;
    await category.save();

    await updateCoursesByCategory(id, category.isVisible);

    res.json({
      message: `Category visibility updated to ${
        category.isVisible ? "visible" : "hidden"
      }`,
      category,
    });
  } catch (error) {
    console.error("Error toggling visibility:", error);
    res.status(500).json({
      message: "Failed to update category visibility",
      error: error.message,
    });
  }
};


//Block Courses
const blockCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { listed } = req.body;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found.",
      });
    }
    course.listed = listed;
    await course.save();

    res.status(200).json({
      success: true,
      message: `Course has been ${
        listed ? "unblocked" : "blocked"
      } successfully.`,
      data: course,
    });
  } catch (error) {
    console.error("Error in blockCourse:", error);
    res.status(500).json({
      success: false,
      message: "Error updating course status.",
      error: error.message,
    });
  }
};


//Admin Logout
const adminLogout = async (req, res) => {
  try {
    res.cookie("adminToken", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      expires: new Date(0),
    });

    res.cookie("adminRefreshToken", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      expires: new Date(0),
    });

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).json({ message: "Server error during logout" });
  }
};


//Get Dashbord 
const getDashboardStatus = async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ status: true });
    
    const totalTutors = await Tutor.countDocuments({ status: true });
    
    const totalCourses = await Course.countDocuments({ isActive: true });
    
    const allCourses = await Course.find({ isActive: true });
    const totalRevenue = allCourses.reduce((acc, course) => {
      return acc + (course.price * course.enrolled_count);
    }, 0);

    const currentYear = new Date().getFullYear();
    const monthlyRevenue = await Course.aggregate([
      {
        $match: {
          isActive: true,
          createdAt: {
            $gte: new Date(currentYear, 0, 1),
            $lt: new Date(currentYear + 1, 0, 1)
          }
        }
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          revenue: {
            $sum: { $multiply: ["$price", "$enrolled_count"] }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

   
    const topCourses = await Course.aggregate([
      {
        $match: { isActive: true }
      },
      {
        $sort: { enrolled_count: -1 }
      },
      {
        $limit: 5
      },
      {
        $project: {
          title: 1,
          enrolled_count: 1,
          revenue: { $multiply: ["$price", "$enrolled_count"] }
        }
      }
    ]);

    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const formattedMonthlyRevenue = months.map(month => {
      const found = monthlyRevenue.find(item => item._id === month);
      return found ? found.revenue : 0;
    });

    const formattedTopCourses = topCourses.map(course => ({
      name: course.title,
      revenue: course.revenue,
      students: course.enrolled_count
    }));

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalRevenue,
          totalStudents,
          totalTutors,
          totalCourses
        },
        chartData: {
          monthlyRevenue: formattedMonthlyRevenue,
          topCourses: formattedTopCourses
        }
      }
    });

  } catch (error) {
    console.error('Dashboard Stats Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard statistics',
      error: error.message
    });
  }
};

module.exports = {
  adminLogin,
  adminLogout,
  AdminForgotPassword,
  AdminResetPassword,
  verifyResetToken,
  getAllUsers,
  toggleUserStatus,
  getAllTutors,
  toggleTutorStatus,
  getDashboardStats,
  searchUsersAndTutors,
  addCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
  toggleCategoryVisibility,
  blockCourse,
  getDashboardStatus
};
