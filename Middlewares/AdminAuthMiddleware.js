const jwt = require('jsonwebtoken');
const Admin = require('../Models/AdminModel');

const adminAuthMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies.adminToken || req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Access token missing' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const admin = await Admin.findById(decoded.id);
      
      if (!admin) {
        return res.status(401).json({ message: 'Admin not found' });
      }

      req.user = admin;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        const refreshToken = req.cookies.adminRefreshToken;
        
        if (!refreshToken) {
          return res.status(401).json({ message: 'Refresh token missing' });
        }

        try {
          const refreshDecoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
          const admin = await Admin.findById(refreshDecoded.id);
          
          if (!admin) {
            return res.status(401).json({ message: 'Admin not found' });
          }

          const newAccessToken = jwt.sign(
            { id: admin._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
          );

          const newRefreshToken = jwt.sign(
            { id: admin._id },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: '7d' }
          );

          res.cookie('adminToken', newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000
          });

          res.cookie('adminRefreshToken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000
          });

          req.user = admin;
          next();
        } catch (refreshError) {
          return res.status(401).json({ message: 'Invalid refresh token' });
        }
      } else {
        return res.status(401).json({ message: 'Invalid access token' });
      }
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = adminAuthMiddleware;