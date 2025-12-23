// login.js - Authentication routes for Admin and Advisor login
// Located in: backend/login.js
// Uses config.js for database connection

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('./config');
const { JWT_SECRET, verifyToken } = require('./middleware/auth');

// Login endpoint - Admin and Advisor only
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Find user by username or email
    const users = await query(
      `SELECT u.user_id, u.username, u.email, u.password_hash, u.role, 
              u.first_name, u.last_name, u.is_active
       FROM users u 
       WHERE (u.username = ? OR u.email = ?) AND u.role IN ('admin', 'advisor')`,
      [username, username]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials or unauthorized role'
      });
    }

    const user = users[0];

    // Check if account is active
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact administrator.'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      // Log failed login attempt
      await logAuditAction(user.user_id, 'LOGIN_FAILED', 'user', user.user_id, req.ip);
      
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Get additional info based on role
    let additionalInfo = {};
    
    if (user.role === 'advisor') {
      const advisorInfo = await query(
        `SELECT a.advisor_id, a.department_id, a.office_location, 
                d.name as department_name
         FROM advisors a
         JOIN departments d ON a.department_id = d.department_id
         WHERE a.user_id = ?`,
        [user.user_id]
      );
      if (advisorInfo.length > 0) {
        additionalInfo = advisorInfo[0];
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.user_id,
        username: user.username,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Log successful login
    await logAuditAction(user.user_id, 'LOGIN_SUCCESS', 'user', user.user_id, req.ip);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          userId: user.user_id,
          username: user.username,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          ...additionalInfo
        }
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
});

// Logout endpoint
router.post('/logout', verifyToken, async (req, res) => {
  try {
    // Log logout action
    await logAuditAction(req.user.userId, 'LOGOUT', 'user', req.user.userId, req.ip);
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});

// Verify token endpoint
router.get('/verify', verifyToken, async (req, res) => {
  try {
    const users = await query(
      `SELECT u.user_id, u.username, u.email, u.role, u.first_name, u.last_name
       FROM users u WHERE u.user_id = ?`,
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];
    let additionalInfo = {};

    if (user.role === 'advisor') {
      const advisorInfo = await query(
        `SELECT a.advisor_id, a.department_id, d.name as department_name
         FROM advisors a
         JOIN departments d ON a.department_id = d.department_id
         WHERE a.user_id = ?`,
        [user.user_id]
      );
      if (advisorInfo.length > 0) {
        additionalInfo = advisorInfo[0];
      }
    }

    res.json({
      success: true,
      data: {
        user: {
          userId: user.user_id,
          username: user.username,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          ...additionalInfo
        }
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed'
    });
  }
});

// Change password endpoint
router.post('/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long'
      });
    }

    // Get current password hash
    const users = await query(
      'SELECT password_hash FROM users WHERE user_id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password and update
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await query(
      'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE user_id = ?',
      [newPasswordHash, userId]
    );

    // Log password change
    await logAuditAction(userId, 'PASSWORD_CHANGED', 'user', userId, req.ip);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
});

// Helper function to log audit actions
async function logAuditAction(userId, action, entityType, entityId, ipAddress, oldValues = null, newValues = null) {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, old_values, new_values)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, action, entityType, entityId, ipAddress, 
       oldValues ? JSON.stringify(oldValues) : null,
       newValues ? JSON.stringify(newValues) : null]
    );
  } catch (error) {
    console.error('Audit log error:', error);
  }
}

module.exports = router;
