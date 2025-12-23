const express = require('express');
const router = express.Router();
const { query } = require('./config');

// Get all FAQs (Admin/Advisor view - can filter)
router.get('/all', async (req, res) => {
  try {
    const faqs = await query(`
      SELECT f.*, u.first_name, u.last_name 
      FROM faqs f 
      LEFT JOIN users u ON f.asked_by = u.user_id 
      ORDER BY f.created_at DESC
    `);
    res.json(faqs);
  } catch (err) {
    console.error('Error fetching all FAQs:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get pending FAQs (Advisor view)
router.get('/pending', async (req, res) => {
  try {
    const faqs = await query(`
      SELECT f.*, u.first_name, u.last_name 
      FROM faqs f 
      LEFT JOIN users u ON f.asked_by = u.user_id 
      WHERE f.status = 'pending' 
      ORDER BY f.created_at ASC
    `);
    res.json(faqs);
  } catch (err) {
    console.error('Error fetching pending FAQs:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get accepted FAQs (Public/Student view)
router.get('/', async (req, res) => {
  try {
    const faqs = await query(`
      SELECT f.faq_id, f.question, f.answer, f.created_at
      FROM faqs f 
      WHERE f.status = 'accepted' 
      ORDER BY f.created_at DESC
    `);
    res.json(faqs);
  } catch (err) {
    console.error('Error fetching public FAQs:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Post a question (Student)
router.post('/', async (req, res) => {
  try {
    const { question, user_id } = req.body;
    
    if (!question) {
      return res.status(400).json({ message: 'Question is required' });
    }

    await query(
      'INSERT INTO faqs (question, asked_by, status) VALUES (?, ?, "pending")',
      [question, user_id || null]
    );
    
    res.status(201).json({ message: 'Question submitted successfully' });
  } catch (err) {
    console.error('Error submitting question:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update FAQ status or answer (Advisor/Admin)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { answer, status } = req.body;
    
    let sql = 'UPDATE faqs SET ';
    const params = [];
    const updates = [];

    if (answer !== undefined) {
      updates.push('answer = ?');
      params.push(answer);
    }
    
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    sql += updates.join(', ') + ' WHERE faq_id = ?';
    params.push(id);

    await query(sql, params);
    res.json({ message: 'FAQ updated successfully' });
  } catch (err) {
    console.error('Error updating FAQ:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete FAQ (Advisor/Admin)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM faqs WHERE faq_id = ?', [id]);
    res.json({ message: 'FAQ deleted successfully' });
  } catch (err) {
    console.error('Error deleting FAQ:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
