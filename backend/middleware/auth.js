// middleware/auth.js - Authentication middleware
// Located in: backend/middleware/auth.js

const jwt = require('jsonwebtoken');
const { query } = require('../config');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Verify JWT token middleware
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verify user still exists and is active
    const users = await query(
      'SELECT user_id, username, email, role, is_active FROM users WHERE user_id = ?',
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!users[0].is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    req.user = {
      userId: decoded.userId,
      username: users[0].username,
      email: users[0].email,
      role: users[0].role
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

// Role-based access control middleware
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};

// Admin only middleware
const adminOnly = requireRole('admin');

// Advisor only middleware
const advisorOnly = requireRole('advisor');

// Admin or Advisor middleware
const adminOrAdvisor = requireRole('admin', 'advisor');

module.exports = {
  verifyToken,
  requireRole,
  adminOnly,
  advisorOnly,
  adminOrAdvisor,
  JWT_SECRET
};
