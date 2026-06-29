const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

// POST /rest/roles/assign (CFO only)
router.post('/assign', authenticate, authorize(['CFO']), async (req, res) => {
  const { userId, role } = req.body;

  if (!userId || !role) {
    return res.status(400).json({ status: 'error', message: 'Missing fields' });
  }

  const validRoles = ['EMP', 'RM', 'APE', 'CFO'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ status: 'error', message: 'Invalid role' });
  }

  try {
    const userRes = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    await db.query('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);
    return res.json({ status: 'success', message: 'Role assigned successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  }
});

module.exports = router;
