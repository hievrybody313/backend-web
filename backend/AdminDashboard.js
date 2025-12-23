// AdminDashboard.js - Backend routes for Admin Dashboard
// Located in: backend/AdminDashboard.js
// Uses config.js for database connection

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query, getConnection } = require('./config');
const { verifyToken, adminOnly } = require('./middleware/auth');

// Apply authentication to all admin routes
router.use(verifyToken);
router.use((req, res, next) => {
  console.log('Admin route accessed by:', req.user);
  next();
});
router.use(adminOnly);

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Admin routes working', user: req.user });
});

// ==================== ADVISOR MANAGEMENT ====================

// Get all advisors
router.get('/advisors', async (req, res) => {
  try {
    const advisors = await query(`
      SELECT a.advisor_id, a.user_id, a.department_id, a.office_location,
             a.phone_extension, a.max_students, a.is_available, a.created_at,
             u.username, u.email, u.first_name, u.last_name, u.phone, u.is_active,
             d.name as department_name, d.code as department_code,
             (SELECT COUNT(*) FROM students s WHERE s.advisor_id = a.advisor_id) as student_count
      FROM advisors a
      JOIN users u ON a.user_id = u.user_id
      JOIN departments d ON a.department_id = d.department_id
      ORDER BY u.last_name, u.first_name
    `);

    res.json({
      success: true,
      data: advisors
    });
  } catch (error) {
    console.error('Get advisors error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch advisors' });
  }
});

// Get single advisor by ID
router.get('/advisors/:id', async (req, res) => {
  try {
    const advisors = await query(`
      SELECT a.*, u.username, u.email, u.first_name, u.last_name, u.phone, u.is_active,
             d.name as department_name
      FROM advisors a
      JOIN users u ON a.user_id = u.user_id
      JOIN departments d ON a.department_id = d.department_id
      WHERE a.advisor_id = ?
    `, [req.params.id]);

    if (advisors.length === 0) {
      return res.status(404).json({ success: false, message: 'Advisor not found' });
    }

    res.json({ success: true, data: advisors[0] });
  } catch (error) {
    console.error('Get advisor error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch advisor' });
  }
});

// Create new advisor
router.post('/advisors', async (req, res) => {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    const { username, email, password, firstName, lastName, phone,
            departmentId, officeLocation, phoneExtension, maxStudents } = req.body;

    // Validate required fields
    if (!username || !email || !password || !firstName || !lastName || !departmentId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Check if username or email already exists
    const existing = await query(
      'SELECT user_id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Username or email already exists'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const [userResult] = await connection.execute(
      `INSERT INTO users (username, email, password_hash, role, first_name, last_name, phone)
       VALUES (?, ?, ?, 'advisor', ?, ?, ?)`,
      [username, email, passwordHash, firstName, lastName, phone || null]
    );

    const userId = userResult.insertId;

    // Create advisor profile
    const [advisorResult] = await connection.execute(
      `INSERT INTO advisors (user_id, department_id, office_location, phone_extension, max_students)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, departmentId, officeLocation || null, phoneExtension || null, maxStudents || 50]
    );

    await connection.commit();

    // Log action
    await logAuditAction(req.user.userId, 'CREATE_ADVISOR', 'advisor', advisorResult.insertId, req.ip);

    res.status(201).json({
      success: true,
      message: 'Advisor created successfully',
      data: { advisorId: advisorResult.insertId, userId }
    });

  } catch (error) {
    await connection.rollback();
    console.error('Create advisor error:', error);
    res.status(500).json({ success: false, message: 'Failed to create advisor' });
  } finally {
    connection.release();
  }
});

// Update advisor
router.put('/advisors/:id', async (req, res) => {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    const advisorId = req.params.id;
    const { firstName, lastName, email, phone, departmentId, 
            officeLocation, phoneExtension, maxStudents, isAvailable } = req.body;

    // Get advisor's user_id
    const advisors = await query('SELECT user_id FROM advisors WHERE advisor_id = ?', [advisorId]);
    if (advisors.length === 0) {
      return res.status(404).json({ success: false, message: 'Advisor not found' });
    }

    const userId = advisors[0].user_id;

    // Update user info
    await connection.execute(
      `UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ?, updated_at = NOW()
       WHERE user_id = ?`,
      [firstName, lastName, email, phone || null, userId]
    );

    // Update advisor info
    await connection.execute(
      `UPDATE advisors SET department_id = ?, office_location = ?, phone_extension = ?,
       max_students = ?, is_available = ? WHERE advisor_id = ?`,
      [departmentId, officeLocation || null, phoneExtension || null, 
       maxStudents || 50, isAvailable ? 1 : 0, advisorId]
    );

    await connection.commit();

    await logAuditAction(req.user.userId, 'UPDATE_ADVISOR', 'advisor', advisorId, req.ip);

    res.json({ success: true, message: 'Advisor updated successfully' });

  } catch (error) {
    await connection.rollback();
    console.error('Update advisor error:', error);
    res.status(500).json({ success: false, message: 'Failed to update advisor' });
  } finally {
    connection.release();
  }
});

// Delete advisor
router.delete('/advisors/:id', async (req, res) => {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    const advisorId = req.params.id;

    // Check if advisor has assigned students
    const students = await query(
      'SELECT COUNT(*) as count FROM students WHERE advisor_id = ?',
      [advisorId]
    );

    if (students[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete advisor with assigned students. Reassign students first.'
      });
    }

    // Get user_id before deleting
    const advisors = await query('SELECT user_id FROM advisors WHERE advisor_id = ?', [advisorId]);
    if (advisors.length === 0) {
      return res.status(404).json({ success: false, message: 'Advisor not found' });
    }

    const userId = advisors[0].user_id;

    // Delete advisor (cascade will handle related records)
    await connection.execute('DELETE FROM advisors WHERE advisor_id = ?', [advisorId]);
    await connection.execute('DELETE FROM users WHERE user_id = ?', [userId]);

    await connection.commit();

    await logAuditAction(req.user.userId, 'DELETE_ADVISOR', 'advisor', advisorId, req.ip);

    res.json({ success: true, message: 'Advisor deleted successfully' });

  } catch (error) {
    await connection.rollback();
    console.error('Delete advisor error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete advisor' });
  } finally {
    connection.release();
  }
});

// ==================== STUDENT MANAGEMENT ====================

// Get all students
router.get('/students', async (req, res) => {
  try {
    const { departmentId, advisorId, status } = req.query;
    
    let sql = `
      SELECT s.student_id, s.student_number, s.gpa, s.enrollment_date,
             s.expected_graduation, s.academic_status, s.created_at,
             u.user_id, u.username, u.email, u.first_name, u.last_name, u.phone, u.is_active,
             d.department_id, d.name as major_name,
             a.advisor_id,
             CONCAT(au.first_name, ' ', au.last_name) as advisor_name
      FROM students s
      JOIN users u ON s.user_id = u.user_id
      JOIN departments d ON s.major_id = d.department_id
      JOIN advisors a ON s.advisor_id = a.advisor_id
      JOIN users au ON a.user_id = au.user_id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (departmentId) {
      sql += ' AND s.major_id = ?';
      params.push(departmentId);
    }
    if (advisorId) {
      sql += ' AND s.advisor_id = ?';
      params.push(advisorId);
    }
    if (status) {
      sql += ' AND s.academic_status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY u.last_name, u.first_name';
    
    const students = await query(sql, params);

    res.json({ success: true, data: students });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch students' });
  }
});

// Get single student
router.get('/students/:id', async (req, res) => {
  try {
    const students = await query(`
      SELECT s.*, u.username, u.email, u.first_name, u.last_name, u.phone, u.is_active,
             d.name as major_name, CONCAT(au.first_name, ' ', au.last_name) as advisor_name
      FROM students s
      JOIN users u ON s.user_id = u.user_id
      JOIN departments d ON s.major_id = d.department_id
      JOIN advisors a ON s.advisor_id = a.advisor_id
      JOIN users au ON a.user_id = au.user_id
      WHERE s.student_id = ?
    `, [req.params.id]);

    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Get enrolled courses
    const courses = await query(`
      SELECT sc.*, c.code, c.name, c.credits
      FROM student_courses sc
      JOIN courses c ON sc.course_id = c.course_id
      WHERE sc.student_id = ?
      ORDER BY sc.semester DESC, c.code
    `, [req.params.id]);

    res.json({
      success: true,
      data: { ...students[0], courses }
    });
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch student' });
  }
});

// Create new student
router.post('/students', async (req, res) => {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    const { username, email, password, firstName, lastName, phone,
            studentNumber, majorId, advisorId, enrollmentDate, expectedGraduation } = req.body;

    // Validate required fields
    if (!username || !email || !password || !firstName || !lastName || 
        !studentNumber || !majorId || !advisorId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Check existing
    const existing = await query(
      'SELECT user_id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Username or email already exists' });
    }

    // Check student number
    const existingStudent = await query(
      'SELECT student_id FROM students WHERE student_number = ?',
      [studentNumber]
    );

    if (existingStudent.length > 0) {
      return res.status(409).json({ success: false, message: 'Student number already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const [userResult] = await connection.execute(
      `INSERT INTO users (username, email, password_hash, role, first_name, last_name, phone)
       VALUES (?, ?, ?, 'student', ?, ?, ?)`,
      [username, email, passwordHash, firstName, lastName, phone || null]
    );

    const userId = userResult.insertId;

    // Create student profile
    const [studentResult] = await connection.execute(
      `INSERT INTO students (user_id, student_number, major_id, advisor_id, enrollment_date, expected_graduation)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, studentNumber, majorId, advisorId, enrollmentDate || null, expectedGraduation || null]
    );

    await connection.commit();

    await logAuditAction(req.user.userId, 'CREATE_STUDENT', 'student', studentResult.insertId, req.ip);

    res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: { studentId: studentResult.insertId, userId }
    });

  } catch (error) {
    await connection.rollback();
    console.error('Create student error:', error);
    res.status(500).json({ success: false, message: 'Failed to create student' });
  } finally {
    connection.release();
  }
});

// Update student
router.put('/students/:id', async (req, res) => {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    const studentId = req.params.id;
    const { firstName, lastName, email, phone, majorId, advisorId,
            gpa, academicStatus, expectedGraduation } = req.body;

    const students = await query('SELECT user_id FROM students WHERE student_id = ?', [studentId]);
    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const userId = students[0].user_id;

    await connection.execute(
      `UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ?, updated_at = NOW()
       WHERE user_id = ?`,
      [firstName, lastName, email, phone || null, userId]
    );

    await connection.execute(
      `UPDATE students SET major_id = ?, advisor_id = ?, gpa = ?, 
       academic_status = ?, expected_graduation = ? WHERE student_id = ?`,
      [majorId, advisorId, gpa || null, academicStatus || 'good_standing', 
       expectedGraduation || null, studentId]
    );

    await connection.commit();

    await logAuditAction(req.user.userId, 'UPDATE_STUDENT', 'student', studentId, req.ip);

    res.json({ success: true, message: 'Student updated successfully' });

  } catch (error) {
    await connection.rollback();
    console.error('Update student error:', error);
    res.status(500).json({ success: false, message: 'Failed to update student' });
  } finally {
    connection.release();
  }
});

// Delete student
router.delete('/students/:id', async (req, res) => {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    const studentId = req.params.id;

    const students = await query('SELECT user_id FROM students WHERE student_id = ?', [studentId]);
    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const userId = students[0].user_id;

    await connection.execute('DELETE FROM students WHERE student_id = ?', [studentId]);
    await connection.execute('DELETE FROM users WHERE user_id = ?', [userId]);

    await connection.commit();

    await logAuditAction(req.user.userId, 'DELETE_STUDENT', 'student', studentId, req.ip);

    res.json({ success: true, message: 'Student deleted successfully' });

  } catch (error) {
    await connection.rollback();
    console.error('Delete student error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete student' });
  } finally {
    connection.release();
  }
});

// ==================== COURSE MANAGEMENT ====================

// Get all courses
router.get('/courses', async (req, res) => {
  try {
    const { departmentId, isActive } = req.query;

    let sql = `
      SELECT c.*, d.name as department_name, d.code as department_code,
             (SELECT COUNT(*) FROM student_courses sc WHERE sc.course_id = c.course_id AND sc.status = 'current') as enrolled_count
      FROM courses c
      JOIN departments d ON c.department_id = d.department_id
      WHERE 1=1
    `;

    const params = [];

    if (departmentId) {
      sql += ' AND c.department_id = ?';
      params.push(departmentId);
    }
    if (isActive !== undefined) {
      sql += ' AND c.is_active = ?';
      params.push(isActive === 'true' ? 1 : 0);
    }

    sql += ' ORDER BY c.code';

    const courses = await query(sql, params);

    // Get prerequisites for each course
    for (let course of courses) {
      const prereqs = await query(`
        SELECT cp.prerequisite_course_id, c.code, c.name
        FROM course_prerequisites cp
        JOIN courses c ON cp.prerequisite_course_id = c.course_id
        WHERE cp.course_id = ?
      `, [course.course_id]);
      course.prerequisites = prereqs;
    }

    res.json({ success: true, data: courses });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch courses' });
  }
});

// Create course
router.post('/courses', async (req, res) => {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    const { code, name, description, credits, departmentId, semester, capacity, prerequisites } = req.body;

    if (!code || !name || !credits || !departmentId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Check if course code exists
    const existing = await query('SELECT course_id FROM courses WHERE code = ?', [code]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Course code already exists' });
    }

    const [result] = await connection.execute(
      `INSERT INTO courses (code, name, description, credits, department_id, semester, capacity)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [code, name, description || null, credits, departmentId, semester || null, capacity || null]
    );

    const courseId = result.insertId;

    // Add prerequisites if provided
    if (prerequisites && prerequisites.length > 0) {
      for (const prereqId of prerequisites) {
        await connection.execute(
          'INSERT INTO course_prerequisites (course_id, prerequisite_course_id) VALUES (?, ?)',
          [courseId, prereqId]
        );
      }
    }

    await connection.commit();

    await logAuditAction(req.user.userId, 'CREATE_COURSE', 'course', courseId, req.ip);

    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: { courseId }
    });

  } catch (error) {
    await connection.rollback();
    console.error('Create course error:', error);
    res.status(500).json({ success: false, message: 'Failed to create course' });
  } finally {
    connection.release();
  }
});

// Update course
router.put('/courses/:id', async (req, res) => {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    const courseId = req.params.id;
    const { code, name, description, credits, departmentId, semester, capacity, isActive, prerequisites } = req.body;

    await connection.execute(
      `UPDATE courses SET code = ?, name = ?, description = ?, credits = ?, 
       department_id = ?, semester = ?, capacity = ?, is_active = ? WHERE course_id = ?`,
      [code, name, description || null, credits, departmentId, 
       semester || null, capacity || null, isActive ? 1 : 0, courseId]
    );

    // Update prerequisites
    await connection.execute('DELETE FROM course_prerequisites WHERE course_id = ?', [courseId]);
    
    if (prerequisites && prerequisites.length > 0) {
      for (const prereqId of prerequisites) {
        await connection.execute(
          'INSERT INTO course_prerequisites (course_id, prerequisite_course_id) VALUES (?, ?)',
          [courseId, prereqId]
        );
      }
    }

    await connection.commit();

    await logAuditAction(req.user.userId, 'UPDATE_COURSE', 'course', courseId, req.ip);

    res.json({ success: true, message: 'Course updated successfully' });

  } catch (error) {
    await connection.rollback();
    console.error('Update course error:', error);
    res.status(500).json({ success: false, message: 'Failed to update course' });
  } finally {
    connection.release();
  }
});

// Delete course
router.delete('/courses/:id', async (req, res) => {
  try {
    const courseId = req.params.id;

    // Check if course has enrolled students
    const enrollments = await query(
      "SELECT COUNT(*) as count FROM student_courses WHERE course_id = ? AND status IN ('current', 'in_progress')",
      [courseId]
    );

    if (enrollments[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete course with active enrollments'
      });
    }

    await query('DELETE FROM courses WHERE course_id = ?', [courseId]);

    await logAuditAction(req.user.userId, 'DELETE_COURSE', 'course', courseId, req.ip);

    res.json({ success: true, message: 'Course deleted successfully' });

  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete course' });
  }
});

// ==================== DEPARTMENT MANAGEMENT ====================

// Get all departments
router.get('/departments', async (req, res) => {
  try {
    const departments = await query(`
      SELECT d.*, CONCAT(u.first_name, ' ', u.last_name) as head_name,
             (SELECT COUNT(*) FROM advisors a WHERE a.department_id = d.department_id) as advisor_count,
             (SELECT COUNT(*) FROM students s WHERE s.major_id = d.department_id) as student_count,
             (SELECT COUNT(*) FROM courses c WHERE c.department_id = d.department_id) as course_count
      FROM departments d
      LEFT JOIN users u ON d.head_id = u.user_id
      ORDER BY d.name
    `);

    res.json({ success: true, data: departments });
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch departments' });
  }
});

// Create department
router.post('/departments', async (req, res) => {
  try {
    const { name, code, description, headId } = req.body;

    if (!name || !code) {
      return res.status(400).json({ success: false, message: 'Name and code are required' });
    }

    const existing = await query(
      'SELECT department_id FROM departments WHERE name = ? OR code = ?',
      [name, code]
    );

    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Department name or code already exists' });
    }

    const result = await query(
      'INSERT INTO departments (name, code, description, head_id) VALUES (?, ?, ?, ?)',
      [name, code, description || null, headId || null]
    );

    await logAuditAction(req.user.userId, 'CREATE_DEPARTMENT', 'department', result.insertId, req.ip);

    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: { departmentId: result.insertId }
    });

  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({ success: false, message: 'Failed to create department' });
  }
});

// Update department
router.put('/departments/:id', async (req, res) => {
  try {
    const departmentId = req.params.id;
    const { name, code, description, headId } = req.body;

    await query(
      'UPDATE departments SET name = ?, code = ?, description = ?, head_id = ? WHERE department_id = ?',
      [name, code, description || null, headId || null, departmentId]
    );

    await logAuditAction(req.user.userId, 'UPDATE_DEPARTMENT', 'department', departmentId, req.ip);

    res.json({ success: true, message: 'Department updated successfully' });

  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({ success: false, message: 'Failed to update department' });
  }
});

// Delete department
router.delete('/departments/:id', async (req, res) => {
  try {
    const departmentId = req.params.id;

    // Check for advisors and students
    const advisors = await query('SELECT COUNT(*) as count FROM advisors WHERE department_id = ?', [departmentId]);
    const students = await query('SELECT COUNT(*) as count FROM students WHERE major_id = ?', [departmentId]);

    if (advisors[0].count > 0 || students[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete department with assigned advisors or students'
      });
    }

    await query('DELETE FROM departments WHERE department_id = ?', [departmentId]);

    await logAuditAction(req.user.userId, 'DELETE_DEPARTMENT', 'department', departmentId, req.ip);

    res.json({ success: true, message: 'Department deleted successfully' });

  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete department' });
  }
});

// ==================== APPOINTMENT MANAGEMENT ====================

// Get all appointments
router.get('/appointments', async (req, res) => {
  try {
    const { status, advisorId, startDate, endDate } = req.query;

    let sql = `
      SELECT ap.*, 
             CONCAT(su.first_name, ' ', su.last_name) as student_name,
             s.student_number,
             CONCAT(au.first_name, ' ', au.last_name) as advisor_name
      FROM appointments ap
      JOIN students s ON ap.student_id = s.student_id
      JOIN users su ON s.user_id = su.user_id
      JOIN advisors a ON ap.advisor_id = a.advisor_id
      JOIN users au ON a.user_id = au.user_id
      WHERE 1=1
    `;

    const params = [];

    if (status) {
      sql += ' AND ap.status = ?';
      params.push(status);
    }
    if (advisorId) {
      sql += ' AND ap.advisor_id = ?';
      params.push(advisorId);
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

// Update appointment (cancel/edit)
router.put('/appointments/:id', async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const { appointmentDate, status, meetingType, notes, durationMinutes } = req.body;

    // Build dynamic update query
    const updates = [];
    const params = [];

    if (appointmentDate !== undefined) {
      updates.push('appointment_date = ?');
      params.push(appointmentDate);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (meetingType !== undefined) {
      updates.push('meeting_type = ?');
      params.push(meetingType);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }
    if (durationMinutes !== undefined) {
      updates.push('duration_minutes = ?');
      params.push(durationMinutes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(appointmentId);

    await query(
      `UPDATE appointments SET ${updates.join(', ')} WHERE appointment_id = ?`,
      params
    );

    await logAuditAction(req.user.userId, 'UPDATE_APPOINTMENT', 'appointment', appointmentId, req.ip);

    res.json({ success: true, message: 'Appointment updated successfully' });

  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({ success: false, message: 'Failed to update appointment' });
  }
});

// Delete appointment
router.delete('/appointments/:id', async (req, res) => {
  try {
    const appointmentId = req.params.id;

    await query('DELETE FROM appointments WHERE appointment_id = ?', [appointmentId]);

    await logAuditAction(req.user.userId, 'DELETE_APPOINTMENT', 'appointment', appointmentId, req.ip);

    res.json({ success: true, message: 'Appointment deleted successfully' });

  } catch (error) {
    console.error('Delete appointment error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete appointment' });
  }
});

// ==================== SYSTEM SETTINGS ====================

// Get all settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await query('SELECT * FROM system_settings ORDER BY setting_key');
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
});

// Update setting
router.put('/settings/:key', async (req, res) => {
  try {
    const settingKey = req.params.key;
    const { value, description } = req.body;

    // Check if setting exists
    const existing = await query('SELECT setting_id FROM system_settings WHERE setting_key = ?', [settingKey]);

    if (existing.length === 0) {
      // Create new setting
      await query(
        'INSERT INTO system_settings (setting_key, setting_value, description, updated_by) VALUES (?, ?, ?, ?)',
        [settingKey, value, description || null, req.user.userId]
      );
    } else {
      // Update existing
      await query(
        'UPDATE system_settings SET setting_value = ?, description = ?, updated_by = ? WHERE setting_key = ?',
        [value, description || null, req.user.userId, settingKey]
      );
    }

    await logAuditAction(req.user.userId, 'UPDATE_SETTING', 'system_settings', null, req.ip);

    res.json({ success: true, message: 'Setting updated successfully' });

  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ success: false, message: 'Failed to update setting' });
  }
});

// ==================== ANNOUNCEMENTS ====================

// Get all announcements
router.get('/announcements', async (req, res) => {
  try {
    const announcements = await query(`
      SELECT a.*, CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM announcements a
      JOIN users u ON a.created_by = u.user_id
      ORDER BY a.created_at DESC
    `);

    res.json({ success: true, data: announcements });
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch announcements' });
  }
});

// Create announcement
router.post('/announcements', async (req, res) => {
  try {
    const { title, content, targetRole, priority, expiresAt } = req.body;

    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and content are required' });
    }

    const result = await query(
      `INSERT INTO announcements (created_by, title, content, target_role, priority, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.userId, title, content, targetRole || 'all', priority || 'medium', expiresAt || null]
    );

    await logAuditAction(req.user.userId, 'CREATE_ANNOUNCEMENT', 'announcement', result.insertId, req.ip);

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: { announcementId: result.insertId }
    });

  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ success: false, message: 'Failed to create announcement' });
  }
});

// Update announcement
router.put('/announcements/:id', async (req, res) => {
  try {
    const announcementId = req.params.id;
    const { title, content, targetRole, priority, isActive, expiresAt } = req.body;

    await query(
      `UPDATE announcements SET title = ?, content = ?, target_role = ?, 
       priority = ?, is_active = ?, expires_at = ? WHERE announcement_id = ?`,
      [title, content, targetRole, priority, isActive ? 1 : 0, expiresAt || null, announcementId]
    );

    await logAuditAction(req.user.userId, 'UPDATE_ANNOUNCEMENT', 'announcement', announcementId, req.ip);

    res.json({ success: true, message: 'Announcement updated successfully' });

  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ success: false, message: 'Failed to update announcement' });
  }
});

// Delete announcement
router.delete('/announcements/:id', async (req, res) => {
  try {
    const announcementId = req.params.id;

    await query('DELETE FROM announcements WHERE announcement_id = ?', [announcementId]);

    await logAuditAction(req.user.userId, 'DELETE_ANNOUNCEMENT', 'announcement', announcementId, req.ip);

    res.json({ success: true, message: 'Announcement deleted successfully' });

  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete announcement' });
  }
});

// ==================== REPORTS ====================

// Dashboard statistics
router.get('/reports/dashboard', async (req, res) => {
  try {
    console.log('Fetching dashboard data...');
    
    const studentCountResult = await query('SELECT COUNT(*) as count FROM students');
    const advisorCountResult = await query('SELECT COUNT(*) as count FROM advisors');
    const courseCountResult = await query('SELECT COUNT(*) as count FROM courses WHERE is_active = 1');
    const departmentCountResult = await query('SELECT COUNT(*) as count FROM departments');
    const pendingRequestsResult = await query("SELECT COUNT(*) as count FROM course_requests WHERE status = 'pending'");
    const upcomingAppointmentsResult = await query(
      "SELECT COUNT(*) as count FROM appointments WHERE status = 'scheduled' AND appointment_date >= NOW()"
    );

    // Students by status
    const studentsByStatus = await query(`
      SELECT academic_status, COUNT(*) as count 
      FROM students 
      GROUP BY academic_status
    `);

    // Recent activity - use LEFT JOIN to handle missing users
    const recentActivity = await query(`
      SELECT al.action, al.entity_type, al.created_at, 
             COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'System') as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.user_id
      ORDER BY al.created_at DESC
      LIMIT 10
    `);

    console.log('Dashboard data fetched successfully');

    res.json({
      success: true,
      data: {
        counts: {
          students: studentCountResult[0]?.count || 0,
          advisors: advisorCountResult[0]?.count || 0,
          courses: courseCountResult[0]?.count || 0,
          departments: departmentCountResult[0]?.count || 0,
          pendingRequests: pendingRequestsResult[0]?.count || 0,
          upcomingAppointments: upcomingAppointmentsResult[0]?.count || 0
        },
        studentsByStatus: studentsByStatus || [],
        recentActivity: recentActivity || []
      }
    });
  } catch (error) {
    console.error('Dashboard report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate dashboard report', error: error.message });
  }
});

// Student progress report
router.get('/reports/student-progress', async (req, res) => {
  try {
    const report = await query(`
      SELECT d.name as department, 
             COUNT(s.student_id) as total_students,
             AVG(s.gpa) as avg_gpa,
             SUM(CASE WHEN s.academic_status = 'good_standing' THEN 1 ELSE 0 END) as good_standing,
             SUM(CASE WHEN s.academic_status = 'probation' THEN 1 ELSE 0 END) as on_probation,
             SUM(CASE WHEN s.academic_status = 'suspended' THEN 1 ELSE 0 END) as suspended
      FROM departments d
      LEFT JOIN students s ON d.department_id = s.major_id
      GROUP BY d.department_id, d.name
      ORDER BY d.name
    `);

    res.json({ success: true, data: report });
  } catch (error) {
    console.error('Student progress report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
});

// Advisor activity report
router.get('/reports/advisor-activity', async (req, res) => {
  try {
    const report = await query(`
      SELECT CONCAT(u.first_name, ' ', u.last_name) as advisor_name,
             d.name as department,
             a.max_students,
             (SELECT COUNT(*) FROM students s WHERE s.advisor_id = a.advisor_id) as assigned_students,
             (SELECT COUNT(*) FROM appointments ap WHERE ap.advisor_id = a.advisor_id AND ap.status = 'completed') as completed_appointments,
             (SELECT COUNT(*) FROM advising_notes an WHERE an.advisor_id = a.advisor_id) as notes_count,
             (SELECT COUNT(*) FROM course_requests cr WHERE cr.approved_by = a.advisor_id) as requests_handled
      FROM advisors a
      JOIN users u ON a.user_id = u.user_id
      JOIN departments d ON a.department_id = d.department_id
      ORDER BY u.last_name
    `);

    res.json({ success: true, data: report });
  } catch (error) {
    console.error('Advisor activity report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
});

// ==================== PASSWORD RESET ====================

// Reset user password
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const userId = req.params.id;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }

    const users = await query('SELECT user_id FROM users WHERE user_id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await query(
      'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE user_id = ?',
      [passwordHash, userId]
    );

    await logAuditAction(req.user.userId, 'RESET_PASSWORD', 'user', userId, req.ip);

    res.json({ success: true, message: 'Password reset successfully' });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
});

// ==================== AUDIT LOGS ====================

// Get audit logs
router.get('/logs', async (req, res) => {
  try {
    const { userId, action, startDate, endDate, limit = 100 } = req.query;
    
    console.log('Logs request received, limit:', limit);

    let sql = `
      SELECT al.log_id, al.user_id, al.action, al.entity_type, al.entity_id, 
             al.ip_address, al.created_at,
             COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'System') as user_name, 
             COALESCE(u.username, 'system') as username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.user_id
      WHERE 1=1
    `;

    const params = [];

    if (userId) {
      sql += ' AND al.user_id = ?';
      params.push(userId);
    }
    if (action) {
      sql += ' AND al.action LIKE ?';
      params.push(`%${action}%`);
    }
    if (startDate) {
      sql += ' AND al.created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND al.created_at <= ?';
      params.push(endDate);
    }

    sql += ` ORDER BY al.created_at DESC LIMIT ?`;
    params.push(parseInt(limit) || 100);

    console.log('Executing logs query...');
    const logs = await query(sql, params);
    console.log('Logs result count:', logs ? logs.length : 0);

    res.json({ success: true, data: logs || [] });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch logs', error: error.message });
  }
});

// ==================== USER ACCOUNT CONTROL ====================

// Toggle user active status
router.put('/users/:id/toggle-status', async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent self-deactivation
    if (parseInt(userId) === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate your own account'
      });
    }

    const users = await query('SELECT is_active FROM users WHERE user_id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const newStatus = users[0].is_active ? 0 : 1;
    await query(
      'UPDATE users SET is_active = ?, updated_at = NOW() WHERE user_id = ?',
      [newStatus, userId]
    );

    await logAuditAction(
      req.user.userId, 
      newStatus ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', 
      'user', 
      userId, 
      req.ip
    );

    res.json({
      success: true,
      message: `User ${newStatus ? 'activated' : 'deactivated'} successfully`
    });

  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update user status' });
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