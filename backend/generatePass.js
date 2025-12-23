// generate.js - Populate database with sample data for Lebanese International University
const config = require('./config');
const bcrypt = require('bcryptjs');

const PASSWORD = 'pass123';
let hashedPassword;

// Departments based on LIU programs
const DEPARTMENTS = [
  { name: 'Computer Science', code: 'CSCI', description: 'Department of Computer Science - Bachelor of Science in Computer Science' },
  { name: 'Computer Engineering', code: 'CENG', description: 'Department of Computer Engineering - Bachelor of Science in Computer Engineering' },
  { name: 'Business Administration', code: 'BUS', description: 'Department of Business Administration - Accounting Concentration' },
  { name: 'Mathematics', code: 'MATH', description: 'Department of Mathematics' },
  { name: 'English', code: 'ENGL', description: 'Department of English Language' },
  { name: 'Electrical Engineering', code: 'EENG', description: 'Department of Electrical Engineering' }
];

// Real courses from LIU Program of Studies PDFs
const COURSES = [
  // ============ COMPUTER SCIENCE (CSCI) COURSES ============
  { code: 'CSCI200', name: 'Introduction to Computers', credits: 3, dept: 'CSCI' },
  { code: 'CSCI205', name: 'Computer Science Overview', credits: 3, dept: 'CSCI' },
  { code: 'CSCI250', name: 'Introduction to Programming', credits: 3, dept: 'CSCI' },
  { code: 'CSCI250L', name: 'Introduction to Programming Lab', credits: 1, dept: 'CSCI' },
  { code: 'CSCI300', name: 'Intermediate Programming with Objects', credits: 3, dept: 'CSCI' },
  { code: 'CSCI300L', name: 'Intermediate Programming with Objects Lab', credits: 1, dept: 'CSCI' },
  { code: 'CSCI335', name: 'Database Systems', credits: 3, dept: 'CSCI' },
  { code: 'CSCI342', name: 'Fundamentals of Networking Technologies', credits: 3, dept: 'CSCI' },
  { code: 'CSCI345', name: 'Digital Logic', credits: 3, dept: 'CSCI' },
  { code: 'CSCI351', name: 'Concepts of Programming Languages', credits: 3, dept: 'CSCI' },
  { code: 'CSCI362', name: 'Network Security', credits: 3, dept: 'CSCI' },
  { code: 'CSCI370', name: 'Visual Programming', credits: 3, dept: 'CSCI' },
  { code: 'CSCI372', name: 'Natural Language Processing', credits: 3, dept: 'CSCI' },
  { code: 'CSCI373', name: 'Robotics Design & Coding', credits: 3, dept: 'CSCI' },
  { code: 'CSCI378', name: 'Data Structures and Algorithms', credits: 3, dept: 'CSCI' },
  { code: 'CSCI380', name: 'Software Engineering', credits: 3, dept: 'CSCI' },
  { code: 'CSCI390', name: 'Web Programming', credits: 3, dept: 'CSCI' },
  { code: 'CSCI392', name: 'Computer Networks', credits: 3, dept: 'CSCI' },
  { code: 'CSCI410', name: 'Mobile Application', credits: 3, dept: 'CSCI' },
  { code: 'CSCI426', name: 'Web Programming Advanced', credits: 3, dept: 'CSCI' },
  { code: 'CSCI430', name: 'Operating Systems', credits: 3, dept: 'CSCI' },
  { code: 'CSCI430L', name: 'Operating Systems Lab', credits: 1, dept: 'CSCI' },
  { code: 'CSCI435', name: 'Computer Architecture', credits: 3, dept: 'CSCI' },
  { code: 'CSCI441', name: 'Machine Learning', credits: 3, dept: 'CSCI' },
  { code: 'CSCI443', name: 'Game Development', credits: 3, dept: 'CSCI' },
  { code: 'CSCI452', name: 'Topics in Computer Science', credits: 1, dept: 'CSCI' },
  { code: 'CSCI454', name: 'Advanced Robotics', credits: 3, dept: 'CSCI' },
  { code: 'CSCI475', name: 'Artificial Intelligence', credits: 3, dept: 'CSCI' },
  { code: 'CSCI490', name: 'Information System Development', credits: 3, dept: 'CSCI' },

  // ============ COMPUTER ENGINEERING (CENG) COURSES ============
  { code: 'CENG250', name: 'Digital Logic I', credits: 3, dept: 'CENG' },
  { code: 'CENG325', name: 'Software Applications and Design', credits: 3, dept: 'CENG' },
  { code: 'CENG335', name: 'Digital Logic II', credits: 3, dept: 'CENG' },
  { code: 'CENG352L', name: 'Digital Logic Circuits Lab', credits: 1, dept: 'CENG' },
  { code: 'CENG375', name: 'Introduction to Database Systems', credits: 3, dept: 'CENG' },
  { code: 'CENG380', name: 'Microprocessors and Microcontrollers', credits: 3, dept: 'CENG' },
  { code: 'CENG400', name: 'Computer Organization and Design', credits: 3, dept: 'CENG' },
  { code: 'CENG400L', name: 'Microcontroller Applications Lab', credits: 1, dept: 'CENG' },
  { code: 'CENG415', name: 'Communication Networks', credits: 3, dept: 'CENG' },
  { code: 'CENG420', name: 'Web Programming and Technologies', credits: 3, dept: 'CENG' },
  { code: 'CENG430L', name: 'Linux Lab', credits: 1, dept: 'CENG' },
  { code: 'CENG435', name: 'Mobile Application Development', credits: 3, dept: 'CENG' },
  { code: 'CENG450L', name: 'Scripting Languages Lab', credits: 1, dept: 'CENG' },
  { code: 'CENG455L', name: 'Communication Networks Lab', credits: 1, dept: 'CENG' },
  { code: 'CENG460', name: 'Operating Systems', credits: 3, dept: 'CENG' },
  { code: 'CENG470', name: 'Data Structures and Analysis of Algorithms', credits: 3, dept: 'CENG' },
  { code: 'CENG495', name: 'Senior Project', credits: 3, dept: 'CENG' },

  // ============ BUSINESS/ACCOUNTING (BBAA) COURSES ============
  { code: 'BACC200', name: 'Financial Accounting', credits: 3, dept: 'BUS' },
  { code: 'BACC250', name: 'Managerial Accounting', credits: 3, dept: 'BUS' },
  { code: 'BACC330', name: 'Intermediate Financial Accounting I', credits: 3, dept: 'BUS' },
  { code: 'BACC340', name: 'Advanced Managerial Accounting', credits: 3, dept: 'BUS' },
  { code: 'BACC350', name: 'Accounting Information Systems and Applications', credits: 3, dept: 'BUS' },
  { code: 'BACC370', name: 'Intermediate Financial Accounting II', credits: 3, dept: 'BUS' },
  { code: 'BACC420', name: 'Tax Accounting', credits: 3, dept: 'BUS' },
  { code: 'BACC430', name: 'Auditing and Fraud Prevention', credits: 3, dept: 'BUS' },
  { code: 'BACC497', name: 'Advanced Accounting', credits: 3, dept: 'BUS' },
  { code: 'BACC499', name: 'Senior Project In Accounting', credits: 3, dept: 'BUS' },
  { code: 'BECO250', name: 'Introduction to Microeconomics', credits: 3, dept: 'BUS' },
  { code: 'BECO301', name: 'Introduction to Macroeconomics', credits: 3, dept: 'BUS' },
  { code: 'BFIN250', name: 'Introduction to Finance', credits: 3, dept: 'BUS' },
  { code: 'BMGT200', name: 'Introduction to Business Management', credits: 3, dept: 'BUS' },
  { code: 'BMGT315', name: 'Human Resource Management', credits: 3, dept: 'BUS' },
  { code: 'BMGT350', name: 'Introduction to Business Law', credits: 3, dept: 'BUS' },
  { code: 'BMGT351', name: 'Organizational Behavior', credits: 3, dept: 'BUS' },
  { code: 'BMGT401', name: 'Business Ethics', credits: 3, dept: 'BUS' },
  { code: 'BMGT491', name: 'Global Strategic Management', credits: 3, dept: 'BUS' },
  { code: 'BMGT496', name: 'Research Methods for Business', credits: 3, dept: 'BUS' },
  { code: 'BMIS250', name: 'Management Information Systems', credits: 3, dept: 'BUS' },
  { code: 'BMIS401', name: 'Operations Management', credits: 3, dept: 'BUS' },
  { code: 'BMKT250', name: 'Marketing Theory and Principles', credits: 3, dept: 'BUS' },
  { code: 'BMTH210', name: 'Business and Managerial Math', credits: 3, dept: 'BUS' },
  { code: 'BSTA205', name: 'Introduction to Business Statistics', credits: 3, dept: 'BUS' },

  // ============ MATHEMATICS COURSES ============
  { code: 'MATH210', name: 'Calculus II', credits: 3, dept: 'MATH' },
  { code: 'MATH220', name: 'Calculus III', credits: 3, dept: 'MATH' },
  { code: 'MATH225', name: 'Linear Algebra with Applications', credits: 3, dept: 'MATH' },
  { code: 'MATH260', name: 'Discrete Mathematics', credits: 3, dept: 'MATH' },
  { code: 'MATH270', name: 'Ordinary Differential Equations', credits: 3, dept: 'MATH' },
  { code: 'MATH310', name: 'Probability & Statistics for Scientists & Engineers', credits: 3, dept: 'MATH' },
  { code: 'MATH375', name: 'Numerical Methods for Scientists & Engineers', credits: 3, dept: 'MATH' },

  // ============ ENGLISH COURSES ============
  { code: 'ENGL201', name: 'Composition and Research Skills', credits: 3, dept: 'ENGL' },
  { code: 'ENGL251', name: 'Communication Skills', credits: 3, dept: 'ENGL' },

  // ============ GENERAL/CULTURAL COURSES ============
  { code: 'ARAB200', name: 'Arabic Language and Literature', credits: 3, dept: 'ENGL' },
  { code: 'CULT200', name: 'Introduction to Arab - Islamic Civilization', credits: 3, dept: 'ENGL' },

  // ============ ELECTRICAL ENGINEERING COURSES ============
  { code: 'EENG250', name: 'Electric Circuits I', credits: 3, dept: 'EENG' },
  { code: 'EENG300', name: 'Electric Circuits II', credits: 3, dept: 'EENG' },
  { code: 'EENG301L', name: 'Electric Circuits Lab', credits: 1, dept: 'EENG' },
  { code: 'EENG350', name: 'Electronic Circuits I', credits: 3, dept: 'EENG' },
  { code: 'EENG350L', name: 'Electronic Circuits I Lab', credits: 1, dept: 'EENG' },
  { code: 'EENG385', name: 'Signals and Systems', credits: 3, dept: 'EENG' },
  { code: 'EENG447', name: 'Analog Communication Systems', credits: 3, dept: 'EENG' },
  { code: 'EENG467L', name: 'Analog Communication Systems Lab', credits: 1, dept: 'EENG' },

  // ============ ENGINEERING GENERAL COURSES ============
  { code: 'ENGG200', name: 'Introduction to Engineering', credits: 3, dept: 'CENG' },
  { code: 'ENGG300', name: 'Engineering Economics', credits: 3, dept: 'CENG' },
  { code: 'ENGG450', name: 'Engineering Ethics and Professional Practice', credits: 3, dept: 'CENG' },

  // ============ PHYSICS COURSES ============
  { code: 'PHYS220', name: 'Physics for Engineers', credits: 3, dept: 'CENG' }
];

// Course prerequisites based on LIU Program of Studies
const PREREQUISITES = [
  // CSCI Prerequisites
  { course: 'CSCI250', prerequisite: 'CSCI205' },
  { course: 'CSCI250', prerequisite: 'CSCI200' },
  { course: 'CSCI250L', prerequisite: 'CSCI205' },
  { course: 'CSCI250L', prerequisite: 'CSCI200' },
  { course: 'CSCI300', prerequisite: 'CSCI250L' },
  { course: 'CSCI300', prerequisite: 'CSCI250' },
  { course: 'CSCI300L', prerequisite: 'CSCI250' },
  { course: 'CSCI335', prerequisite: 'CSCI250' },
  { course: 'CSCI342', prerequisite: 'CSCI250' },
  { course: 'CSCI345', prerequisite: 'CSCI250' },
  { course: 'CSCI373', prerequisite: 'CSCI250' },
  { course: 'CSCI351', prerequisite: 'CSCI300' },
  { course: 'CSCI378', prerequisite: 'CSCI300' },
  { course: 'CSCI380', prerequisite: 'ENGL201' },
  { course: 'CSCI380', prerequisite: 'CSCI335' },
  { course: 'CSCI390', prerequisite: 'CSCI335' },
  { course: 'CSCI390', prerequisite: 'CSCI300' },
  { course: 'CSCI392', prerequisite: 'CSCI342' },
  { course: 'CSCI362', prerequisite: 'CSCI342' },
  { course: 'CSCI362', prerequisite: 'CSCI300' },
  { course: 'CSCI370', prerequisite: 'CSCI335' },
  { course: 'CSCI370', prerequisite: 'CSCI300' },
  { course: 'CSCI372', prerequisite: 'CSCI300' },
  { course: 'CSCI410', prerequisite: 'CSCI300' },
  { course: 'CSCI410', prerequisite: 'CSCI335' },
  { course: 'CSCI426', prerequisite: 'CSCI390' },
  { course: 'CSCI430', prerequisite: 'CSCI300' },
  { course: 'CSCI430L', prerequisite: 'CSCI300' },
  { course: 'CSCI435', prerequisite: 'CSCI345' },
  { course: 'CSCI441', prerequisite: 'CSCI378' },
  { course: 'CSCI443', prerequisite: 'CSCI378' },
  { course: 'CSCI452', prerequisite: 'CSCI390' },
  { course: 'CSCI454', prerequisite: 'CSCI373' },
  { course: 'CSCI475', prerequisite: 'CSCI378' },
  { course: 'CSCI490', prerequisite: 'CSCI390' },
  { course: 'CSCI490', prerequisite: 'CSCI380' },

  // MATH Prerequisites
  { course: 'MATH260', prerequisite: 'MATH225' },
  { course: 'MATH220', prerequisite: 'MATH210' },
  { course: 'MATH270', prerequisite: 'MATH210' },
  { course: 'MATH310', prerequisite: 'MATH210' },
  { course: 'MATH375', prerequisite: 'MATH225' },

  // ENGL Prerequisites
  { course: 'ENGL251', prerequisite: 'ENGL201' },

  // Business/Accounting Prerequisites
  { course: 'BACC250', prerequisite: 'BACC200' },
  { course: 'BACC330', prerequisite: 'BACC200' },
  { course: 'BACC340', prerequisite: 'BACC250' },
  { course: 'BACC350', prerequisite: 'BACC200' },
  { course: 'BACC370', prerequisite: 'BACC330' },
  { course: 'BACC420', prerequisite: 'BACC200' },
  { course: 'BACC430', prerequisite: 'ENGL201' },
  { course: 'BACC430', prerequisite: 'BACC200' },
  { course: 'BACC497', prerequisite: 'BACC330' },
  { course: 'BACC499', prerequisite: 'BACC420' },
  { course: 'BACC499', prerequisite: 'BACC370' },
  { course: 'BECO250', prerequisite: 'BMTH210' },
  { course: 'BECO301', prerequisite: 'BMTH210' },
  { course: 'BFIN250', prerequisite: 'BACC200' },
  { course: 'BMGT315', prerequisite: 'BMGT200' },
  { course: 'BMGT350', prerequisite: 'BMGT200' },
  { course: 'BMGT351', prerequisite: 'BMGT200' },
  { course: 'BMGT401', prerequisite: 'BMGT200' },
  { course: 'BMGT491', prerequisite: 'BMGT200' },
  { course: 'BMGT496', prerequisite: 'BSTA205' },
  { course: 'BMGT496', prerequisite: 'BMGT200' },
  { course: 'BMIS401', prerequisite: 'BSTA205' },

  // CENG Prerequisites
  { course: 'CENG335', prerequisite: 'CSCI250' },
  { course: 'CENG335', prerequisite: 'CENG250' },
  { course: 'CENG375', prerequisite: 'CENG325' },
  { course: 'CENG375', prerequisite: 'CSCI300' },
  { course: 'CENG380', prerequisite: 'CENG250' },
  { course: 'CENG380', prerequisite: 'CENG335' },
  { course: 'CENG380', prerequisite: 'EENG250' },
  { course: 'CENG380', prerequisite: 'CSCI250' },
  { course: 'CENG400', prerequisite: 'CENG335' },
  { course: 'CENG400', prerequisite: 'CENG250' },
  { course: 'CENG400', prerequisite: 'CENG380' },
  { course: 'CENG400L', prerequisite: 'CENG380' },
  { course: 'CENG415', prerequisite: 'CENG250' },
  { course: 'CENG415', prerequisite: 'CENG325' },
  { course: 'CENG415', prerequisite: 'CSCI250' },
  { course: 'CENG415', prerequisite: 'CSCI300' },
  { course: 'CENG420', prerequisite: 'CENG325' },
  { course: 'CENG420', prerequisite: 'CSCI300' },
  { course: 'CENG420', prerequisite: 'CENG375' },
  { course: 'CENG430L', prerequisite: 'CENG380' },
  { course: 'CENG430L', prerequisite: 'CENG325' },
  { course: 'CENG435', prerequisite: 'CENG325' },
  { course: 'CENG435', prerequisite: 'CSCI300' },
  { course: 'CENG435', prerequisite: 'CENG375' },
  { course: 'CENG450L', prerequisite: 'CENG430L' },
  { course: 'CENG455L', prerequisite: 'CENG415' },
  { course: 'CENG460', prerequisite: 'CENG380' },
  { course: 'CENG460', prerequisite: 'CSCI300' },
  { course: 'CENG470', prerequisite: 'CENG325' },
  { course: 'CENG470', prerequisite: 'CSCI300' },
  { course: 'CENG495', prerequisite: 'CENG420' },
  { course: 'CENG495', prerequisite: 'EENG350' },
  { course: 'CENG495', prerequisite: 'EENG447' },
  { course: 'CENG495', prerequisite: 'CENG435' },
  { course: 'CENG495', prerequisite: 'CENG415' },
  { course: 'CENG495', prerequisite: 'CENG380' },
  { course: 'CENG495', prerequisite: 'CENG375' },

  // EENG Prerequisites
  { course: 'EENG300', prerequisite: 'EENG250' },
  { course: 'EENG301L', prerequisite: 'EENG250' },
  { course: 'EENG350', prerequisite: 'ENGG200' },
  { course: 'EENG350', prerequisite: 'CENG250' },
  { course: 'EENG350', prerequisite: 'EENG300' },
  { course: 'EENG350', prerequisite: 'EENG250' },
  { course: 'EENG350L', prerequisite: 'EENG300' },
  { course: 'EENG350L', prerequisite: 'EENG250' },
  { course: 'EENG350L', prerequisite: 'EENG301L' },
  { course: 'EENG385', prerequisite: 'MATH225' },
  { course: 'EENG385', prerequisite: 'EENG300' },
  { course: 'EENG447', prerequisite: 'MATH310' },
  { course: 'EENG447', prerequisite: 'EENG385' },
  { course: 'EENG467L', prerequisite: 'EENG447' }
];

// Lebanese student names (first name, last name)
const LEBANESE_STUDENT_NAMES = [
  ['Ahmad', 'Hammoud'],
  ['Fatima', 'Nasrallah'],
  ['Hussein', 'Khalil'],
  ['Zahra', 'Bazzi'],
  ['Mohammad', 'Awada'],
  ['Nour', 'Harb'],
  ['Ali', 'Fakhry'],
  ['Maya', 'Khoury'],
  ['Omar', 'Moussa'],
  ['Lara', 'Haddad'],
  ['Hassan', 'Saad'],
  ['Rania', 'Abou Zeid'],
  ['Karim', 'Jaber'],
  ['Sara', 'El Amine'],
  ['Bilal', 'Fakih'],
  ['Yasmine', 'Daher'],
  ['Rami', 'Chamoun'],
  ['Hala', 'Farhat'],
  ['Khaled', 'Taha'],
  ['Nadia', 'Saleh'],
  ['Ayman', 'Hajj'],
  ['Dina', 'Assaf'],
  ['Fadi', 'Noun'],
  ['Maryam', 'Raad'],
  ['Sami', 'Abdallah'],
  ['Layla', 'Ismail'],
  ['Tarek', 'Shaheen'],
  ['Rana', 'Makhlouf'],
  ['Wael', 'Kassem'],
  ['Ghada', 'Youssef']
];

// Lebanese advisor names (4 advisors)
const LEBANESE_ADVISOR_NAMES = [
  ['Mahmoud', 'Hijazi'],
  ['Samira', 'Fawaz'],
  ['Imad', 'Sleiman'],
  ['Hanan', 'Chehab']
];

// Lebanese admin name (1 admin)
const LEBANESE_ADMIN_NAMES = [
  ['Georges', 'Karam']
];

// Generate sample users with Lebanese data
const generateUsers = () => {
  const users = [];
  
  // Admin (1 admin)
  LEBANESE_ADMIN_NAMES.forEach((name, i) => {
    const firstName = name[0].toLowerCase();
    const lastName = name[1].toLowerCase();
    users.push({
      username: `${firstName}.${lastName}`,
      email: `${firstName}.${lastName}@admin.liu.edu.lb`,
      password_hash: hashedPassword,
      role: 'admin',
      first_name: name[0],
      last_name: name[1],
      phone: '+961 1 500 000',
      is_active: 1
    });
  });

  // Advisors (4 advisors)
  LEBANESE_ADVISOR_NAMES.forEach((name, i) => {
    const firstName = name[0].toLowerCase();
    const lastName = name[1].toLowerCase();
    users.push({
      username: `${firstName}.${lastName}`,
      email: `${firstName}.${lastName}@advisor.liu.edu.lb`,
      password_hash: hashedPassword,
      role: 'advisor',
      first_name: name[0],
      last_name: name[1],
      phone: `+961 3 ${String(100000 + i * 11111).slice(0, 3)} ${String(100000 + i * 11111).slice(3)}`,
      is_active: 1
    });
  });

  // Students with Lebanese names and 40000000 format IDs
  LEBANESE_STUDENT_NAMES.forEach((name, i) => {
    const studentNumber = 40000000 + i + 1; // 40000001, 40000002, etc.
    users.push({
      username: `${studentNumber}`,
      email: `${studentNumber}@students.liu.edu.lb`,
      password_hash: hashedPassword,
      role: 'student',
      first_name: name[0],
      last_name: name[1],
      phone: `+961 ${Math.random() > 0.5 ? '3' : '71'} ${String(Math.floor(100000 + Math.random() * 900000)).slice(0, 3)} ${String(Math.floor(100000 + Math.random() * 900000)).slice(3, 6)}`,
      is_active: 1,
      student_number: studentNumber
    });
  });

  return users;
};

// Insert data into database
const insertData = async () => {
  try {
    console.log('🔄 Starting LIU database population...\n');
    console.log('🇱🇧 Lebanese International University - Academic Advising System\n');

    // Hash password
    hashedPassword = await bcrypt.hash(PASSWORD, 10);
    console.log('✅ Password hashed successfully');

    // Generate users
    const users = generateUsers();

    // 1. Insert Users
    console.log('\n📝 Inserting users...');
    const userIds = {};
    for (const user of users) {
      const sql = `INSERT INTO users (username, email, password_hash, role, first_name, last_name, phone, is_active) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      const params = [user.username, user.email, user.password_hash, user.role, user.first_name, user.last_name, user.phone, user.is_active];
      const result = await config.query(sql, params);
      userIds[user.username] = result.insertId;
    }
    console.log(`✅ Inserted ${users.length} users`);

    // 2. Insert Departments
    console.log('\n📝 Inserting departments...');
    const deptMap = {};
    for (const dept of DEPARTMENTS) {
      const sql = `INSERT INTO departments (name, code, description) VALUES (?, ?, ?)`;
      const result = await config.query(sql, [dept.name, dept.code, dept.description]);
      deptMap[dept.code] = result.insertId;
    }
    console.log(`✅ Inserted ${DEPARTMENTS.length} departments`);

    // 3. Update department heads (assign the admin)
    console.log('\n📝 Updating department heads...');
    const adminUsername = `${LEBANESE_ADMIN_NAMES[0][0].toLowerCase()}.${LEBANESE_ADMIN_NAMES[0][1].toLowerCase()}`;
    const adminId = userIds[adminUsername];
    
    for (const code of Object.keys(deptMap)) {
      const sql = `UPDATE departments SET head_id = ? WHERE department_id = ?`;
      await config.query(sql, [adminId, deptMap[code]]);
    }
    console.log('✅ Department heads updated');

    // 4. Insert Advisors
    console.log('\n📝 Inserting advisors...');
    const advisorIds = [];
    const deptCodes = Object.keys(deptMap);
    
    for (let i = 0; i < LEBANESE_ADVISOR_NAMES.length; i++) {
      const name = LEBANESE_ADVISOR_NAMES[i];
      const username = `${name[0].toLowerCase()}.${name[1].toLowerCase()}`;
      const userId = userIds[username];
      const deptId = deptMap[deptCodes[i % deptCodes.length]];
      
      const sql = `INSERT INTO advisors (user_id, department_id, office_location, phone_extension, max_students, is_available) 
                   VALUES (?, ?, ?, ?, ?, ?)`;
      const params = [userId, deptId, `Building ${String.fromCharCode(65 + i)}, Room ${200 + i * 10}`, `${1000 + i}`, 50, 1];
      const result = await config.query(sql, params);
      advisorIds.push(result.insertId);
    }
    console.log(`✅ Inserted ${advisorIds.length} advisors`);

    // 5. Insert Courses
    console.log('\n📝 Inserting courses...');
    const courseMap = {};
    for (const course of COURSES) {
      const deptId = deptMap[course.dept];
      if (!deptId) {
        console.warn(`⚠️ Department ${course.dept} not found for course ${course.code}`);
        continue;
      }
      const sql = `INSERT INTO courses (code, name, description, credits, department_id, semester, capacity, is_active) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      const params = [course.code, course.name, `${course.name} - LIU Course`, course.credits, deptId, 'Spring 2025', 35, 1];
      const result = await config.query(sql, params);
      courseMap[course.code] = result.insertId;
    }
    console.log(`✅ Inserted ${Object.keys(courseMap).length} courses`);

    // 6. Insert Course Prerequisites
    console.log('\n📝 Inserting course prerequisites...');
    let prereqCount = 0;
    for (const prereq of PREREQUISITES) {
      const courseId = courseMap[prereq.course];
      const prereqId = courseMap[prereq.prerequisite];
      if (courseId && prereqId) {
        const sql = `INSERT INTO course_prerequisites (course_id, prerequisite_course_id) VALUES (?, ?)`;
        await config.query(sql, [courseId, prereqId]);
        prereqCount++;
      }
    }
    console.log(`✅ Inserted ${prereqCount} prerequisites`);

    // 7. Insert Students
    console.log('\n📝 Inserting students...');
    const studentIds = [];
    const majors = ['CSCI', 'CENG', 'BUS']; // Three main programs
    
    for (let i = 0; i < LEBANESE_STUDENT_NAMES.length; i++) {
      const studentNumber = 40000000 + i + 1;
      const username = `${studentNumber}`;
      const userId = userIds[username];
      const advisorId = advisorIds[i % advisorIds.length];
      const majorDept = majors[i % majors.length];
      const majorId = deptMap[majorDept];
      const gpa = (2.0 + Math.random() * 2.0).toFixed(2); // GPA between 2.0 and 4.0
      
      // Determine year based on student number pattern
      const year = Math.floor(i / 10) + 1;
      const enrollmentYear = 2025 - year;
      const graduationYear = enrollmentYear + 4;

      const sql = `INSERT INTO students (user_id, student_number, major_id, advisor_id, gpa, enrollment_date, expected_graduation, academic_status) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      const params = [
        userId,
        studentNumber,
        majorId,
        advisorId,
        parseFloat(gpa),
        `${enrollmentYear}-09-15`,
        `${graduationYear}-06-30`,
        gpa >= 2.0 ? 'good_standing' : 'probation'
      ];
      const result = await config.query(sql, params);
      studentIds.push(result.insertId);
    }
    console.log(`✅ Inserted ${studentIds.length} students`);

    // 8. Insert Student Course Enrollments
    console.log('\n📝 Inserting student course enrollments...');
    let enrollmentCount = 0;
    const courseIds = Object.values(courseMap);
    const semesters = ['Fall 2024', 'Spring 2025'];
    
    for (const studentId of studentIds) {
      // Each student takes 4-6 courses
      const coursesToEnroll = 4 + Math.floor(Math.random() * 3);
      const shuffledCourses = [...courseIds].sort(() => 0.5 - Math.random()).slice(0, coursesToEnroll);
      
      for (const courseId of shuffledCourses) {
        const grades = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', null];
        const statuses = ['completed', 'current', 'in_progress'];
        const grade = grades[Math.floor(Math.random() * grades.length)];
        const semester = semesters[Math.floor(Math.random() * semesters.length)];
        
        const sql = `INSERT INTO student_courses (student_id, course_id, semester, grade, status) 
                     VALUES (?, ?, ?, ?, ?)`;
        const params = [
          studentId,
          courseId,
          semester,
          grade,
          grade ? 'completed' : statuses[Math.floor(Math.random() * statuses.length)]
        ];
        await config.query(sql, params);
        enrollmentCount++;
      }
    }
    console.log(`✅ Inserted ${enrollmentCount} student course enrollments`);

    // 9. Insert Appointments
    console.log('\n📝 Inserting appointments...');
    let appointmentCount = 0;
    const meetingTypes = ['in_person', 'virtual', 'phone'];
    const appointmentPurposes = [
      'Course registration advising',
      'Academic progress review',
      'Major/minor declaration',
      'Graduation requirements review',
      'Career guidance',
      'Course selection assistance'
    ];
    
    for (const studentId of studentIds) {
      const appointmentCount_student = Math.floor(Math.random() * 3) + 1;
      
      for (let i = 0; i < appointmentCount_student; i++) {
        const advisorId = advisorIds[Math.floor(Math.random() * advisorIds.length)];
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + Math.floor(Math.random() * 60) - 30);
        const dateString = futureDate.toISOString().slice(0, 19).replace('T', ' ');
        
        const statuses = ['scheduled', 'completed', 'cancelled', 'no_show'];
        const status = futureDate > new Date() ? 'scheduled' : statuses[Math.floor(Math.random() * statuses.length)];
        
        const sql = `INSERT INTO appointments (student_id, advisor_id, appointment_date, duration_minutes, status, meeting_type, notes) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const params = [
          studentId,
          advisorId,
          dateString,
          30,
          status,
          meetingTypes[Math.floor(Math.random() * meetingTypes.length)],
          appointmentPurposes[Math.floor(Math.random() * appointmentPurposes.length)]
        ];
        await config.query(sql, params);
        appointmentCount++;
      }
    }
    console.log(`✅ Inserted ${appointmentCount} appointments`);

    // 10. Insert Advising Notes
    console.log('\n📝 Inserting advising notes...');
    const noteTypes = ['session_note', 'recommendation', 'warning', 'progress_update'];
    const sampleNotes = [
      'Student is making excellent progress in their major courses.',
      'Recommended to take CSCI441 Machine Learning next semester.',
      'Student should consider retaking MATH210 to improve GPA.',
      'Discussed internship opportunities in the tech industry.',
      'Student expressed interest in pursuing graduate studies.',
      'Academic warning issued - GPA below 2.0 threshold.',
      'Reviewed graduation requirements - on track to graduate.',
      'Student needs to complete ENGL201 before registering for senior courses.'
    ];
    let noteCount = 0;
    
    for (const studentId of studentIds) {
      const noteCount_student = Math.floor(Math.random() * 4);
      
      for (let i = 0; i < noteCount_student; i++) {
        const advisorId = advisorIds[Math.floor(Math.random() * advisorIds.length)];
        const noteType = noteTypes[Math.floor(Math.random() * noteTypes.length)];
        const isVisible = Math.random() > 0.2 ? 1 : 0;
        
        const sql = `INSERT INTO advising_notes (student_id, advisor_id, content, note_type, is_visible_to_student) 
                     VALUES (?, ?, ?, ?, ?)`;
        const params = [
          studentId,
          advisorId,
          sampleNotes[Math.floor(Math.random() * sampleNotes.length)],
          noteType,
          isVisible
        ];
        await config.query(sql, params);
        noteCount++;
      }
    }
    console.log(`✅ Inserted ${noteCount} advising notes`);

    // 11. Insert Course Requests (FIXED - matching actual table schema)
    console.log('\n📝 Inserting course requests...');
    let requestCount = 0;
    
    for (const studentId of studentIds) {
      const requestCount_student = Math.floor(Math.random() * 3);
      
      for (let i = 0; i < requestCount_student; i++) {
        const courseId = courseIds[Math.floor(Math.random() * courseIds.length)];
        const advisorId = advisorIds[Math.floor(Math.random() * advisorIds.length)];
        const requestTypes = ['register', 'add', 'drop'];
        const requestType = requestTypes[Math.floor(Math.random() * requestTypes.length)];
        const statuses = ['pending', 'approved', 'rejected'];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        
        // FIXED: Removed 'reason' column - it doesn't exist in the schema
        const sql = `INSERT INTO course_requests (student_id, course_id, request_type, status, requested_semester, advisor_notes, approved_by) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const params = [
          studentId,
          courseId,
          requestType,
          status,
          'Fall 2025',
          status === 'approved' ? 'Request approved - student meets prerequisites' : 
          status === 'rejected' ? 'Request denied - prerequisite not met' : null,
          status !== 'pending' ? advisorId : null
        ];
        await config.query(sql, params);
        requestCount++;
      }
    }
    console.log(`✅ Inserted ${requestCount} course requests`);

    // 12. Insert Messages
    console.log('\n📝 Inserting messages...');
    let messageCount = 0;
    const messageSubjects = [
      'Course Registration Question',
      'Appointment Request',
      'Academic Progress Update',
      'Graduation Requirements',
      'Schedule Conflict',
      'Major Change Request'
    ];
    const messageContents = [
      'I would like to discuss my course selection for next semester. When would be a good time to meet?',
      'Thank you for your guidance during our last meeting. I have completed the registration as discussed.',
      'I have a question regarding the prerequisites for CSCI441. Can you please clarify?',
      'I am considering adding a minor in Business. Could we discuss the requirements?',
      'My schedule has a conflict between two required courses. Need your advice on how to proceed.'
    ];
    
    // Create messages between students and advisors
    for (let i = 0; i < Math.min(studentIds.length, 15); i++) {
      const studentUserId = userIds[`${40000001 + i}`];
      const advisorName = LEBANESE_ADVISOR_NAMES[i % LEBANESE_ADVISOR_NAMES.length];
      const advisorUsername = `${advisorName[0].toLowerCase()}.${advisorName[1].toLowerCase()}`;
      const advisorUserId = userIds[advisorUsername];
      
      // Student to advisor message
      const sql1 = `INSERT INTO messages (sender_id, recipient_id, subject, content, is_read) 
                   VALUES (?, ?, ?, ?, ?)`;
      await config.query(sql1, [
        studentUserId,
        advisorUserId,
        messageSubjects[Math.floor(Math.random() * messageSubjects.length)],
        messageContents[Math.floor(Math.random() * messageContents.length)],
        Math.random() > 0.3 ? 1 : 0
      ]);
      messageCount++;
      
      // Advisor reply
      if (Math.random() > 0.4) {
        const sql2 = `INSERT INTO messages (sender_id, recipient_id, subject, content, is_read) 
                     VALUES (?, ?, ?, ?, ?)`;
        await config.query(sql2, [
          advisorUserId,
          studentUserId,
          'Re: ' + messageSubjects[Math.floor(Math.random() * messageSubjects.length)],
          'Thank you for reaching out. I would be happy to help. Please visit during my office hours or schedule an appointment through the system.',
          Math.random() > 0.5 ? 1 : 0
        ]);
        messageCount++;
      }
    }
    console.log(`✅ Inserted ${messageCount} messages`);

    // 13. Insert Announcements (FIXED - using correct enum values: all, students, advisors, admin)
    console.log('\n📝 Inserting announcements...');
    const announcements = [
      { 
        title: 'Spring 2025 Registration Now Open', 
        content: 'Dear students, registration for Spring 2025 semester is now open. Please consult with your academic advisor before registering. Registration deadline is January 10, 2025.', 
        priority: 'high',
        target: 'students'
      },
      { 
        title: 'Fall 2025 Course Catalog Available', 
        content: 'The Fall 2025 course catalog is now available. New courses have been added in Computer Science and Computer Engineering departments.', 
        priority: 'medium',
        target: 'all'
      },
      { 
        title: 'Advising Week - January 6-10', 
        content: 'All academic advisors will be available for extended hours during advising week. Walk-in appointments welcome.', 
        priority: 'high',
        target: 'all'
      },
      { 
        title: 'System Maintenance Notice', 
        content: 'The academic advising system will undergo maintenance on Saturday, January 4, 2025 from 2:00 AM to 6:00 AM (Beirut time). Please plan accordingly.', 
        priority: 'medium',
        target: 'all'
      },
      { 
        title: 'Graduation Application Deadline', 
        content: 'Students expecting to graduate in Spring 2025 must submit their graduation application by February 15, 2025.', 
        priority: 'high',
        target: 'students'
      },
      {
        title: 'New Advisor Training Session',
        content: 'Mandatory training session for all advisors on the new advising system features. Date: January 3, 2025 at 10:00 AM.',
        priority: 'high',
        target: 'advisors'
      }
    ];
    
    for (const ann of announcements) {
      const sql = `INSERT INTO announcements (created_by, title, content, target_role, priority, is_active) 
                   VALUES (?, ?, ?, ?, ?, ?)`;
      const params = [adminId, ann.title, ann.content, ann.target, ann.priority, 1];
      await config.query(sql, params);
    }
    console.log(`✅ Inserted ${announcements.length} announcements`);

    // 14. Insert System Settings
    console.log('\n📝 Inserting system settings...');
    const settings = [
      { key: 'university_name', value: 'Lebanese International University', desc: 'Official university name' },
      { key: 'semester_current', value: 'Spring 2025', desc: 'Current active semester' },
      { key: 'semester_start_date', value: '2025-01-20', desc: 'Start date of current semester' },
      { key: 'semester_end_date', value: '2025-05-16', desc: 'End date of current semester' },
      { key: 'registration_start', value: '2025-01-06', desc: 'Course registration start date' },
      { key: 'registration_deadline', value: '2025-01-17', desc: 'Course registration deadline' },
      { key: 'add_drop_deadline', value: '2025-01-31', desc: 'Add/Drop period deadline' },
      { key: 'withdrawal_deadline', value: '2025-03-28', desc: 'Course withdrawal deadline' },
      { key: 'max_credits_per_semester', value: '18', desc: 'Maximum credits allowed per semester' },
      { key: 'min_credits_full_time', value: '12', desc: 'Minimum credits for full-time status' },
      { key: 'gpa_good_standing', value: '2.0', desc: 'Minimum GPA for good academic standing' },
      { key: 'gpa_deans_list', value: '3.5', desc: 'Minimum GPA for Dean\'s List' },
      { key: 'timezone', value: 'Asia/Beirut', desc: 'System timezone' }
    ];
    
    for (const setting of settings) {
      const sql = `INSERT INTO system_settings (setting_key, setting_value, description, updated_by) 
                   VALUES (?, ?, ?, ?)`;
      const params = [setting.key, setting.value, setting.desc, adminId];
      await config.query(sql, params);
    }
    console.log(`✅ Inserted ${settings.length} system settings`);

    // 15. Insert Audit Logs
    console.log('\n📝 Inserting audit logs...');
    const auditActions = [
      { action: 'USER_LOGIN', entity_type: 'user', desc: 'User logged into the system' },
      { action: 'COURSE_REGISTERED', entity_type: 'course', desc: 'Student registered for course' },
      { action: 'APPOINTMENT_CREATED', entity_type: 'appointment', desc: 'New appointment scheduled' },
      { action: 'GRADE_UPDATED', entity_type: 'student_course', desc: 'Grade was updated' },
      { action: 'PROFILE_UPDATED', entity_type: 'user', desc: 'User profile was updated' }
    ];
    
    let auditCount = 0;
    const allUserIds = Object.values(userIds);
    
    for (let i = 0; i < 20; i++) {
      const odUserId = allUserIds[Math.floor(Math.random() * allUserIds.length)];
      const auditAction = auditActions[Math.floor(Math.random() * auditActions.length)];
      
      const sql = `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address) 
                   VALUES (?, ?, ?, ?, ?)`;
      const params = [
        odUserId,
        auditAction.action,
        auditAction.entity_type,
        Math.floor(Math.random() * 100) + 1,
        `192.168.1.${Math.floor(Math.random() * 255)}`
      ];
      await config.query(sql, params);
      auditCount++;
    }
    console.log(`✅ Inserted ${auditCount} audit logs`);

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('✨ LIU Database population completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`  • Admins: ${LEBANESE_ADMIN_NAMES.length}`);
    console.log(`  • Advisors: ${LEBANESE_ADVISOR_NAMES.length}`);
    console.log(`  • Students: ${LEBANESE_STUDENT_NAMES.length}`);
    console.log(`  • Departments: ${DEPARTMENTS.length}`);
    console.log(`  • Courses: ${Object.keys(courseMap).length}`);
    console.log(`  • Prerequisites: ${prereqCount}`);
    console.log(`  • Enrollments: ${enrollmentCount}`);
    console.log(`  • Appointments: ${appointmentCount}`);
    console.log(`  • Advising Notes: ${noteCount}`);
    console.log(`  • Course Requests: ${requestCount}`);
    console.log(`  • Messages: ${messageCount}`);
    console.log(`  • Announcements: ${announcements.length}`);
    console.log(`  • System Settings: ${settings.length}`);
    console.log(`  • Audit Logs: ${auditCount}`);
    
    console.log('\n🔐 Login credentials (Password for all: ' + PASSWORD + ')');
    console.log('─'.repeat(60));
    console.log('\n👤 Admin Account:');
    LEBANESE_ADMIN_NAMES.forEach(name => {
      const email = `${name[0].toLowerCase()}.${name[1].toLowerCase()}@admin.liu.edu.lb`;
      console.log(`  • ${name[0]} ${name[1]}: ${email}`);
    });
    
    console.log('\n👨‍🏫 Advisor Accounts:');
    LEBANESE_ADVISOR_NAMES.forEach(name => {
      const email = `${name[0].toLowerCase()}.${name[1].toLowerCase()}@advisor.liu.edu.lb`;
      console.log(`  • ${name[0]} ${name[1]}: ${email}`);
    });
    
    console.log('\n🎓 Student Accounts (sample):');
    for (let i = 0; i < 5; i++) {
      const name = LEBANESE_STUDENT_NAMES[i];
      const studentNum = 40000001 + i;
      console.log(`  • ${name[0]} ${name[1]}: ${studentNum}@students.liu.edu.lb`);
    }
    console.log(`  • ... and ${LEBANESE_STUDENT_NAMES.length - 5} more students`);
    
    console.log('\n' + '═'.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error during population:', error.message);
    console.error(error);
    process.exit(1);
  }
};

// Run the script
const main = async () => {
  try {
    const connected = await config.testConnection();
    if (!connected) {
      process.exit(1);
    }
    await insertData();
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
};

main();