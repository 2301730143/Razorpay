const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const { generateToken } = require('../middleware/auth');

// Helper function to check email domain
function isValidEmail(email) {
  if (!email) return false;
  const parts = email.split('@');
  return parts.length === 2 && parts[1] === 'org.com';
}

// POST /rest/onboardings/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ status: 'error', message: 'Missing fields' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ status: 'error', message: 'Only @org.com emails are allowed' });
  }

  try {
    // Check if user already exists
    const existing = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ status: 'error', message: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();

    await db.query(
      'INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)',
      [userId, name, email, passwordHash, 'EMP']
    );

    return res.status(201).json({
      status: 'success',
      data: {
        userId,
        name,
        email,
        role: 'EMP'
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  }
});

// POST /rest/onboardings/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ status: 'error', message: 'Missing fields' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ status: 'error', message: 'Only @org.com emails are allowed' });
  }

  try {
    const userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }

    const token = generateToken(user);

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    return res.json({
      status: 'success',
      data: {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  }
});

// POST /rest/onboardings/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  return res.json({ status: 'success', message: 'Logged out successfully' });
});

module.exports = router;
