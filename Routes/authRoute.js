const express = require('express');
const router = express.Router();
const userAuthMiddleware = require('../Middlewares/userAuthMiddleware')
const { googleAuth, tutorGoogleAuth,adminGoogleAuth } = require('../Controllers/authController');
const {refreshAccessToken} = require('../Controllers/authController')
router.post("/user/google", googleAuth);
router.post("/tutor/google", tutorGoogleAuth);
router.post("/admin/google", adminGoogleAuth );
router.post('/refresh', refreshAccessToken);
module.exports = router;