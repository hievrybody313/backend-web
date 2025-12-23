// server.js - Main Express server entry point
// Located in: backend/server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { testConnection } = require('./config');

// Import routes
const loginRoutes = require('./login');
const loginStudentRoutes = require('./loginStudent');
const adminRoutes = require('./AdminDashboard');
const advisorRoutes = require('./AdvisorDashboard');
const studentRoutes = require('./StudentDashboard');
const faqsRoutes = require('./faqs');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth', loginRoutes);
app.use('/api/auth/student', loginStudentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/advisor', advisorRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/faqs', faqsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Start server
const startServer = async () => {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
};

startServer();

module.exports = app;
