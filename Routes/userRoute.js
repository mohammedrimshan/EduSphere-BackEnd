const express = require("express");
const {
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
  markNotificationAsRead,
  Pushnotification,
  notificationStream,
  getQuizByCourse,
  getUserProfile,
  getTutorInfo,
  getTutorDetails,
  getAllTutors,
  searchCourses
} = require("../Controllers/userController");
const { submitCourseReport } = require("../Controllers/reportController");
const { getAllCategories } = require("../Controllers/adminController");
const {
  getCourseById,
  getCourses,
  getCourseByCategory,
} = require("../Controllers/courseController");
const {
  addToCart,
  removeFromCart,
  clearUserCart,
  getUserCart,
  cartCount,
} = require("../Controllers/cartController");
const { sendContactEmail } = require('../Controllers/contact');
const {
  purchaseCourse,
  getPurchasedCourses,
  checkPurchaseStatus,
  getUserOrderHistory,
  createRazorpayOrder,
  getUserOrderStatus,
  getEnrolledCourses,
  getEnrolledCourseDetails,
  getEnrolledCourseTutors,
  getPaymentStatusList,
  reportCourse,
} = require("../Controllers/paymentController");
const userAuthMiddleware = require("../Middlewares/userAuthMiddleware");
const {
  issueCertificate,
  getCertificateDetails,
  getUserCertificates,
} = require("../Controllers/quizController");
const {
  createReview,
  getCourseReviews,
  getUserReviews,
  getUserReviewStats,
  editReview,
  deleteReview,
  toggleHelpfulVote,
  reportReview,
} = require("../Controllers/reviewController");

const {
  updateProgress,
  getProgress,
  getCourseProgress,
} = require("../Controllers/progressController");

const {
  addToWishlist,
  removeFromWishlist,
  getWishlist,
  checkWishlistStatus,
} = require("../Controllers/wishlistController");

const {
  markMessageAsRead,
  getMessagesByChatId,
  createMessage,
  createChat,
  getTutorsByUserId,
  getChatsByUserId,
  deleteChat,
  deleteMessage
} = require("../Controllers/chatController");

const {
  userGetRefunds,
  requestRefund,
  userGetRefundDetails,
  getWalletDetails,
} = require("../Controllers/refundController");

const router = express.Router();

// Public routes (no authentication required)
router
  .post("/signup", signUp)
  .post("/login", login)
  .post("/send-otp", sendOtp)
  .post("/verify-otp", verifyOtp)
  .post("/resend-otp", resendOtp)
  .post("/forgot-password", forgotPassword)
  .post("/reset-password", resetPassword)
  .get("/verify-reset-token/:token", verifyResetToken)
  .post("/auth/google", async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ message: "Token is missing" });
      }

      const userData = await googleAuth(token);

      if (!userData) {
        return res.status(500).json({ message: "User authentication failed" });
      }

      res.status(200).json({
        user: userData.user,
        token: userData.token,
      });
    } catch (error) {
      console.error("Error during Google login:", error);
      res.status(500).json({ message: "Google login failed" });
    }
  });

// Apply middleware for protected routes
router.use(userAuthMiddleware);

// Protected routes (require authentication)
router
  .put("/update", updateUser)
  .get("/courses", getCourses)
  .get("/categories", getAllCategories)
  .get("/courses/:courseId", getCourseById)
  .post("/:userId/cartadd", addToCart)
  .delete("/:userId/cartclear", clearUserCart)
  .get("/:userId/cart", getUserCart)
  .delete("/:userId/cartremove", removeFromCart);

// Payment-related routes
router
  // Purchase single or multiple courses
  .post("/purchase-courses", purchaseCourse)
  // Fetch all purchased courses for a user
  .get("/:userId/purchased-courses", getPurchasedCourses)
  // Check if a user has purchased a specific course
  .get("/:userId/purchase-status/:courseId", checkPurchaseStatus)
  // Fetch order history for a user
  .get("/:userId/order-history", getUserOrderHistory)
  .delete("/clear/:userId", clearUserCart)
  .get("/check-course-ownership/:userId/:courseId", getUserOrderStatus)
  // Report a purchased course
  //.post("/report-course", reportCourse);
  .post("/create-razorpay-order", createRazorpayOrder)
  .get("/:userId/enrolled-courses", getEnrolledCourses)
  .get("/enrolled-tutors/:userId", getEnrolledCourseTutors)
  .get("/:userId/enrolled-courses/:courseId", getEnrolledCourseDetails)
  .get("/notifications", fetchNotifications)
  .post("/notifications/register-token", Pushnotification)
  .put("/notifications/:notificationId/read", markNotificationAsRead)
  .get("/notifications/stream", notificationStream)
  .get("/courses/:courseId/quiz", getQuizByCourse)
  .get("/profile", getUserProfile)
  .post("/certificate", issueCertificate) // Issue a certificate
  .get("/certificate/:userId", getUserCertificates) // Get all certificates for a specific user
  .get("/certificate/:certificateId", getCertificateDetails) // Get details of a specific certificate
  .get("/cart/count", cartCount)
  .post("/courses/:courseId/review", createReview) // Create a new review
  .get("/courses/:courseId/reviews", getCourseReviews) // Get course reviews
  .get("/reviews", getUserReviews) // Get user's reviews
  .get("/review-stats", getUserReviewStats) // Get user's review statistics
  .put("/reviews/:reviewId", editReview) // Edit a review
  .delete("/reviews/:reviewId", deleteReview) // Delete a review
  .post("/reviews/:reviewId/helpful", toggleHelpfulVote) // Toggle helpful vote
  .post("/courses/:courseId/report", submitCourseReport)
  .get("/category/:categoryId/courses", getCourseByCategory)
  .post("/video-progress/update", updateProgress)
  .get("/video-progress/:userId/:courseId/:lessonId", getProgress)
  .get("/course/:userId/:courseId", getCourseProgress)
  .get("/payments/status", getPaymentStatusList)
  .post("/addwishlist", addToWishlist)
  .delete("/removewishlist/:courseId", removeFromWishlist)
  .get("/fullwishlist", getWishlist)
  .get("/wishliststatus/:courseId", checkWishlistStatus)
  .get("/student/chats/:user_id", getChatsByUserId)
  // Get tutors they can chat with
  .get("/student/tutors/:user_id", getTutorsByUserId)
  // Create a new chat (for students initiating chat)
  .post("/student/chat/create", createChat)
  // Send a message
  .post("/student/message", createMessage)
  // Get messages for a specific chat
  .get("/student/messages/:chat_id", getMessagesByChatId)
  // Mark messages as read
  .patch("/student/mark-read", markMessageAsRead)
  // Routes that can be used by both students and tutors
  .delete("/chat/delete/:chat_id", deleteChat)
  .get("/tutor-info/:tutorId", getTutorInfo)
  .post("/request-refund", requestRefund)
  .get("/myrefunds", userGetRefunds)
  .get("/myrefund/:refundId", userGetRefundDetails)
  .get("/wallet", getWalletDetails)
  .get("/alltutors", getAllTutors)
  .get("/tutors/:tutorId", getTutorDetails)
  .get('/search', searchCourses)
  .post('/contact', sendContactEmail)
  .delete('/messages/:chat_id/:message_id', deleteMessage);
module.exports = router;
