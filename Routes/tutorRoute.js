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
  updateTutor,
  getUserInfo,
  calculateTutorRevenue,
  getTutorDashboardData,
  fetchTutorNotifications,
  tutorPushNotification,
  markTutorNotificationAsRead,
  tutorNotificationStream
} = require("../Controllers/tutorController");
const {
  addCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  addLesson,
  getLessons,
  deleteLesson,
  getLessonById,
  updateLesson,
  getLessonsbyCourse,
  submitCourse,
  toggleCourseListing,
} = require("../Controllers/courseController");

const {
  addQuiz,
  getQuizByCourse,
  updateQuiz,
  deleteQuizQuestion,
} = require("../Controllers/quizController");

const {
  getTutorReviews,
  getTutorReviewStats,
  addTutorResponse,
} = require("../Controllers/reviewController");

const {
  markMessageAsRead,
  getMessagesByChatId,
  createMessage,
  createChat,
  getUsersByTutorId,
  getChatsByUserId,
  deleteChat,
  deleteMessage
} = require("../Controllers/chatController");

const { getCourseReports } = require("../Controllers/reportController");
const { getAllCategories } = require("../Controllers/adminController");
const router = express.Router();
const tutorAuthMiddleware = require("../Middlewares/tutorAuthMiddleware");

// Public routes (no authentication required)
router
  .post("/signup", signUp)
  .post("/login", login)
  .post("/send-otp", sendOtp)
  .post("/verify-otp", verifyOtp)
  .post("/resend-otp", resendOtp)
  .post("/forgot-password", forgotPassword)
  .post("/tutorreset-password", resetPassword)
  .get("/verify-reset-token/:token", verifyResetToken);

// Apply middleware for protected routes
router.use(tutorAuthMiddleware);

// Protected routes (require authentication)
router
  .put("/update", updateTutor)
  // Course management routes
  .post("/addcourse", addCourse)
  .get("/courses", getCourses)
  .get("/categories", getAllCategories)
  .get("/courses/:courseId", getCourseById)
  .put("/courses/:courseId", updateCourse)
  .patch("/courses/:id", toggleCourseListing)
  .delete("/courses/:courseId", deleteCourse)
  // Lesson management routes
  .post("/addlesson/:courseId", addLesson)
  .delete("/lessons/:lessonId", deleteLesson)
  .get("/lessons/:courseId", getLessonsbyCourse)
  .get("/lessons", getLessons)
  .get("/getlesson/:id", getLessonById)
  .put("/lessons/:lessonId", updateLesson)
  .post("/submit-course/:courseId", submitCourse)
  .post("/courses/:courseId/quiz", addQuiz)
  .get("/courses/:courseId/quiz", getQuizByCourse)
  .put("/courses/:courseId/quiz", updateQuiz)
  .delete("/courses/:courseId/quiz/:questionId", deleteQuizQuestion)
  .get("/reviews", getTutorReviews) // Get reviews for tutor's courses
  .get("/review-stats", getTutorReviewStats) // Get review statistics
  .post("/reviews/:reviewId/respond", addTutorResponse) // Add response to a review
  .get("/courses/:courseId/reports", getCourseReports)
  // Tutor-specific chat routes
  .get("/tutor/chats/:tutor_id", getChatsByUserId)
  // Get students in their courses
  .get("/tutor/students/:tutor_id", getUsersByTutorId)
  // Create a new chat (for tutors initiating chat)
  .post("/tutor/chat/create", createChat)
  // Send a message
  .post("/tutor/message", createMessage)
  // Get messages for a specific chat
  .get("/tutor/messages/:chat_id", getMessagesByChatId)
  // Mark messages as read
  .patch("/tutor/mark-read", markMessageAsRead)
  // Routes that can be used by both students and tutors
.delete('/chat/delete/:chat_id', deleteChat)
.get("/user-info/:userId", getUserInfo)
.get('/revenue-dashboard',calculateTutorRevenue)
.get('/dashboard',  getTutorDashboardData)
.delete('/messages/:chat_id/:message_id', deleteMessage)
.get("/notifications", fetchTutorNotifications)
.post("/notifications/register-token", tutorPushNotification)
.put("/notifications/:notificationId/read", markTutorNotificationAsRead)
.get("/notifications/stream", tutorNotificationStream)
module.exports = router;
