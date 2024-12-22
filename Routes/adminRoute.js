const express = require("express");
const router = express.Router();
const {
  adminLogin,
  adminLogout,
  AdminForgotPassword,
  AdminResetPassword,
  getAllUsers,
  toggleUserStatus,
  getAllTutors,
  toggleTutorStatus,
  getDashboardStats,
  verifyResetToken,
  searchUsersAndTutors,
  addCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
  toggleCategoryVisibility,
  blockCourse,
  getDashboardStatus
} = require("../Controllers/adminController");
const {
  adminGetAllRefunds,
  adminGetRefundDetails,
  adminProcessRefund
} = require('../Controllers/refundController')

const {updateReportStatus,getAllReportedCourses,getCourseReports,courseBan} = require('../Controllers/reportController')
const {getCourses,getCourseById} = require('../Controllers/courseController');
const {getAllPaymentStatusForAdmin} = require('../Controllers/paymentController')
const adminAuthMiddleware = require('../Middlewares/AdminAuthMiddleware');

// Public routes (no authentication required)
router
  .post("/login", adminLogin)
  .post("/forgot-password", AdminForgotPassword)
  .post("/adminreset-password", AdminResetPassword)
  .get("/verify-reset-token/:token", verifyResetToken);

// Apply middleware for protected routes
router.use(adminAuthMiddleware);

// Protected routes (require authentication)
router
  // Logout route
  .post("/logout", adminLogout)

  // User management routes
  .get("/users", getAllUsers)
  .patch("/users/:userId/toggle-status", toggleUserStatus)

  // Tutor management routes
  .get("/tutors", getAllTutors)
  .patch("/tutors/:tutorId/toggle-status", toggleTutorStatus)

  // Dashboard and search routes
  .get("/dashboard-stats", getDashboardStats)
  .get("/search", searchUsersAndTutors)

  // Category management routes
  .post('/addcategory', addCategory)
  .get('/categories', getAllCategories)
  .put('/categories/:id', updateCategory)
  .delete('/categories/:id', deleteCategory)
  .patch('/categories/:id/toggle-visibility', toggleCategoryVisibility)

  // Course management routes
  .get('/courses', getCourses)
  .patch("/block/:courseId", blockCourse)
  .patch("/reportstate/:reportId", updateReportStatus)
  .get('/reported-courses',getAllReportedCourses)
  .get("/courses/:courseId/reports", getCourseReports)
  .patch('/courses/:courseId/ban',courseBan)
  .get('/payments',getAllPaymentStatusForAdmin)
  .get('/refunds',adminGetAllRefunds)
  .get('/refund/:refundId',adminGetRefundDetails)
  .post('/refund/:refundId/process',adminProcessRefund)
  .get("/courses/:courseId", getCourseById)
  .get('/dashboardstatus', getDashboardStatus);
module.exports = router;