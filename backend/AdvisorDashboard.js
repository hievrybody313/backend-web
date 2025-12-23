// AdvisorDashboard.js - Backend routes for Advisor Dashboard
// Located in: backend/AdvisorDashboard.js
// Uses config.js for database connection

const express = require('express');
const router = express.Router();
const { query, getConnection } = require('./config');
const { verifyToken, advisorOnly } = require('./middleware/auth');

// Apply authentication to all advisor routes
router.use(verifyToken);
router.use(advisorOnly);

// Helper to get advisor_id from user_id
async function getAdvisorId(userId) {
  const result = await query('SELECT advisor_id FROM advisors WHERE user_id = ?', [userId]);
  return result.length > 0 ? result[0].advisor_id : null;
}

// ==================== ASSIGNED STUDENTS ====================

// Get all assigned students
router.get('/students', async (req, res) => {
  try {
    const advisorId = await getAdvisorId(req.user.userId);
    if (!advisorId) {
      return res.status(404).json({ success: false, message: 'Advisor profile not found' });
    }

    const { status, search } = req.query;

    let sql = `
      SELECT s.student_id, s.student_number, s.gpa, s.enrollment_date,
             s.expected_graduation, s.academic_status,
             u.user_id, u.username, u.email, u.first_name, u.last_name, u.phone,
             d.name as major_name,
             (SELECT COUNT(*) FROM student_courses sc WHERE sc.student_id = s.student_id AND sc.status = 'current') as current_courses,
             (SELECT COUNT(*) FROM student_courses sc WHERE sc.student_id = s.student_id AND sc.status = 'completed') as completed_courses
      FROM students s
      JOIN users u ON s.user_id = u.user_id
      JOIN departments d ON s.major_id = d.department_id
      WHERE s.advisor_id = ?
    `;

    const params = [advisorId];

    if (status) {
      sql += ' AND s.academic_status = ?';
      params.push(status);
    }

    if (search) {
      sql += ` AND (u.first_name LIKE ? OR u.last_name LIKE ? OR s.student_number LIKE ? OR u.email LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    sql += ' ORDER BY u.last_name, u.first_name';

    const students = await query(sql, params);

    res.json({ success: true, data: students });
  } catch (error) {
    console.error('Get assigned students error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch students' });
  }
});

// ==================== STUDENT PROFILES ====================

// Get detailed student profile
router.get('/students/:id', async (req, res) => {
  try {
    const advisorId = await getAdvisorId(req.user.userId);
    const studentId = req.params.id;

    // Verify student is assigned to this advisor
    const students = await query(`
      SELECT s.*, u.username, u.email, u.first_name, u.last_name, u.phone,
             d.name as major_name, d.code as major_code
      FROM students s
      JOIN users u ON s.user_id = u.user_id
      JOIN departments d ON s.major_id = d.department_id
      WHERE s.student_id = ? AND s.advisor_id = ?
    `, [studentId, advisorId]);

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found or not assigned to you'
      });
    }

    const student = students[0];

    // Get academic history (all courses)
    const courses = await query(`
      SELECT sc.*, c.code, c.name, c.credits, c.description,
             d.name as department_name
      FROM student_courses sc
      JOIN courses c ON sc.course_id = c.course_id
      JOIN departments d ON c.department_id = d.department_id
      WHERE sc.student_id = ?
      ORDER BY sc.semester DESC, c.code
    `, [studentId]);

    // Get advising notes for this student (by this advisor)
    const notes = await query(`
      SELECT * FROM advising_notes
      WHERE student_id = ? AND advisor_id = ?
      ORDER BY created_at DESC
    `, [studentId, advisorId]);

    // Get pending course requests
    const pendingRequests = await query(`
      SELECT cr.*, c.code, c.name, c.credits
      FROM course_requests cr
      JOIN courses c ON cr.course_id = c.course_id
      WHERE cr.student_id = ? AND cr.status = 'pending'
      ORDER BY cr.request_date DESC
    `, [studentId]);

    // Get upcoming appointments
    const appointments = await query(`
      SELECT * FROM appointments
      WHERE student_id = ? AND advisor_id = ? AND appointment_date >= NOW() AND status = 'scheduled'
      ORDER BY appointment_date
    `, [studentId, advisorId]);

    // Calculate credits
    const completedCredits = courses
      .filter(c => c.status === 'completed' && c.grade && !['F', 'W', 'I'].includes(c.grade))
      .reduce((sum, c) => sum + c.credits, 0);

    const currentCredits = courses
      .filter(c => c.status === 'current' || c.status === 'in_progress')
      .reduce((sum, c) => sum + c.credits, 0);

    res.json({
      success: true,
      data: {
        ...student,
        academicHistory: courses,
        advisingNotes: notes,
        pendingRequests,
        upcomingAppointments: appointments,
        creditsSummary: {
          completed: completedCredits,
          current: currentCredits
        }
      }
    });
  } catch (error) {
    console.error('Get student profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch student profile' });
  }
});

// ==================== APPOINTMENT MANAGEMENT ====================

// Get advisor's appointments
router.get('/appointments', async (req, res) => {
  try {
    const advisorId = await getAdvisorId(req.user.userId);
    const { status, startDate, endDate } = req.query;

    let sql = `
      SELECT ap.*, 
             CONCAT(u.first_name, ' ', u.last_name) as student_name,
             s.student_number, u.email as student_email
      FROM appointments ap
      JOIN students s ON ap.student_id = s.student_id
      JOIN users u ON s.user_id = u.user_id
      WHERE ap.advisor_id = ?
    `;

    const params = [advisorId];

    if (status) {
      sql += ' AND ap.status = ?';
      params.push(status);
    }
    if (startDate) {
      sql += ' AND ap.appointment_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND ap.appointment_date <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY ap.appointment_date DESC';

    const appointments = await query(sql, params);

    res.json({ success: true, data: appointments });
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch appointments' });
  }
});

// Get upcoming appointments
router.get('/appointments/upcoming', async (req, res) => {
  try {
    const advisorId = await getAdvisorId(req.user.userId);

    const appointments = await query(`
      SELECT ap.*, 
             CONCAT(u.first_name, ' ', u.last_name) as student_name,
             s.student_number
      FROM appointments ap
      JOIN students s ON ap.student_id = s.student_id
      JOIN users u ON s.user_id = u.user_id
      WHERE ap.advisor_id = ? AND ap.status = 'scheduled' AND ap.appointment_date >= NOW()
      ORDER BY ap.appointment_date
      LIMIT 10
    `, [advisorId]);

    res.json({ success: true, data: appointments });
  } catch (error) {
    console.error('Get upcoming appointments error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch appointments' });
  }
});

// Accept/Reject appointment request
router.put('/appointments/:id/status', async (req, res) => {
  try {
    const advisorId = await getAdvisorId(req.user.userId);
    const appointmentId = req.params.id;
    const { status, notes } = req.body;

    if (!['scheduled', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Use scheduled or cancelled.'
      });
    }

    // Verify appointment belongs to this advisor
    const appointments = await query(
      'SELECT appointment_id FROM appointments WHERE appointment_id = ? AND advisor_id = ?',
      [appointmentId, advisorId]
    );

    if (appointments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    await query(
      'UPDATE appointments SET status = ?, notes = ?, updated_at = NOW() WHERE appointment_id = ?',
      [status, notes || null, appointmentId]
    );

    res.json({
      success: true,
      message: `Appointment ${status === 'scheduled' ? 'accepted' : 'rejected'} successfully`
    });
  } catch (error) {
    console.error('Update appointment status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update appointment' });
  }
});

// Complete appointment
router.put('/appointments/:id/complete', async (req, res) => {
  try {
    const advisorId = await getAdvisorId(req.user.userId);
    const appointmentId = req.params.id;
    const { notes } = req.body;

    await query(
      `UPDATE appointments SET status = 'completed', notes = ?, updated_at = NOW() 
       WHERE appointment_id = ? AND advisor_id = ?`,
      [notes || null, appointmentId, advisorId]
    );

    res.json({ success: true, message: 'Appointment marked as completed' });
  } catch (error) {
    console.error('Complete appointment error:', error);
    res.status(500).json({ success: false, message: 'Failed to complete appointment' });
  }
});

// Set available times (create appointment slots)
router.post('/appointments/availability', async (req, res) => {
  try {
    const advisorId = await getAdvisorId(req.user.userId);
    const { slots } = req.body; // Array of { date, startTime, endTime, meetingType }

    // This would typically create available slots in a separate table
    // For now, we'll just return success
    res.json({
      success: true,
      message: 'Availability updated successfully'
    });
  } catch (error) {
    console.error('Set availability error:', error);
    res.status(500).json({ success: false, message: 'Failed to set availability' });
  }
});

// ==================== COURSE REQUEST APPROVAL ====================

// Get pending course requests
router.get('/course-requests', async (req, res) => {
  try {
    const advisorId = await getAdvisorId(req.user.userId);
    const { status = 'pending' } = req.query;

    const requests = await query(`
      SELECT cr.*, c.code, c.name as course_name, c.credits,
             CONCAT(u.first_name, ' ', u.last_name) as student_name,
             s.student_number, s.gpa
      FROM course_requests cr
      JOIN courses c ON cr.course_id = c.course_id
      JOIN students s ON cr.student_id = s.student_id
      JOIN users u ON s.user_id = u.user_id
      WHERE s.advisor_id = ? AND cr.status = ?
      ORDER BY cr.request_date DESC
    `, [advisorId, status]);

    res.json({ success: true, data: requests });
  } catch (error) {
    console.error('Get course requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch course requests' });
  }
});

// Approve/Reject course request
router.put('/course-requests/:id', async (req, res) => {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    const advisorId = await getAdvisorId(req.user.userId);
    const requestId = req.params.id;
    const { status, advisorNotes } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Use approved or rejected.'
      });
    }

    // Verify request is for advisor's student
    const requests = await query(`
      SELECT cr.*, s.student_id
      FROM course_requests cr
      JOIN students s ON cr.student_id = s.student_id
      WHERE cr.request_id = ? AND s.advisor_id = ?
    `, [requestId, advisorId]);

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course request not found'
      });
    }

    const request = requests[0];

    // Update request status
    await connection.execute(
      `UPDATE course_requests 
       SET status = ?, advisor_notes = ?, approved_by = ?, decision_date = NOW()
       WHERE request_id = ?`,
      [status, advisorNotes || null, advisorId, requestId]
    );

    // If approved and it's a registration request, enroll the student
    if (status === 'approved' && request.request_type === 'register') {
      await connection.execute(
        `INSERT INTO student_courses (student_id, course_id, semester, status)
         VALUES (?, ?, ?, 'current')
         ON DUPLICATE KEY UPDATE status = 'current'`,
        [request.student_id, request.course_id, request.requested_semester]
      );
    }

    // If approved and it's a drop request, update enrollment status
    if (status === 'approved' && request.request_type === 'drop') {
      await connection.execute(
        `UPDATE student_courses SET status = 'dropped'
         WHERE student_id = ? AND course_id = ? AND semester = ?`,
        [request.student_id, request.course_id, request.requested_semester]
      );
    }

    await connection.commit();

    res.json({
      success: true,
      message: `Course request ${status} successfully`
    });
  } catch (error) {
    await connection.rollback();
    console.error('Update course request error:', error);
    res.status(500).json({ success: false, message: 'Failed to update course request' });
  } finally {
    connection.release();
  }
});

// ==================== ADVISING NOTES ====================

// Get notes for a student
router.get('/students/:id/notes', async (req, res) => {
  try {
    const advisorId = await getAdvisorId(req.user.userId);
    const studentId = req.params.id;

    // Verify student belongs to advisor
    const students = await query(
      'SELECT student_id FROM students WHERE student_id = ? AND advisor_id = ?',
      [studentId, advisorId]
    );

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found or not assigned to you'
      });
    }

    const notes = await query(`
      SELECT * FROM advising_notes
      WHERE student_id = ? AND advisor_id = ?
      ORDER BY created_at DESC
    `, [studentId, advisorId]);

    res.json({ success: true, data: notes });
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notes' });
  }
});

// Add advising note
router.post('/students/:id/notes', async (req, res) => {
  try {
    const advisorId = await getAdvisorId(req.user.userId);
    const studentId = req.params.id;
    const { content, noteType, isVisibleToStudent } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Note content is required'
      });
    }

    // Verify student belongs to advisor
    const students = await query(
      'SELECT student_id FROM students WHERE student_id = ? AND advisor_id = ?',
      [studentId, advisorId]
    );

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found or not assigned to you'
      });
    }

    const result = await query(
      `INSERT INTO advising_notes (student_id, advisor_id, content, note_type, is_visible_to_student)
       VALUES (?, ?, ?, ?, ?)`,
      [studentId, advisorId, content, noteType || 'session_note', 
       isVisibleToStudent !== false ? 1 : 0]
    );

    res.status(201).json({
      success: true,
      message: 'Note added successfully',
      data: { noteId: result.insertId }
    });
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({ success: false, message: 'Failed to add note' });
  }
});

// Update advising note
router.put('/notes/:id', async (req, res) => {
  try {
    const advisorId = await getAdvisorId(req.user.userId);
    const noteId = req.params.id;
    const { content, noteType, isVisibleToStudent } = req.body;

    // Verify note belongs to advisor
    const notes = await query(
      'SELECT note_id FROM advising_notes WHERE note_id = ? AND advisor_id = ?',
      [noteId, advisorId]
    );

    if (notes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    await query(
      `UPDATE advising_notes 
       SET content = ?, note_type = ?, is_visible_to_student = ?, updated_at = NOW()
       WHERE note_id = ?`,
      [content, noteType, isVisibleToStudent ? 1 : 0, noteId]
    );

    res.json({ success: true, message: 'Note updated successfully' });
  } catch (error) {
    console.error('Update note error:', error);
    res.status(500).json({ success: false, message: 'Failed to update note' });
  }
});

// Delete advising note
router.delete('/notes/:id', async (req, res) => {
  try {
    const advisorId = await getAdvisorId(req.user.userId);
    const noteId = req.params.id;

    await query(
      'DELETE FROM advising_notes WHERE note_id = ? AND advisor_id = ?',
      [noteId, advisorId]
    );

    res.json({ success: true, message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete note' });
  }
});

// ==================== COURSE SUGGESTIONS ====================

// Get available courses for suggestion
router.get('/courses/available', async (req, res) => {
  try {
    const { departmentId, semester } = req.query;

    let sql = `
      SELECT c.*, d.name as department_name,
             (SELECT COUNT(*) FROM student_courses sc WHERE sc.course_id = c.course_id AND sc.status = 'current') as enrolled_count
      FROM courses c
      JOIN departments d ON c.department_id = d.department_id
      WHERE c.is_active = 1
    `;

    const params = [];

    if (departmentId) {
      sql += ' AND c.department_id = ?';
      params.push(departmentId);
    }
    if (semester) {
      sql += ' AND (c.semester = ? OR c.semester IS NULL)';
      params.push(semester);
    }

    sql += ' ORDER BY c.code';

    const courses = await query(sql, params);

    // Get prerequisites for each course
    for (let course of courses) {
      const prereqs = await query(`
        SELECT c.course_id, c.code, c.name
        FROM course_prerequisites cp
        JOIN courses c ON cp.prerequisite_course_id = c.course_id
        WHERE cp.course_id = ?
      `, [course.course_id]);
      course.prerequisites = prereqs;
    }

    res.json({ success: true, data: courses });
  } catch (error) {
    console.error('Get available courses error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch courses' });
  }
});

// Suggest courses to student (creates a note with recommendations)
router.post('/students/:id/suggest-courses', async (req, res) => {
  try {
    const advisorId = await getAdvisorId(req.user.userId);
    const studentId = req.params.id;
    const { courseIds, semester, notes } = req.body;

    if (!courseIds || courseIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please select at least one course'
      });
    }

    // Get course details
    const courses = await query(
      `SELECT code, name, credits FROM courses WHERE course_id IN (?)`,
      [courseIds]
    );

    // Create recommendation note
    const courseList = courses.map(c => `${c.code} - ${c.name} (${c.credits} credits)`).join('\n');
    const content = `Course Recommendations for ${semester || 'upcoming semester'}:\n\n${courseList}\n\n${notes || ''}`;

    await query(
      `INSERT INTO advising_notes (student_id, advisor_id, content, note_type, is_visible_to_student)
       VALUES (?, ?, ?, 'recommendation', 1)`,
      [studentId, advisorId, content]
    );

    res.json({
      success: true,
      message: 'Course recommendations sent to student'
    });
  } catch (error) {
    console.error('Suggest courses error:', error);
    res.status(500).json({ success: false, message: 'Failed to suggest courses' });
  }
});

// ==================== STUDENT PROGRESS TRACKING ====================

// Check student's prerequisite completion for a course
router.get('/students/:studentId/prerequisites/:courseId', async (req, res) => {
  try {
    const { studentId, courseId } = req.params;

    // Get course prerequisites
    const prerequisites = await query(`
      SELECT cp.prerequisite_course_id, c.code, c.name
      FROM course_prerequisites cp
      JOIN courses c ON cp.prerequisite_course_id = c.course_id
      WHERE cp.course_id = ?
    `, [courseId]);

    // Check which prerequisites the student has completed
    const completedCourses = await query(`
      SELECT course_id FROM student_courses
      WHERE student_id = ? AND status = 'completed' AND grade NOT IN ('F', 'W', 'I')
    `, [studentId]);

    const completedIds = completedCourses.map(c => c.course_id);

    const prereqStatus = prerequisites.map(p => ({
      ...p,
      completed: completedIds.includes(p.prerequisite_course_id)
    }));

    const allMet = prereqStatus.every(p => p.completed);

    res.json({
      success: true,
      data: {
        prerequisites: prereqStatus,
        allPrerequisitesMet: allMet
      }
    });
  } catch (error) {
    console.error('Check prerequisites error:', error);
    res.status(500).json({ success: false, message: 'Failed to check prerequisites' });
  }
});

// Get graduation progress
router.get('/students/:id/graduation-progress', async (req, res) => {
  try {
    const advisorId = await getAdvisorId(req.user.userId);
    const studentId = req.params.id;

    // Verify student belongs to advisor
    const students = await query(`
      SELECT s.*, d.name as major_name
      FROM students s
      JOIN departments d ON s.major_id = d.department_id
      WHERE s.student_id = ? AND s.advisor_id = ?
    `, [studentId, advisorId]);

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Get completed courses
    const completedCourses = await query(`
      SELECT sc.*, c.code, c.name, c.credits, c.department_id
      FROM student_courses sc
      JOIN courses c ON sc.course_id = c.course_id
      WHERE sc.student_id = ? AND sc.status = 'completed' AND sc.grade NOT IN ('F', 'W', 'I')
    `, [studentId]);

    // Get current courses
    const currentCourses = await query(`
      SELECT sc.*, c.code, c.name, c.credits
      FROM student_courses sc
      JOIN courses c ON sc.course_id = c.course_id
      WHERE sc.student_id = ? AND sc.status IN ('current', 'in_progress')
    `, [studentId]);

    const totalCompletedCredits = completedCourses.reduce((sum, c) => sum + c.credits, 0);
    const totalCurrentCredits = currentCourses.reduce((sum, c) => sum + c.credits, 0);

    // Assuming 120 credits required for graduation (this should come from settings)
    const requiredCredits = 120;

    res.json({
      success: true,
      data: {
        student: students[0],
        completedCourses,
        currentCourses,
        creditsSummary: {
          completed: totalCompletedCredits,
          inProgress: totalCurrentCredits,
          required: requiredCredits,
          remaining: Math.max(0, requiredCredits - totalCompletedCredits),
          progressPercent: Math.round((totalCompletedCredits / requiredCredits) * 100)
        }
      }
    });
  } catch (error) {
    console.error('Get graduation progress error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch graduation progress' });
  }
});

// ==================== NOTIFICATIONS ====================

// Send notification to student
router.post('/students/:id/notify', async (req, res) => {
  try {
    const advisorId = await getAdvisorId(req.user.userId);
    const studentId = req.params.id;
    const { subject, content } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    // Get student's user_id
    const students = await query(
      'SELECT user_id FROM students WHERE student_id = ? AND advisor_id = ?',
      [studentId, advisorId]
    );

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Create message
    await query(
      `INSERT INTO messages (sender_id, recipient_id, subject, content)
       VALUES (?, ?, ?, ?)`,
      [req.user.userId, students[0].user_id, subject || 'Notification from Advisor', content]
    );

    res.json({ success: true, message: 'Notification sent successfully' });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ success: false, message: 'Failed to send notification' });
  }
});

// ==================== MESSAGING ====================

// Get messages
router.get('/messages', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { type = 'inbox' } = req.query;

    let sql;
    if (type === 'inbox') {
      sql = `
        SELECT m.*, CONCAT(u.first_name, ' ', u.last_name) as sender_name
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

    const messages = await query(sql, [userId]);

    res.json({ success: true, data: messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
});

// Send message
router.post('/messages', async (req, res) => {
  try {
    const { recipientId, subject, content } = req.body;

    if (!recipientId || !content) {
      return res.status(400).json({
        success: false,
        message: 'Recipient and content are required'
      });
    }

    await query(
      `INSERT INTO messages (sender_id, recipient_id, subject, content)
       VALUES (?, ?, ?, ?)`,
      [req.user.userId, recipientId, subject || null, content]
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
      `UPDATE messages SET is_read = 1, read_at = NOW()
       WHERE message_id = ? AND recipient_id = ?`,
      [messageId, req.user.userId]
    );

    res.json({ success: true, message: 'Message marked as read' });
  } catch (error) {
    console.error('Mark message read error:', error);
    res.status(500).json({ success: false, message: 'Failed to update message' });
  }
});

// ==================== DASHBOARD STATS ====================

// Get advisor dashboard statistics
router.get('/dashboard', async (req, res) => {
  try {
    const advisorId = await getAdvisorId(req.user.userId);

    // Get counts
    const [studentCount] = await query(
      'SELECT COUNT(*) as count FROM students WHERE advisor_id = ?',
      [advisorId]
    );

    const [pendingRequests] = await query(`
      SELECT COUNT(*) as count FROM course_requests cr
      JOIN students s ON cr.student_id = s.student_id
      WHERE s.advisor_id = ? AND cr.status = 'pending'
    `, [advisorId]);

    const [upcomingAppointments] = await query(`
      SELECT COUNT(*) as count FROM appointments
      WHERE advisor_id = ? AND status = 'scheduled' AND appointment_date >= NOW()
    `, [advisorId]);

    const [unreadMessages] = await query(
      'SELECT COUNT(*) as count FROM messages WHERE recipient_id = ? AND is_read = 0',
      [req.user.userId]
    );

    // Students by status
    const studentsByStatus = await query(`
      SELECT academic_status, COUNT(*) as count
      FROM students WHERE advisor_id = ?
      GROUP BY academic_status
    `, [advisorId]);

    // Recent appointments
    const recentAppointments = await query(`
      SELECT ap.*, CONCAT(u.first_name, ' ', u.last_name) as student_name
      FROM appointments ap
      JOIN students s ON ap.student_id = s.student_id
      JOIN users u ON s.user_id = u.user_id
      WHERE ap.advisor_id = ? AND ap.appointment_date >= NOW() AND ap.status = 'scheduled'
      ORDER BY ap.appointment_date
      LIMIT 5
    `, [advisorId]);

    // Recent course requests
    const recentRequests = await query(`
      SELECT cr.*, c.code, c.name as course_name,
             CONCAT(u.first_name, ' ', u.last_name) as student_name
      FROM course_requests cr
      JOIN courses c ON cr.course_id = c.course_id
      JOIN students s ON cr.student_id = s.student_id
      JOIN users u ON s.user_id = u.user_id
      WHERE s.advisor_id = ? AND cr.status = 'pending'
      ORDER BY cr.request_date DESC
      LIMIT 5
    `, [advisorId]);

    res.json({
      success: true,
      data: {
        counts: {
          students: studentCount.count,
          pendingRequests: pendingRequests.count,
          upcomingAppointments: upcomingAppointments.count,
          unreadMessages: unreadMessages.count
        },
        studentsByStatus,
        recentAppointments,
        recentRequests
      }
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard data' });
  }
});

module.exports = router;
