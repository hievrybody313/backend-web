// StudentDashboard.js - Backend routes for Student Dashboard
// Located in: backend/StudentDashboard.js
// Uses config.js for database connection

const express = require('express');
const router = express.Router();
const { query, getConnection } = require('./config');
const { verifyToken } = require('./middleware/auth');

// Middleware to verify student role
const studentOnly = (req, res, next) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Student account required.'
    });
  }
  next();
};

// Apply authentication to all student routes
router.use(verifyToken);
router.use(studentOnly);

// Helper to get student_id from user_id
async function getStudentId(userId) {
  const result = await query('SELECT student_id FROM students WHERE user_id = ?', [userId]);
  return result.length > 0 ? result[0].student_id : null;
}

// ==================== DASHBOARD ====================

// Get student dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    const studentId = await getStudentId(req.user.userId);
    if (!studentId) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Get current courses count
    const [currentCourses] = await query(`
      SELECT COUNT(*) as count FROM student_courses 
      WHERE student_id = ? AND status IN ('current', 'in_progress')
    `, [studentId]);

    // Get pending requests count
    const [pendingRequests] = await query(`
      SELECT COUNT(*) as count FROM course_requests 
      WHERE student_id = ? AND status = 'pending'
    `, [studentId]);

    // Get upcoming appointments
    const [upcomingAppointments] = await query(`
      SELECT COUNT(*) as count FROM appointments 
      WHERE student_id = ? AND status = 'scheduled' AND appointment_date >= NOW()
    `, [studentId]);

    // Get unread messages
    const [unreadMessages] = await query(`
      SELECT COUNT(*) as count FROM messages 
      WHERE recipient_id = ? AND is_read = 0
    `, [req.user.userId]);

    // Get recent announcements
    const announcements = await query(`
      SELECT a.*, CONCAT(u.first_name, ' ', u.last_name) as author_name
      FROM announcements a
      JOIN users u ON a.created_by = u.user_id
      WHERE a.is_active = 1 
        AND a.target_role IN ('all', 'students')
        AND (a.expires_at IS NULL OR a.expires_at > NOW())
      ORDER BY a.priority DESC, a.created_at DESC
      LIMIT 5
    `);

    // Get next appointment
    const nextAppointment = await query(`
      SELECT ap.*, CONCAT(u.first_name, ' ', u.last_name) as advisor_name
      FROM appointments ap
      JOIN advisors a ON ap.advisor_id = a.advisor_id
      JOIN users u ON a.user_id = u.user_id
      WHERE ap.student_id = ? AND ap.status = 'scheduled' AND ap.appointment_date >= NOW()
      ORDER BY ap.appointment_date ASC
      LIMIT 1
    `, [studentId]);

    // Get recent advisor notes (visible to student)
    const recentNotes = await query(`
      SELECT an.*, CONCAT(u.first_name, ' ', u.last_name) as advisor_name
      FROM advising_notes an
      JOIN advisors a ON an.advisor_id = a.advisor_id
      JOIN users u ON a.user_id = u.user_id
      WHERE an.student_id = ? AND an.is_visible_to_student = 1
      ORDER BY an.created_at DESC
      LIMIT 3
    `, [studentId]);

    res.json({
      success: true,
      data: {
        counts: {
          currentCourses: currentCourses.count,
          pendingRequests: pendingRequests.count,
          upcomingAppointments: upcomingAppointments.count,
          unreadMessages: unreadMessages.count
        },
        announcements,
        nextAppointment: nextAppointment[0] || null,
        recentNotes
      }
    });
  } catch (error) {
    console.error('Get student dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard data' });
  }
});

// ==================== PROFILE ====================

// Get student profile
router.get('/profile', async (req, res) => {
  try {
    const students = await query(`
      SELECT s.*, u.username, u.email, u.first_name, u.last_name, u.phone,
             d.name as major_name, d.code as major_code,
             CONCAT(au.first_name, ' ', au.last_name) as advisor_name,
             au.email as advisor_email, a.office_location as advisor_office,
             a.phone_extension as advisor_phone
      FROM students s
      JOIN users u ON s.user_id = u.user_id
      JOIN departments d ON s.major_id = d.department_id
      JOIN advisors a ON s.advisor_id = a.advisor_id
      JOIN users au ON a.user_id = au.user_id
      WHERE s.user_id = ?
    `, [req.user.userId]);

    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    // Get credits summary
    const creditsSummary = await query(`
      SELECT 
        SUM(CASE WHEN sc.status = 'completed' AND sc.grade NOT IN ('F', 'W', 'I') THEN c.credits ELSE 0 END) as completed,
        SUM(CASE WHEN sc.status IN ('current', 'in_progress') THEN c.credits ELSE 0 END) as in_progress
      FROM student_courses sc
      JOIN courses c ON sc.course_id = c.course_id
      WHERE sc.student_id = ?
    `, [students[0].student_id]);

    res.json({
      success: true,
      data: {
        ...students[0],
        creditsSummary: {
          completed: creditsSummary[0]?.completed || 0,
          inProgress: creditsSummary[0]?.in_progress || 0,
          required: 120 // This should come from settings
        }
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

// Update student profile (limited fields)
router.put('/profile', async (req, res) => {
  try {
    const { phone } = req.body;

    await query(
      'UPDATE users SET phone = ?, updated_at = NOW() WHERE user_id = ?',
      [phone || null, req.user.userId]
    );

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
});

// ==================== APPOINTMENTS ====================

// Get student's appointments
router.get('/appointments', async (req, res) => {
  try {
    const studentId = await getStudentId(req.user.userId);
    const { status } = req.query;

    let sql = `
      SELECT ap.*, CONCAT(u.first_name, ' ', u.last_name) as advisor_name,
             u.email as advisor_email, a.office_location
      FROM appointments ap
      JOIN advisors a ON ap.advisor_id = a.advisor_id
      JOIN users u ON a.user_id = u.user_id
      WHERE ap.student_id = ?
    `;

    const params = [studentId];

    if (status) {
      sql += ' AND ap.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY ap.appointment_date DESC';

    const appointments = await query(sql, params);

    res.json({ success: true, data: appointments });
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch appointments' });
  }
});

// Request new appointment
router.post('/appointments', async (req, res) => {
  try {
    const studentId = await getStudentId(req.user.userId);
    const { appointmentDate, meetingType, notes } = req.body;

    if (!appointmentDate) {
      return res.status(400).json({
        success: false,
        message: 'Appointment date is required'
      });
    }

    // Get student's advisor
    const students = await query('SELECT advisor_id FROM students WHERE student_id = ?', [studentId]);
    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const advisorId = students[0].advisor_id;

    // Check for conflicting appointments
    const conflicts = await query(`
      SELECT appointment_id FROM appointments 
      WHERE advisor_id = ? 
        AND appointment_date = ? 
        AND status = 'scheduled'
    `, [advisorId, appointmentDate]);

    if (conflicts.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'This time slot is already booked. Please choose another time.'
      });
    }

    const result = await query(
      `INSERT INTO appointments (student_id, advisor_id, appointment_date, meeting_type, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [studentId, advisorId, appointmentDate, meetingType || 'in_person', notes || null]
    );

    res.status(201).json({
      success: true,
      message: 'Appointment requested successfully',
      data: { appointmentId: result.insertId }
    });
  } catch (error) {
    console.error('Request appointment error:', error);
    res.status(500).json({ success: false, message: 'Failed to request appointment' });
  }
});

// Cancel appointment
router.put('/appointments/:id/cancel', async (req, res) => {
  try {
    const studentId = await getStudentId(req.user.userId);
    const appointmentId = req.params.id;

    // Verify appointment belongs to student
    const appointments = await query(
      'SELECT appointment_id FROM appointments WHERE appointment_id = ? AND student_id = ?',
      [appointmentId, studentId]
    );

    if (appointments.length === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    await query(
      "UPDATE appointments SET status = 'cancelled', updated_at = NOW() WHERE appointment_id = ?",
      [appointmentId]
    );

    res.json({ success: true, message: 'Appointment cancelled successfully' });
  } catch (error) {
    console.error('Cancel appointment error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel appointment' });
  }
});

// ==================== COURSE REQUESTS ====================

// Get available courses for registration
router.get('/courses/available', async (req, res) => {
  try {
    const studentId = await getStudentId(req.user.userId);
    const { semester } = req.query;

    // Get student's completed courses
    const completedCourses = await query(`
      SELECT course_id FROM student_courses 
      WHERE student_id = ? AND status = 'completed' AND grade NOT IN ('F', 'W', 'I')
    `, [studentId]);

    const completedIds = completedCourses.map(c => c.course_id);

    // Get student's current enrollments
    const currentEnrollments = await query(`
      SELECT course_id FROM student_courses 
      WHERE student_id = ? AND status IN ('current', 'in_progress')
    `, [studentId]);

    const currentIds = currentEnrollments.map(c => c.course_id);

    // Get pending requests
    const pendingRequests = await query(`
      SELECT course_id FROM course_requests 
      WHERE student_id = ? AND status = 'pending'
    `, [studentId]);

    const pendingIds = pendingRequests.map(c => c.course_id);

    // Get available courses
    let sql = `
      SELECT c.*, d.name as department_name,
             (SELECT COUNT(*) FROM student_courses sc WHERE sc.course_id = c.course_id AND sc.status = 'current') as enrolled_count
      FROM courses c
      JOIN departments d ON c.department_id = d.department_id
      WHERE c.is_active = 1
    `;

    if (semester) {
      sql += ` AND (c.semester = '${semester}' OR c.semester IS NULL)`;
    }

    sql += ' ORDER BY c.code';

    const courses = await query(sql);

    // Add prerequisites and availability status
    for (let course of courses) {
      // Get prerequisites
      const prereqs = await query(`
        SELECT c.course_id, c.code, c.name
        FROM course_prerequisites cp
        JOIN courses c ON cp.prerequisite_course_id = c.course_id
        WHERE cp.course_id = ?
      `, [course.course_id]);

      course.prerequisites = prereqs;

      // Check if prerequisites are met
      course.prerequisitesMet = prereqs.every(p => completedIds.includes(p.course_id));

      // Check availability
      course.isEnrolled = currentIds.includes(course.course_id);
      course.isCompleted = completedIds.includes(course.course_id);
      course.hasPendingRequest = pendingIds.includes(course.course_id);
      course.hasCapacity = !course.capacity || course.enrolled_count < course.capacity;
    }

    res.json({ success: true, data: courses });
  } catch (error) {
    console.error('Get available courses error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch courses' });
  }
});

// Get student's course requests
router.get('/course-requests', async (req, res) => {
  try {
    const studentId = await getStudentId(req.user.userId);
    const { status } = req.query;

    let sql = `
      SELECT cr.*, c.code, c.name as course_name, c.credits,
             CONCAT(u.first_name, ' ', u.last_name) as approved_by_name
      FROM course_requests cr
      JOIN courses c ON cr.course_id = c.course_id
      LEFT JOIN advisors a ON cr.approved_by = a.advisor_id
      LEFT JOIN users u ON a.user_id = u.user_id
      WHERE cr.student_id = ?
    `;

    const params = [studentId];

    if (status) {
      sql += ' AND cr.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY cr.request_date DESC';

    const requests = await query(sql, params);

    res.json({ success: true, data: requests });
  } catch (error) {
    console.error('Get course requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch course requests' });
  }
});

// Submit course request
router.post('/course-requests', async (req, res) => {
  try {
    const studentId = await getStudentId(req.user.userId);
    const { courseId, requestType, requestedSemester } = req.body;

    if (!courseId || !requestType || !requestedSemester) {
      return res.status(400).json({
        success: false,
        message: 'Course ID, request type, and semester are required'
      });
    }

    // Check for existing enrollment
    const enrollment = await query(`
      SELECT enrollment_id FROM student_courses 
      WHERE student_id = ? AND course_id = ? AND status IN ('current', 'in_progress', 'completed')
    `, [studentId, courseId]);

    if (enrollment.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'You are already enrolled in or have completed this course'
      });
    }

    // Auto-register the student (Direct Registration)
    // 1. Insert into student_courses
    await query(
      `INSERT INTO student_courses (student_id, course_id, semester, status)
       VALUES (?, ?, ?, 'current')`,
      [studentId, courseId, requestedSemester]
    );

    // 2. Insert into course_requests as 'approved' for history/logging
    const result = await query(
      `INSERT INTO course_requests (student_id, course_id, request_type, requested_semester, status, decision_date)
       VALUES (?, ?, ?, ?, 'approved', NOW())`,
      [studentId, courseId, requestType, requestedSemester]
    );

    res.status(201).json({
      success: true,
      message: 'Course registered successfully',
      data: { requestId: result.insertId }
    });
  } catch (error) {
    console.error('Submit course request error:', error);
    res.status(500).json({ success: false, message: 'Failed to register course' });
  }
});

// Cancel course request
router.delete('/course-requests/:id', async (req, res) => {
  try {
    const studentId = await getStudentId(req.user.userId);
    const requestId = req.params.id;

    // Verify request belongs to student and is pending
    const requests = await query(
      "SELECT request_id FROM course_requests WHERE request_id = ? AND student_id = ? AND status = 'pending'",
      [requestId, studentId]
    );

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found or cannot be cancelled'
      });
    }

    await query('DELETE FROM course_requests WHERE request_id = ?', [requestId]);

    res.json({ success: true, message: 'Request cancelled successfully' });
  } catch (error) {
    console.error('Cancel course request error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel request' });
  }
});

// ==================== ACADEMIC PLAN ====================

// Get academic plan (all courses)
router.get('/academic-plan', async (req, res) => {
  try {
    const studentId = await getStudentId(req.user.userId);

    // Get all enrolled courses
    const courses = await query(`
      SELECT sc.*, c.code, c.name, c.credits, c.description,
             d.name as department_name
      FROM student_courses sc
      JOIN courses c ON sc.course_id = c.course_id
      JOIN departments d ON c.department_id = d.department_id
      WHERE sc.student_id = ?
      ORDER BY sc.semester DESC, c.code
    `, [studentId]);

    // Group by status
    const currentCourses = courses.filter(c => c.status === 'current' || c.status === 'in_progress');
    const completedCourses = courses.filter(c => c.status === 'completed');
    const droppedCourses = courses.filter(c => c.status === 'dropped');

    // Calculate GPA
    const gradePoints = {
      'A+': 4.0, 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7,
      'C+': 2.3, 'C': 2.0, 'C-': 1.7, 'D+': 1.3, 'D': 1.0, 'D-': 0.7, 'F': 0
    };

    let totalPoints = 0;
    let totalCredits = 0;

    completedCourses.forEach(c => {
      if (c.grade && gradePoints[c.grade] !== undefined) {
        totalPoints += gradePoints[c.grade] * c.credits;
        totalCredits += c.credits;
      }
    });

    const calculatedGPA = totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : null;

    // Credits summary
    const completedCredits = completedCourses
      .filter(c => c.grade && !['F', 'W', 'I'].includes(c.grade))
      .reduce((sum, c) => sum + c.credits, 0);

    const currentCredits = currentCourses.reduce((sum, c) => sum + c.credits, 0);

    // Get all courses with prerequisites info
    // Fetching all active courses since the database is curated for the specific program
    const allCourses = await query(`
        SELECT c.*, d.name as department_name 
        FROM courses c
        JOIN departments d ON c.department_id = d.department_id
        WHERE c.is_active = 1
        ORDER BY c.code
    `);

    // Filter for remaining courses
    const enrolledCourseIds = courses.map(c => c.course_id);
    const remainingCourses = allCourses.filter(c => !enrolledCourseIds.includes(c.course_id));

    res.json({
      success: true,
      data: {
        currentCourses,
        completedCourses,
        droppedCourses,
        remainingCourses,
        summary: {
          completedCredits,
          currentCredits,
          requiredCredits: 120,
          remainingCredits: Math.max(0, 120 - completedCredits),
          gpa: calculatedGPA,
          progressPercent: Math.round((completedCredits / 120) * 100)
        }
      }
    });
  } catch (error) {
    console.error('Get academic plan error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch academic plan' });
  }
});

// ==================== ADVISOR FEEDBACK ====================

// Get advisor notes/feedback
router.get('/feedback', async (req, res) => {
  try {
    const studentId = await getStudentId(req.user.userId);

    const notes = await query(`
      SELECT an.*, CONCAT(u.first_name, ' ', u.last_name) as advisor_name
      FROM advising_notes an
      JOIN advisors a ON an.advisor_id = a.advisor_id
      JOIN users u ON a.user_id = u.user_id
      WHERE an.student_id = ? AND an.is_visible_to_student = 1
      ORDER BY an.created_at DESC
    `, [studentId]);

    res.json({ success: true, data: notes });
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch feedback' });
  }
});

// ==================== MESSAGING ====================

// Get messages
router.get('/messages', async (req, res) => {
  try {
    const { type = 'inbox' } = req.query;

    let sql;
    if (type === 'inbox') {
      sql = `
        SELECT m.*, CONCAT(u.first_name, ' ', u.last_name) as sender_name, u.role as sender_role
        FROM messages m
        JOIN users u ON m.sender_id = u.user_id
        WHERE m.recipient_id = ?
        ORDER BY m.created_at DESC
      `;
    } else {
      sql = `
        SELECT m.*, CONCAT(u.first_name, ' ', u.last_name) as recipient_name
        FROM messages m
        JOIN users u ON m.recipient_id = u.user_id
        WHERE m.sender_id = ?
        ORDER BY m.created_at DESC
      `;
    }

    const messages = await query(sql, [req.user.userId]);

    res.json({ success: true, data: messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
});

// Send message to advisor
router.post('/messages', async (req, res) => {
  try {
    const studentId = await getStudentId(req.user.userId);
    const { subject, content } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    // Get advisor's user_id
    const students = await query(`
      SELECT a.user_id as advisor_user_id
      FROM students s
      JOIN advisors a ON s.advisor_id = a.advisor_id
      WHERE s.student_id = ?
    `, [studentId]);

    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'Advisor not found' });
    }

    await query(
      `INSERT INTO messages (sender_id, recipient_id, subject, content)
       VALUES (?, ?, ?, ?)`,
      [req.user.userId, students[0].advisor_user_id, subject || null, content]
    );

    res.status(201).json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
});

// Mark message as read
router.put('/messages/:id/read', async (req, res) => {
  try {
    const messageId = req.params.id;

    await query(
      'UPDATE messages SET is_read = 1, read_at = NOW() WHERE message_id = ? AND recipient_id = ?',
      [messageId, req.user.userId]
    );

    res.json({ success: true, message: 'Message marked as read' });
  } catch (error) {
    console.error('Mark message read error:', error);
    res.status(500).json({ success: false, message: 'Failed to update message' });
  }
});

// ==================== ANNOUNCEMENTS ====================

// Get announcements
router.get('/announcements', async (req, res) => {
  try {
    const announcements = await query(`
      SELECT a.*, CONCAT(u.first_name, ' ', u.last_name) as author_name
      FROM announcements a
      JOIN users u ON a.created_by = u.user_id
      WHERE a.is_active = 1 
        AND a.target_role IN ('all', 'students')
        AND (a.expires_at IS NULL OR a.expires_at > NOW())
      ORDER BY a.priority DESC, a.created_at DESC
    `);

    res.json({ success: true, data: announcements });
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch announcements' });
  }
});

// ==================== SCHEDULE ====================

// Get course schedule
router.get('/schedule', async (req, res) => {
  try {
    const studentId = await getStudentId(req.user.userId);

    // Get current courses
    const courses = await query(`
      SELECT sc.*, c.code, c.name, c.credits, c.semester as course_semester,
             d.name as department_name
      FROM student_courses sc
      JOIN courses c ON sc.course_id = c.course_id
      JOIN departments d ON c.department_id = d.department_id
      WHERE sc.student_id = ? AND sc.status IN ('current', 'in_progress')
      ORDER BY c.code
    `, [studentId]);

    // Get upcoming appointments
    const appointments = await query(`
      SELECT ap.*, CONCAT(u.first_name, ' ', u.last_name) as advisor_name,
             a.office_location
      FROM appointments ap
      JOIN advisors a ON ap.advisor_id = a.advisor_id
      JOIN users u ON a.user_id = u.user_id
      WHERE ap.student_id = ? AND ap.status = 'scheduled' AND ap.appointment_date >= NOW()
      ORDER BY ap.appointment_date
    `, [studentId]);

    res.json({
      success: true,
      data: {
        courses,
        appointments
      }
    });
  } catch (error) {
    console.error('Get schedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch schedule' });
  }
});

module.exports = router;
