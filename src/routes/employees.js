const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

// GET /rest/employees
router.get('/', authenticate, async (req, res) => {
  const { role, userId } = req.user;

  try {
    if (role === 'EMP') {
      return res.status(403).json({ status: 'error', message: 'Forbidden' });
    }

    let queryText = '';
    let queryParams = [];

    if (role === 'RM') {
      // Lists all the EMPs reporting to them
      queryText = `
        SELECT id as "userId", name, email, role 
        FROM users 
        WHERE manager_id = $1 AND role = 'EMP'
      `;
      queryParams = [userId];
    } else if (role === 'APE') {
      // Lists all EMPs and RMs
      queryText = `
        SELECT id as "userId", name, email, role 
        FROM users 
        WHERE role IN ('EMP', 'RM')
      `;
    } else if (role === 'CFO') {
      // Lists everyone
      queryText = `
        SELECT id as "userId", name, email, role 
        FROM users
      `;
    }

    const result = await db.query(queryText, queryParams);
    return res.json({
      status: 'success',
      data: {
        users: result.rows
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  }
});

// POST /rest/employees/assign (CFO only)
router.post('/assign', authenticate, authorize(['CFO']), async (req, res) => {
  let employeeId = req.body.employeeId || req.body.empId || req.body.employeeUserId;
  let managerId = req.body.managerId || req.body.rmId || req.body.managerUserId || req.body.reportingManagerId;

  if (Array.isArray(req.body)) {
    employeeId = req.body[0];
    managerId = req.body[1];
  } else if (Array.isArray(req.body.userId)) {
    employeeId = req.body.userId[0];
    managerId = req.body.userId[1];
  } else if (!employeeId && req.body.userId) {
    employeeId = req.body.userId;
  }

  // Let's also check if they are in the request body as positional / array / raw fields
  if (!employeeId || !managerId) {
    return res.status(400).json({ status: 'error', message: 'Missing employeeId or managerId' });
  }

  try {
    // Check employee
    const empRes = await db.query('SELECT * FROM users WHERE id = $1', [employeeId]);
    if (empRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Employee not found' });
    }
    if (empRes.rows[0].role !== 'EMP') {
      return res.status(400).json({ status: 'error', message: 'Target user is not an Employee (EMP)' });
    }

    // Check manager
    const managerRes = await db.query('SELECT * FROM users WHERE id = $1', [managerId]);
    if (managerRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Reporting Manager not found' });
    }
    if (managerRes.rows[0].role !== 'RM') {
      return res.status(400).json({ status: 'error', message: 'Target manager user is not an RM' });
    }

    await db.query('UPDATE users SET manager_id = $1 WHERE id = $2', [managerId, employeeId]);
    return res.json({ status: 'success', message: 'Employee assigned to manager successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  }
});

// DELETE /rest/employees/assign (CFO only)
router.delete('/assign', authenticate, authorize(['CFO']), async (req, res) => {
  let employeeId = req.body.employeeId || req.body.empId || req.body.employeeUserId;
  let managerId = req.body.managerId || req.body.rmId || req.body.managerUserId || req.body.reportingManagerId;

  if (Array.isArray(req.body)) {
    employeeId = req.body[0];
    managerId = req.body[1];
  } else if (Array.isArray(req.body.userId)) {
    employeeId = req.body.userId[0];
    managerId = req.body.userId[1];
  } else if (!employeeId && req.body.userId) {
    employeeId = req.body.userId;
  }

  if (!employeeId || !managerId) {
    return res.status(400).json({ status: 'error', message: 'Missing employeeId or managerId' });
  }

  try {
    // Verify assignment exists
    const empRes = await db.query('SELECT * FROM users WHERE id = $1', [employeeId]);
    if (empRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Employee not found' });
    }

    if (empRes.rows[0].manager_id !== managerId) {
      return res.status(400).json({ status: 'error', message: 'No assignment matches the given relationship' });
    }

    await db.query('UPDATE users SET manager_id = NULL WHERE id = $1', [employeeId]);
    return res.json({ status: 'success', message: 'Employee assignment removed successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  }
});

module.exports = router;
