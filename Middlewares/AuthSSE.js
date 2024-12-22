
const jwt = require('jsonwebtoken');
const User = require('../Models/UserModel');


const authenticateSSE = async (req, res, next) => {
    const token = req.query.token;
  
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }
  
    try {
      // Verify the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Find the user
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
  
      // Attach user to request
      req.user = user;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: "Token expired" });
      }
      return res.status(401).json({ message: "Invalid token" });
    }
  };
  module.exports = authenticateSSE;