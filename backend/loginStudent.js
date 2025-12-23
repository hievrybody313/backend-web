// loginStudent.js - Student Authentication routes
// Located in: backend/loginStudent.js
// Login using student_number (ID) from students table and password from users table

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('./config');
const { JWT_SECRET, verifyToken } = require('./middleware/auth');

// Student Login endpoint - uses student_number as ID
router.post('/login', async (req, res) => {
  try {
    const { studentId, password } = req.body;

    // Validate input
    if (!studentId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Student ID and password are required'
      });
    }

    // Find student by student_number and join with users table
    const students = await query(
      `SELECT s.student_id, s.student_number, s.major_id, s.advisor_id, s.gpa,
              s.enrollment_date, s.expected_graduation, s.academic_status,
              u.user_id, u.username, u.email, u.password_hash, u.role,
              u.first_name, u.last_name, u.phone, u.is_active,
              d.name as major_name, d.code as major_code,
              CONCAT(au.first_name, ' ', au.last_name) as advisor_name,
              au.email as advisor_email,
              a.office_location as advisor_office
       FROM students s
       JOIN users u ON s.user_id = u.user_id
       JOIN departments d ON s.major_id = d.department_id
       JOIN advisors a ON s.advisor_id = a.advisor_id
       JOIN users au ON a.user_id = au.user_id
       WHERE s.student_number = ? AND u.role = 'student'`,
      [studentId]
    );

    if (students.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid student ID or password'
      });
    }

    const student = students[0];

    // Check if account is active
    if (!student.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact your advisor.'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, student.password_hash);
    if (!isValidPassword) {
      // Log failed login attempt
      await logAuditAction(student.user_id, 'STUDENT_LOGIN_FAILED', 'user', student.user_id, req.ip);
      
      return res.status(401).json({
        success: false,
        message: 'Invalid student ID or password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: student.user_id,
        studentId: student.student_id,
        studentNumber: student.student_number,
        role: 'student'
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Log successful login
    await logAuditAction(student.user_id, 'STUDENT_LOGIN_SUCCESS', 'user', student.user_id, req.ip);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          userId: student.user_id,
          studentId: student.student_id,
          studentNumber: student.student_number,
          username: student.username,
          email: student.email,
          firstName: student.first_name,
          lastName: student.last_name,
          phone: student.phone,
          role: 'student',
          majorId: student.major_id,
          majorName: student.major_name,
          majorCode: student.major_code,
          advisorId: student.advisor_id,
          advisorName: student.advisor_name,
          advisorEmail: student.advisor_email,
          advisorOffice: student.advisor_office,
          gpa: student.gpa,
          enrollmentDate: student.enrollment_date,
          expectedGraduation: student.expected_graduation,
          academicStatus: student.academic_status
        }
      }
    });

  } catch (error) {
    console.error('Student login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
});

// Logout endpoint
router.post('/logout', verifyToken, async (req, res) => {
  try {
    await logAuditAction(req.user.userId, 'STUDENT_LOGOUT', 'user', req.user.userId, req.ip);
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Student logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});

// Verify token and get student info
router.get('/verify', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Student account required.'
      });
    }

    const students = await query(
      `SELECT s.student_id, s.student_number, s.major_id, s.advisor_id, s.gpa,
              s.enrollment_date, s.expected_graduation, s.academic_status,
              u.user_id, u.username, u.email, u.first_name, u.last_name, u.phone,
              d.name as major_name, d.code as major_code,
              CONCAT(au.first_name, ' ', au.last_name) as advisor_name,
              au.email as advisor_email,
              a.office_location as advisor_office
       FROM students s
       JOIN users u ON s.user_id = u.user_id
       JOIN departments d ON s.major_id = d.department_id
       JOIN advisors a ON s.advisor_id = a.advisor_id
       JOIN users au ON a.user_id = au.user_id
       WHERE u.user_id = ?`,
      [req.user.userId]
    );

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const student = students[0];

    res.json({
      success: true,
      data: {
        user: {
          userId: student.user_id,
          studentId: student.student_id,
          studentNumber: student.student_number,
          username: student.username,
          email: student.email,
          firstName: student.first_name,
          lastName: student.last_name,
          phone: student.phone,
          role: 'student',
          majorId: student.major_id,
          majorName: student.major_name,
          majorCode: student.major_code,
          advisorId: student.advisor_id,
          advisorName: student.advisor_name,
          advisorEmail: student.advisor_email,
          advisorOffice: student.advisor_office,
          gpa: student.gpa,
          enrollmentDate: student.enrollment_date,
          expectedGraduation: student.expected_graduation,
          academicStatus: student.academic_status
        }
      }
    });
  } catch (error) {
    console.error('Student token verification error:', error);
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
    await logAuditAction(userId, 'STUDENT_PASSWORD_CHANGED', 'user', userId, req.ip);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Student change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
});

// Helper function to log audit actions
async function logAuditAction(userId, action, entityType, entityId, ipAddress) {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, action, entityType, entityId, ipAddress]
    );
  } catch (error) {
    console.error('Audit log error:', error);
  }
}

module.exports = router;
