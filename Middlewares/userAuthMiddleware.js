const jwt = require('jsonwebtoken');
const User = require('../Models/UserModel');

const userAuthMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1]|| req.query.token;

    if (!token) {
      return res.status(401).json({ message: 'Access token missing' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      if (!user.status) {
        return res.status(403).json({ 
          message: 'Account blocked. Contact support.',
          code: 'ACCOUNT_BLOCKED'
        });
      }

      req.user = user;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        const refreshToken = req.cookies.refreshToken;
        
        if (!refreshToken) {
          return res.status(401).json({ message: 'Refresh token missing' });
        }

        try {
          const refreshDecoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
          const user = await User.findById(refreshDecoded.id);
          
          if (!user) {
            return res.status(401).json({ message: 'User not found' });
          }

          const newAccessToken = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
          );

          const newRefreshToken = jwt.sign(
            { id: user._id },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: '7d' }
          );

          res.cookie('token', newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000
          });

          res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000
          });

          req.user = user;
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

module.exports = userAuthMiddleware;