const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
  },
  otp: {
    type: String,
    required: true,
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
    expires: '2m',
  }, 
});
module.exports = mongoose.model("OTP", otpSchema);