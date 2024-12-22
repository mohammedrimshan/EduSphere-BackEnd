const crypto = require("crypto");
const Purchase = require("../Models/PaymentModel");
const { Course } = require("../Models/CourseModel");
const User = require("../Models/UserModel");
const Razorpay = require("razorpay");
const Cart = require("../Models/CartModel");
const mongoose = require("mongoose");
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});


//Create Razorpay Order
const createRazorpayOrder = async (req, res) => {
  try {
    const { amount } = req.body;

    const amountInPaise = Math.round(amount * 100);

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `order_${Date.now()}`,
      payment_capture: 1,
    };

    const order = await razorpay.orders.create(options);

    res.status(200).json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error("Razorpay Order Creation Error:", error);
    res.status(500).json({ error: "Failed to create Razorpay order" });
  }
};


//verify Razorpay Signature
const verifyRazorpaySignature = (
  razorpayOrderId,
  razorpayPaymentId,
  signature
) => {
  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  return generatedSignature === signature;
};

//Purchase Courses
const purchaseCourse = async (req, res) => {
  try {
    const {
      userId,
      courseIds,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = req.body;

    const isSignatureValid = verifyRazorpaySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isSignatureValid) {
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    const courses = await Course.find({ _id: { $in: courseIds } });

    const totalPrice = courses.reduce((sum, course) => sum + course.price, 0);

    const purchase = new Purchase({
      userId,
      items: courseIds.map((courseId) => ({ courseId })),
      purchaseDate: new Date(),
      razorpay: {
        orderId: razorpayOrderId,
        paymentId: razorpayPaymentId,
        signature: razorpaySignature,
        amount: totalPrice,
        currency: "INR",
        status: "success",
      },
    });

    await purchase.save();

    await Promise.all(
      courses.map(async (course) => {
        course.enrolled_count += 1;
        await course.save();
      })
    );

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const newCourses = courses.map((course) => ({
      course: course._id,
      enrollmentDate: new Date(),
      progress: 0,
      completionStatus: false,
    }));

    user.courses.push(...newCourses);
    await user.save();

    try {
      const cart = await Cart.findOne({ userId });
      if (cart) {
        await cart.clearCart();
      }
    } catch (cartError) {
      console.error("Error clearing user cart:", cartError);
    }

    res.status(200).json({
      message:
        "Purchase recorded successfully, courses added to user profile, and cart cleared",
      purchase,
    });
  } catch (error) {
    console.error("Purchase Processing Error:", error);
    res.status(500).json({ error: "Failed to record purchase" });
  }
};


//Get Purchased Courses
const getPurchasedCourses = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).populate({
      path: "courses.course",
      select: "title description duration course_thumbnail lessons isBanned",
      populate: {
        path: "lessons",
        select: "title duration",
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const enrolledCourses = user.courses
      .filter(
        (enrolledCourse) =>
          enrolledCourse.course != null && !enrolledCourse.course.isBanned
      )
      .map((enrolledCourse) => ({
        _id: enrolledCourse.course._id,
        title: enrolledCourse.course.title,
        description: enrolledCourse.course.description,
        duration: enrolledCourse.course.duration,
        course_thumbnail: enrolledCourse.course.course_thumbnail,
        lessons: enrolledCourse.course.lessons,
        enrollmentDate: enrolledCourse.enrollmentDate,
        progress: enrolledCourse.progress,
        completionStatus: enrolledCourse.completionStatus,
      }));

    res.status(200).json({ courses: enrolledCourses });
  } catch (error) {
    console.error("Error fetching enrolled courses:", error);
    res.status(500).json({
      message: "Failed to fetch enrolled courses",
      error: error.message,

      userId: req.params.userId,
      timestamp: new Date().toISOString(),
    });
  }
};


//Purchased Status
const checkPurchaseStatus = async (req, res) => {
  try {
    const { userId, courseId } = req.params;

    const purchase = await Purchase.findOne({
      userId,
      "items.courseId": courseId,
    });

    res.status(200).json({ isPurchased: !!purchase });
  } catch (error) {
    console.error("Error checking purchase status:", error);
    res.status(500).json({ error: "Failed to check purchase status" });
  }
};


//Get Order History
const getUserOrderHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    const purchases = await Purchase.find({ userId })
      .populate({
        path: "items.courseId",
        select: "title tutor price",
        populate: { path: "tutor", select: "full_name" },
      })
      .sort({ purchaseDate: -1 });

    const orderHistory = purchases.map((purchase) => ({
      orderId: purchase._id,
      purchaseDate: purchase.purchaseDate,
      items: purchase.items.map((item) => ({
        courseName: item.courseId.title,
        tutorName: item.courseId.tutor.full_name,
        price: item.courseId.price,
      })),
      totalAmount: purchase.items.reduce(
        (sum, item) => sum + item.courseId.price,
        0
      ),
    }));

    res.status(200).json({ orderHistory });
  } catch (error) {
    console.error("Error fetching user order history:", error);
    res.status(500).json({ error: "Failed to fetch order history" });
  }
};


//User Order Status
const getUserOrderStatus = async (req, res) => {
  try {
    const { userId, courseId } = req.params;

    const enrollment = await Purchase.findOne({
      userId: userId,
      "items.courseId": courseId,
      "razorpay.status": "success",
    });

    res.json({
      owned: !!enrollment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error checking course ownership",
      error: error.message,
    });
  }
};

//Get PAyment status List
const getPaymentStatusList = async (req, res) => {
  try {
    const {
      search,
      startDate,
      endDate,
      status,
      page = 1,
      limit = 10,
      userId 
    } = req.query;

    console.log('Received Query:', { 
      search, 
      startDate, 
      endDate, 
      status, 
      page, 
      limit, 
      userId 
    });

    const userIdToUse = userId || req.user?._id;

    if (!userIdToUse) {
      return res.status(400).json({
        success: false,
        error: "User ID is required"
      });
    }

    let query = {
      userId: userIdToUse,
    };

    if (search) {
      query["razorpay.orderId"] = { $regex: search, $options: "i" };
    }

    if (startDate || endDate) {
      query.purchaseDate = {};
      if (startDate) {
        query.purchaseDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.purchaseDate.$lte = new Date(endDate);
      }
    }
    if (status) {
      const validStatuses = ["created", "success", "failed", "pending"];
      if (validStatuses.includes(status.toLowerCase())) {
        query["razorpay.status"] = status.toLowerCase();
      }
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const payments = await Purchase.find(query)
      .populate({
        path: "userId",
        select: "phone" 
      })
      .populate({
        path: "items.courseId",
        select: "title" 
      })
      .sort({ purchaseDate: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Purchase.countDocuments(query);

    const formattedPayments = payments.map((payment) => ({
      ORDER_ID: payment.razorpay.orderId,
      ORDER_AMOUNT: payment.razorpay.amount , 
      PHONE: payment.userId?.phone || "N/A",
      COURSES: payment.items.map((item) => item.courseId?.title || "Unknown Course"),
      Date: payment.purchaseDate,
      Status: payment.razorpay.status,
    }));

    res.status(200).json({
      success: true,
      data: formattedPayments,
      pagination: {
        total,
        pages: Math.ceil(total / limitNum),
        currentPage: pageNum,
        perPage: limitNum,
      },
    });
  } catch (error) {
    console.error("Detailed Error in getPaymentStatusList:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch payment status list",
      details: error.message
    });
  }
};

//Get Enrolled Coursres
const getEnrolledCourses = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).populate({
      path: "courses.course",
      select: "title description duration course_thumbnail isBanned",
      populate: {
        path: "lessons",
        select: "title duration",
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const enrolledCourses = user.courses
      .filter(
        (enrolledCourse) =>
          enrolledCourse.course && !enrolledCourse.course.isBanned
      )
      .map((enrolledCourse) => ({
        _id: enrolledCourse.course._id,
        title: enrolledCourse.course.title,
        description: enrolledCourse.course.description,
        duration: enrolledCourse.course.duration,
        course_thumbnail: enrolledCourse.course.course_thumbnail,
        lessons: enrolledCourse.course.lessons,
        enrollmentDate: enrolledCourse.enrollmentDate,
        progress: enrolledCourse.progress,
        completionStatus: enrolledCourse.completionStatus,
      }));

    res.status(200).json({ courses: enrolledCourses });
  } catch (error) {
    console.error("Error fetching enrolled courses:", error);
    res
      .status(500)
      .json({
        message: "Failed to fetch enrolled courses",
        error: error.message,
      });
  }
};


//get Enrolled Course Details
const getEnrolledCourseDetails = async (req, res) => {
  try {
    const { userId, courseId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const enrolledCourse = user.courses.find(
      (course) => course.course.toString() === courseId
    );
    if (!enrolledCourse) {
      return res
        .status(404)
        .json({ message: "Course not found or user not enrolled" });
    }

    const course = await Course.findById(courseId).populate({
      path: "lessons",
      select: "title description duration video video_thumbnail pdf_note",
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const courseDetails = {
      _id: course._id,
      title: course.title,
      description: course.description,
      duration: course.duration,
      course_thumbnail: course.course_thumbnail,
      lessons: course.lessons,
      enrollmentDate: enrolledCourse.enrollmentDate,
      progress: enrolledCourse.progress,
      completionStatus: enrolledCourse.completionStatus,
    };

    res.status(200).json(courseDetails);
  } catch (error) {
    console.error("Error fetching enrolled course details:", error);
    res
      .status(500)
      .json({
        message: "Failed to fetch enrolled course details",
        error: error.message,
      });
  }
};
//get Enrolled Course Tutors
const getEnrolledCourseTutors = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).populate({
      path: "courses.course",
      select: "title tutor course_thumbnail",
      populate: {
        path: "tutor",
        select:
          "full_name email profile_image bio subject status lastActive courses",
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const tutorsMap = new Map();

    user.courses.forEach((enrolledCourse) => {
      const tutor = enrolledCourse.course.tutor;
      if (tutor && !tutorsMap.has(tutor._id.toString())) {
        tutorsMap.set(tutor._id.toString(), {
          _id: tutor._id,
          full_name: tutor.full_name,
          email: tutor.email,
          profile_image: tutor.profile_image,
          bio: tutor.bio,
          subject: tutor.subject,
          status: tutor.status,
          lastActive: tutor.lastActive,
          totalCourses: tutor.courses.length,
          enrolledCourses: [],
        });
      }

      if (tutor) {
        tutorsMap.get(tutor._id.toString()).enrolledCourses.push({
          _id: enrolledCourse.course._id,
          title: enrolledCourse.course.title,
          course_thumbnail: enrolledCourse.course.course_thumbnail,
          enrollmentDate: enrolledCourse.enrollmentDate,
        });
      }
    });

    const tutorsList = Array.from(tutorsMap.values());

    res.status(200).json({
      success: true,
      tutors: tutorsList,
      total: tutorsList.length,
    });
  } catch (error) {
    console.error("Error fetching enrolled course tutors:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch enrolled course tutors",
      error: error.message,
    });
  }
};


//Get All Payment Status for Admin
const getAllPaymentStatusForAdmin = async (req, res) => {
  try {
    const {
      search,
      startDate,
      endDate,
      status,
      page = 1,
      limit = 10,
      sortBy = 'purchaseDate',
      sortOrder = 'desc'
    } = req.query;

    // Construct the base query
    let query = {};

    // Search across multiple fields
    if (search) {
      query.$or = [
        { 'razorpay.orderId': { $regex: search, $options: 'i' } },
        { 'userId.full_name': { $regex: search, $options: 'i' } },
        { 'userId.email': { $regex: search, $options: 'i' } },
        { 'userId.phone': { $regex: search, $options: 'i' } }
      ];
    }

    // Date range filtering
    if (startDate || endDate) {
      query.purchaseDate = {};
      if (startDate) {
        query.purchaseDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.purchaseDate.$lte = new Date(endDate);
      }
    }

    // Payment status filtering
    if (status) {
      const validStatuses = ['created', 'success', 'failed', 'pending'];
      if (validStatuses.includes(status.toLowerCase())) {
        query['razorpay.status'] = status.toLowerCase();
      }
    }

    // Pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Aggregate query to join with user and course data
    const paymentAggregation = await Purchase.aggregate([
      // Match the query conditions
      { $match: query },
      
      // Lookup user details
      {
        $lookup: {
          from: 'users', // Mongodb collection name for users
          localField: 'userId',
          foreignField: '_id',
          as: 'userData'
        }
      },
      
      // Lookup course details
      {
        $lookup: {
          from: 'courses', // Mongodb collection name for courses
          localField: 'items.courseId',
          foreignField: '_id',
          as: 'courseData'
        }
      },
      
      // Unwind user data (assuming one user per purchase)
      { $unwind: '$userData' },
      
      // Project the final output format
      {
        $project: {
          ORDER_ID: '$razorpay.orderId',
          ORDER_AMOUNT: '$razorpay.amount',
          USERNAME: '$userData.full_name',
          USER_EMAIL: '$userData.email',
          PHONE: '$userData.phone',
          PAYMENT_STATUS: '$razorpay.status',
          COURSES: {
            $map: {
              input: '$items',
              as: 'item',
              in: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: '$courseData',
                      as: 'course',
                      cond: { $eq: ['$$course._id', '$$item.courseId'] }
                    }
                  },
                  0
                ]
              }
            }
          },
          COURSE_TITLES: {
            $map: {
              input: '$items',
              as: 'item',
              in: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: '$courseData',
                      as: 'course',
                      cond: { $eq: ['$$course._id', '$$item.courseId'] }
                    }
                  },
                  0
                ]
              }
            }
          },
          Date: '$purchaseDate'
        }
      },
      
      // Transform course data to titles
      {
        $addFields: {
          COURSES: {
            $map: {
              input: '$COURSES',
              as: 'course',
              in: '$$course.title'
            }
          }
        }
      },
      
      // Sort
      { $sort: sortOptions },
      
      // Pagination
      { $skip: skip },
      { $limit: limitNum }
    ]);

    // Get total count for pagination
    const totalPayments = await Purchase.countDocuments(query);

    res.status(200).json({
      success: true,
      data: paymentAggregation,
      pagination: {
        total: totalPayments,
        pages: Math.ceil(totalPayments / limitNum),
        currentPage: pageNum,
        perPage: limitNum,
      },
    });
  } catch (error) {
    console.error("Detailed Error in getAllPaymentStatusForAdmin:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch payment status list for admin",
      details: error.message
    });
  }
};

module.exports = {
  createRazorpayOrder,
  purchaseCourse,
  getPurchasedCourses,
  checkPurchaseStatus,
  getUserOrderHistory,
  getUserOrderStatus,
  getEnrolledCourses,
  getEnrolledCourseDetails,
  getEnrolledCourseTutors,
  getPaymentStatusList,
  getAllPaymentStatusForAdmin
};
