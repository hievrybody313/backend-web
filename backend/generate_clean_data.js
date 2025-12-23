const config = require('./config');
const bcrypt = require('bcryptjs');

const PASSWORD = 'pass123';
let hashedPassword;

// ==========================================
// 1. DATA DEFINITIONS
// ==========================================

// --- DEPARTMENTS ---
// Based on the user's PDF/Text input: "Bachelor of Business Administration - Business Management Concentration (BBAMG)"
// We will assume this falls under "Business Administration" department.
const DEPARTMENTS = [
    { name: 'Business Administration', code: 'BUS', description: 'Department of Business Administration' },
    { name: 'Computer Science', code: 'CSCI', description: 'Department of Computer Science' }, // Kept for prerequisite references if any
    { name: 'Mathematics', code: 'MATH', description: 'Department of Mathematics' }, // Kept for prerequisite references
    { name: 'English', code: 'ENGL', description: 'Department of English' } // Kept for prerequisite references
];

// --- COURSES ---
// Parsed from the user provided text for "Business Management Concentration"
const COURSES = [
    // Core Requirements (33 cr)
    { code: 'BACC200', name: 'Financial Accounting', credits: 3, dept: 'BUS', prereqs: ['ENGL051'] },
    { code: 'BECO250', name: 'Introduction to Microeconomics', credits: 3, dept: 'BUS', prereqs: ['BMTH210'] },
    { code: 'BECO301', name: 'Introduction to Macroeconomics', credits: 3, dept: 'BUS', prereqs: ['BMTH210'] },
    { code: 'BFIN250', name: 'Introduction to Finance', credits: 3, dept: 'BUS', prereqs: ['BACC200'] },
    { code: 'BMGT200', name: 'Introduction to Business Management', credits: 3, dept: 'BUS', prereqs: ['ENGL151'] },
    { code: 'BMGT315', name: 'Human Resource Management', credits: 3, dept: 'BUS', prereqs: ['BMGT200'] },
    { code: 'BMIS250', name: 'Management Information Systems', credits: 3, dept: 'BUS', prereqs: ['ENGL151'] },
    { code: 'BMKT250', name: 'Marketing Theory and Principles', credits: 3, dept: 'BUS', prereqs: ['ENGL151'] },
    { code: 'BMTH210', name: 'Business and Managerial Math', credits: 3, dept: 'BUS', prereqs: ['ENGL051', 'MATH100'] },
    { code: 'BSTA205', name: 'Introduction to Business Statistics', credits: 3, dept: 'BUS', prereqs: ['ENGL051', 'BSTA100'] },
    { code: 'CSCI200', name: 'Introduction to Computers', credits: 3, dept: 'CSCI', prereqs: ['ENGL051'] },

    // Major Requirements (45 cr)
    { code: 'BACC250', name: 'Managerial Accounting', credits: 3, dept: 'BUS', prereqs: ['BACC200'] },
    { code: 'BMGT320', name: 'Innovation Management', credits: 3, dept: 'BUS', prereqs: ['BMGT200'] },
    { code: 'BMGT325', name: 'Decision Making Management', credits: 3, dept: 'BUS', prereqs: ['BMGT200'] },
    { code: 'BMGT350', name: 'Introduction to Business Law', credits: 3, dept: 'BUS', prereqs: ['BMGT200'] },
    { code: 'BMGT351', name: 'Organizational Behavior', credits: 3, dept: 'BUS', prereqs: ['BMGT200'] },
    { code: 'BMGT375', name: 'Training and Development Management', credits: 3, dept: 'BUS', prereqs: ['BMGT200'] },
    { code: 'BMGT385', name: 'Total Quality Management', credits: 3, dept: 'BUS', prereqs: ['BMGT200'] },
    { code: 'BMGT401', name: 'Business Ethics', credits: 3, dept: 'BUS', prereqs: ['BMGT200'] },
    { code: 'BMGT402', name: 'Leadership Principles', credits: 3, dept: 'BUS', prereqs: ['BMGT200'] },
    { code: 'BMGT405', name: 'Managing Business Governance', credits: 3, dept: 'BUS', prereqs: ['BMGT200'] },
    { code: 'BMGT491', name: 'Global Strategic Management', credits: 3, dept: 'BUS', prereqs: ['BMGT200'] },
    { code: 'BMGT496', name: 'Research Methods for Business', credits: 3, dept: 'BUS', prereqs: ['BSTA205', 'BMGT200'] },
    { code: 'BMGT497', name: 'Managing Entrepreneurship', credits: 3, dept: 'BUS', prereqs: ['BMGT200'] },
    { code: 'BMGT499', name: 'Senior Project In Management', credits: 3, dept: 'BUS', prereqs: ['BMGT402', 'BMGT385', 'BMGT497'] },
    { code: 'BMIS401', name: 'Operations Management', credits: 3, dept: 'BUS', prereqs: ['BSTA205'] },

    // General Education (12 cr)
    { code: 'ARAB200', name: 'Arabic Language and Literature', credits: 3, dept: 'ENGL' },
    { code: 'CULT200', name: 'Introduction to Arab - Islamic Civilization', credits: 3, dept: 'ENGL' },
    { code: 'ENGL201', name: 'Composition and Research Skills', credits: 3, dept: 'ENGL', prereqs: ['ENGL151'] },
    { code: 'ENGL251', name: 'Communication Skills', credits: 3, dept: 'ENGL', prereqs: ['ENGL201'] },

    // Dummy courses to satisfy prerequisites not fully listed
    { code: 'ENGL051', name: 'Remedial English', credits: 0, dept: 'ENGL' },
    { code: 'ENGL151', name: 'University English I', credits: 3, dept: 'ENGL', prereqs: ['ENGL051'] },
    { code: 'MATH100', name: 'Remedial Math', credits: 0, dept: 'MATH' },
    { code: 'BSTA100', name: 'Basic Statistics', credits: 0, dept: 'BUS' }
];

// --- USERS ---
const ADMINS = [['Georges', 'Karam']]; // 1 Admin

const ADVISORS = [ // 4 Advisors
    ['Mahmoud', 'Hijazi'],
    ['Samira', 'Fawaz'],
    ['Imad', 'Sleiman'],
    ['Hanan', 'Chehab']
];

const STUDENTS = [ // 5 Students
    ['Ahmad', 'Hammoud'],
    ['Fatima', 'Nasrallah'],
    ['Hussein', 'Khalil'],
    ['Zahra', 'Bazzi'],
    ['Mohammad', 'Awada']
];

// --- FAQS ---
const FAQS = [
    { q: 'When does course registration start?', a: 'Course registration usually opens two weeks before the end of the current semester. Students should check the LIU portal for official dates.', s: 'accepted', u: 0 },
    { q: 'What is the minimum GPA required to avoid academic probation?', a: 'Students must maintain a cumulative GPA of at least 2.0 to remain in good academic standing.', s: 'accepted', u: 1 },
    { q: 'Can I take a course without completing its prerequisite?', a: 'No, prerequisites must be completed before registering. Exceptions require advisor and department approval.', s: 'accepted', u: 2 },
    { q: 'How do I change my major?', a: 'You need to submit a Change of Major request through Student Services and obtain approval from both departments.', s: 'accepted', u: 3 },
    { q: 'What should I do if two courses have a time conflict?', a: 'Please contact your academic advisor to adjust your schedule or choose alternative sections.', s: 'accepted', u: 4 },
    { q: 'How many credit hours can I register for per semester?', a: 'The maximum allowed is 18 credit hours. More than that requires special approval.', s: 'accepted', u: 1 },
    { q: 'What happens if my GPA drops below 2.0?', a: 'You will be placed on academic probation and required to meet with your academic advisor.', s: 'accepted', u: 2 },
    { q: 'Can I drop a course after the add/drop deadline?', a: null, s: 'pending', u: 0 }, // asked by student 0
    { q: 'How do I apply for graduation?', a: null, s: 'pending', u: 4 },
    { q: 'Are summer courses counted toward my GPA?', a: null, s: 'pending', u: 0 }
];

// ==========================================
// 2. GENERATION LOGIC
// ==========================================

const insertData = async () => {
    try {
        console.log('🔄 Starting Database Reset and Population...\n');

        hashedPassword = await bcrypt.hash(PASSWORD, 10);

        // 1. Clear Database
        console.log('🧹 Clearing existing data...');
        await config.query('SET FOREIGN_KEY_CHECKS = 0');
        const tables = [
            'audit_logs', 'messages', 'appointments', 'course_requests',
            'student_courses', 'advising_notes', 'course_prerequisites',
            'courses', 'students', 'advisors', 'departments',
            'announcements', 'system_settings', 'faqs', 'users'
        ];
        for (const table of tables) {
            await config.query(`TRUNCATE TABLE ${table}`);
        }
        await config.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('✅ Database cleared.');

        // 2. Insert Departments
        console.log('\n📝 Inserting departments...');
        const deptMap = {};
        for (const dept of DEPARTMENTS) {
            const res = await config.query(`INSERT INTO departments (name, code, description) VALUES (?, ?, ?)`, [dept.name, dept.code, dept.description]);
            deptMap[dept.code] = res.insertId;
        }
        console.log(`✅ ${DEPARTMENTS.length} departments inserted.`);

        // 3. Insert Courses
        console.log('\n📝 Inserting courses...');
        const courseMap = {};
        // First pass: Insert courses
        for (const c of COURSES) {
            const semester = Math.random() > 0.5 ? 'Fall 2024' : 'Spring 2025';
            const deptId = deptMap[c.dept] || deptMap['BUS']; // Default to BUS if dept missing
            const res = await config.query(
                `INSERT INTO courses (code, name, description, credits, department_id, semester, capacity, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [c.code, c.name, `${c.name} course description`, c.credits, deptId, semester, 35, 1]
            );
            courseMap[c.code] = res.insertId;
        }
        // Second pass: Prerequisites
        let prereqCount = 0;
        for (const c of COURSES) {
            if (c.prereqs) {
                const cId = courseMap[c.code];
                for (const pCode of c.prereqs) {
                    const pId = courseMap[pCode];
                    if (cId && pId) {
                        await config.query(`INSERT INTO course_prerequisites (course_id, prerequisite_course_id) VALUES (?, ?)`, [cId, pId]);
                        prereqCount++;
                    }
                }
            }
        }
        console.log(`✅ ${COURSES.length} courses and ${prereqCount} prerequisites inserted.`);

        // 4. Insert Users (Admin, Advisors, Students)
        console.log('\n📝 Inserting users...');

        // --- Admin ---
        const adminUserIds = [];
        for (const name of ADMINS) {
            const username = `${name[0].toLowerCase()}.${name[1].toLowerCase()}`;
            const res = await config.query(
                `INSERT INTO users (username, email, password_hash, role, first_name, last_name, phone, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [username, `${username}@admin.liu.edu.lb`, hashedPassword, 'admin', name[0], name[1], '123456', 1]
            );
            adminUserIds.push(res.insertId);
        }

        // --- Advisors ---
        const advisorUserIds = [];
        const advisorIds = [];
        let advIndex = 0;
        for (const name of ADVISORS) {
            const username = `${name[0].toLowerCase()}.${name[1].toLowerCase()}`;
            const res = await config.query(
                `INSERT INTO users (username, email, password_hash, role, first_name, last_name, phone, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [username, `${username}@advisor.liu.edu.lb`, hashedPassword, 'advisor', name[0], name[1], '123456', 1]
            );
            advisorUserIds.push(res.insertId);

            // Create Advisor profile
            const deptId = deptMap['BUS']; // Assign all to Business for simplicity based on major prompt
            const advRes = await config.query(
                `INSERT INTO advisors (user_id, department_id, office_location, phone_extension) VALUES (?, ?, ?, ?)`,
                [res.insertId, deptId, `Room ${100 + advIndex}`, `10${advIndex}`]
            );
            advisorIds.push(advRes.insertId);
            advIndex++;
        }

        // --- Students ---
        const studentUserIds = [];
        const studentIds = [];
        let stuIndex = 0;
        for (const name of STUDENTS) {
            const studentNum = 40000001 + stuIndex;
            const res = await config.query(
                `INSERT INTO users (username, email, password_hash, role, first_name, last_name, phone, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [`${studentNum}`, `${studentNum}@students.liu.edu.lb`, hashedPassword, 'student', name[0], name[1], '123456', 1]
            );
            studentUserIds.push(res.insertId);

            // Create Student profile
            // Assign advisor round-robin
            const advisorId = advisorIds[stuIndex % advisorIds.length];
            const majorId = deptMap['BUS'];
            const stuRes = await config.query(
                `INSERT INTO students (user_id, student_number, major_id, advisor_id, gpa, enrollment_date, expected_graduation) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [res.insertId, `${studentNum}`, majorId, advisorId, 3.0, '2023-09-01', '2027-06-01']
            );
            studentIds.push(stuRes.insertId);
            stuIndex++;
        }
        console.log(`✅ Users inserted: 1 Admin, ${advisorIds.length} Advisors, ${studentIds.length} Students.`);

        // 5. Insert Enrollments (Sample)
        console.log('\n📝 Inserting sample enrollments...');

        // Define allowable courses for Business Majors (BUS + all Gen Ed / English which are ENGL/ARAB/CULT)
        // In this specific dataset layout, BUS students take BUS courses and English/GenEd courses.
        // We find the IDs for these courses.
        const businessCourseIds = [];
        for (const [code, id] of Object.entries(courseMap)) {
           

            // However, to be safe and logic-proof for future:
            businessCourseIds.push(id);
        }

        for (const sId of studentIds) {
            const shuffled = [...businessCourseIds].sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, 5);
            for (const cId of selected) {
                await config.query(
                    `INSERT INTO student_courses (student_id, course_id, semester, grade, status) VALUES (?, ?, ?, ?, ?)`,
                    [sId, cId, 'Fall 2024', ['A', 'B', 'C'][Math.floor(Math.random() * 3)], 'completed']
                );
            }
            // And 3 current courses
            const current = shuffled.slice(5, 8);
            for (const cId of current) {
                await config.query(
                    `INSERT INTO student_courses (student_id, course_id, semester, status) VALUES (?, ?, ?, ?)`,
                    [sId, cId, 'Spring 2025', 'current']
                );
            }
        }
        console.log('✅ Enrollments inserted.');

        // 6. Insert Random Appointments (Appointments table)
        console.log('\n📝 Inserting sample appointments...');
        const appointmentTypes = ['in_person', 'virtual'];
        const appStatuses = ['scheduled', 'completed'];
        for (const sId of studentIds) {
            const studentIndex = studentIds.indexOf(sId);
            const advisorId = advisorIds[studentIndex % advisorIds.length];
            // 1 past, 1 future
            await config.query(
                `INSERT INTO appointments (student_id, advisor_id, appointment_date, duration_minutes, status, meeting_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [sId, advisorId, '2024-11-15 10:00:00', 30, 'completed', 'in_person', 'Discussed Fall semester progress.']
            );
            await config.query(
                `INSERT INTO appointments (student_id, advisor_id, appointment_date, duration_minutes, status, meeting_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [sId, advisorId, '2025-02-20 14:00:00', 30, 'scheduled', 'virtual', 'Spring registration follow-up.']
            );
        }
        console.log('✅ Appointments inserted.');

        // 7. Insert Advising Notes (Advising_notes table)
        console.log('\n📝 Inserting advising notes...');
        for (const sId of studentIds) {
            const studentIndex = studentIds.indexOf(sId);
            const advisorId = advisorIds[studentIndex % advisorIds.length];
            await config.query(
                `INSERT INTO advising_notes (student_id, advisor_id, content, note_type, is_visible_to_student) VALUES (?, ?, ?, ?, ?)`,
                [sId, advisorId, 'Student is on track for graduation.', 'progress_update', 1]
            );
        }
        console.log('✅ Advising notes inserted.');

        // 8. Insert Messages (Messages table)
        console.log('\n📝 Inserting messages...');
        // Student questions advisor
        for (let i = 0; i < studentUserIds.length; i++) {
            const sUserId = studentUserIds[i];
            const aUserId = advisorUserIds[i % advisorUserIds.length];
            await config.query(
                `INSERT INTO messages (sender_id, recipient_id, subject, content, is_read) VALUES (?, ?, ?, ?, ?)`,
                [sUserId, aUserId, 'Question about registration', 'Hello, can I register for 18 credits properly?', 0]
            );
            // Advisor replies
            await config.query(
                `INSERT INTO messages (sender_id, recipient_id, subject, content, is_read) VALUES (?, ?, ?, ?, ?)`,
                [aUserId, sUserId, 'Re: Question about registration', 'Yes, as long as your GPA is above 2.0.', 1]
            );
        }
        console.log('✅ Messages inserted.');

        // 9. Insert Announcements (Announcements table)
        console.log('\n📝 Inserting announcements...');
        await config.query(
            `INSERT INTO announcements (created_by, title, content, target_role, priority, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
            [adminUserIds[0], 'Spring 2025 Registration', 'Registration for Spring 2025 is now open. Detailed schedule is attached.', 'students', 'high', 1]
        );
        await config.query(
            `INSERT INTO announcements (created_by, title, content, target_role, priority, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
            [adminUserIds[0], 'System Maintenance', 'Server will be down on Sunday for 2 hours.', 'all', 'medium', 1]
        );
        console.log('✅ Announcements inserted.');

        // 10. Insert Course Requests (Course_requests table)
        console.log('\n📝 Inserting course requests...');
        // Some pending requests
        const requestCourses = Object.values(courseMap).slice(0, 3);
        const sIdReq = studentIds[0];
        const aIdReq = advisorIds[0];
        // Pending
        await config.query(
            `INSERT INTO course_requests (student_id, course_id, request_type, status, requested_semester) VALUES (?, ?, ?, ?, ?)`,
            [sIdReq, requestCourses[0], 'register', 'pending', 'Spring 2025']
        );
        // Approved
        await config.query(
            `INSERT INTO course_requests (student_id, course_id, request_type, status, requested_semester, approved_by, decision_date) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [sIdReq, requestCourses[1], 'add', 'approved', 'Spring 2025', aIdReq]
        );
        console.log('✅ Course requests inserted.');

        // 11. Insert FAQs (New Table)
        console.log('\n📝 Inserting FAQs...');
        for (const f of FAQS) {
            // Map 'asked_by' to a real student user id
            const askedByUserId = studentUserIds[f.u % studentUserIds.length];
            await config.query(
                `INSERT INTO faqs (question, answer, asked_by, status) VALUES (?, ?, ?, ?)`,
                [f.q, f.a, askedByUserId, f.s]
            );
        }
        console.log(`✅ ${FAQS.length} FAQs inserted.`);

        // 7. Update System Settings
        await config.query(`INSERT INTO system_settings (setting_key, setting_value, description) VALUES (?, ?, ?)`,
            ['current_semester', 'Spring 2025', 'Current Active Semester']
        );

        console.log('\n' + '═'.repeat(60));
        console.log('✨ Data Generation Complete!');
        console.log(`Admin User: george.karam (Pass: ${PASSWORD})`);
        console.log(`Student User: 40000001 (Pass: ${PASSWORD})`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        process.exit();
    }
};

const main = async () => {
    const connected = await config.testConnection();
    if (connected) await insertData();
    else process.exit(1);
};

main();
