const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

// POST /rest/reimbursements (EMP only)
router.post('/', authenticate, authorize(['EMP']), async (req, res) => {
  const { title, description, amount } = req.body;

  if (!title || !description || amount === undefined) {
    return res.status(400).json({ status: 'error', message: 'Missing fields' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ status: 'error', message: 'Amount must be a positive number' });
  }

  try {
    const reimbursementId = crypto.randomUUID();
    await db.query(
      'INSERT INTO reimbursements (id, employee_id, title, description, amount, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [reimbursementId, req.user.userId, title, description, parsedAmount, 'PENDING']
    );

    return res.status(201).json({
      status: 'success',
      data: {
        id: reimbursementId,
        title,
        description,
        amount: parsedAmount,
        status: 'PENDING'
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  }
});

// PATCH /rest/reimbursements (RM, APE, CFO)
router.patch('/', authenticate, authorize(['RM', 'APE', 'CFO']), async (req, res) => {
  // Body parameter mapping: userId can refer to the employee who owns the reimbursement
  const targetUserId = req.body.userId; 
  const statusUpdate = req.body.status; // 'APPROVED' or 'REJECTED'
  const targetReimbursementId = req.body.reimbursementId || req.body.id;

  if (!statusUpdate || (!targetUserId && !targetReimbursementId)) {
    return res.status(400).json({ status: 'error', message: 'Missing fields' });
  }

  if (!['APPROVED', 'REJECTED'].includes(statusUpdate)) {
    return res.status(400).json({ status: 'error', message: 'Status must be APPROVED or REJECTED' });
  }

  const approverId = req.user.userId;
  const approverRole = req.user.role;

  try {
    // 1. Locate the reimbursement
    let queryText = '';
    let queryParams = [];

    if (targetReimbursementId) {
      queryText = 'SELECT * FROM reimbursements WHERE id = $1';
      queryParams = [targetReimbursementId];
    } else {
      // Find the oldest pending reimbursement belonging to the target employee
      queryText = 'SELECT * FROM reimbursements WHERE employee_id = $1 AND status = \'PENDING\' ORDER BY created_at ASC LIMIT 1';
      queryParams = [targetUserId];
    }

    const reimbRes = await db.query(queryText, queryParams);
    if (reimbRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Reimbursement not found' });
    }

    const reimbursement = reimbRes.rows[0];

    // If it's already rejected or approved, we shouldn't process it further
    if (reimbursement.status !== 'PENDING') {
      return res.status(400).json({ status: 'error', message: 'Reimbursement is already finalized' });
    }

    // 2. Access control and Workflow rules
    // Get the employee details to check manager
    const empRes = await db.query('SELECT * FROM users WHERE id = $1', [reimbursement.employee_id]);
    const employee = empRes.rows[0];

    if (approverRole === 'RM') {
      // Must be the employee's direct reporting manager
      if (employee.manager_id !== approverId) {
        return res.status(403).json({ status: 'error', message: 'Forbidden: You are not the reporting manager of this employee' });
      }
    }

    // Check if the approver has already approved
    const approvalCheck = await db.query(
      'SELECT * FROM reimbursement_approvals WHERE reimbursement_id = $1 AND approver_id = $2',
      [reimbursement.id, approverId]
    );
    if (approvalCheck.rows.length > 0) {
      return res.status(400).json({ status: 'error', message: 'You have already submitted a decision for this reimbursement' });
    }

    // 3. Record decision
    const approvalId = crypto.randomUUID();
    await db.query(
      'INSERT INTO reimbursement_approvals (id, reimbursement_id, approver_id, approver_role, decision) VALUES ($1, $2, $3, $4, $5)',
      [approvalId, reimbursement.id, approverId, approverRole, statusUpdate]
    );

    // 4. Update overall status based on conditions
    if (statusUpdate === 'REJECTED') {
      await db.query('UPDATE reimbursements SET status = \'REJECTED\' WHERE id = $1', [reimbursement.id]);
      return res.json({ status: 'success', message: 'Reimbursement rejected successfully' });
    }

    // If statusUpdate is 'APPROVED'
    // Let's determine if it transitions to APPROVED
    // Rule: "In the EMP's view, the status turns APPROVED only once their RM and one of the APEs have approved it."
    // Let's see if we have both RM and APE approval now
    const allApprovalsRes = await db.query(
      'SELECT approver_role FROM reimbursement_approvals WHERE reimbursement_id = $1 AND decision = \'APPROVED\'',
      [reimbursement.id]
    );
    const rolesWhoApproved = allApprovalsRes.rows.map(r => r.approver_role);

    const hasRMApproval = rolesWhoApproved.includes('RM');
    const hasAPEApproval = rolesWhoApproved.includes('APE');
    const hasCFOApproval = rolesWhoApproved.includes('CFO');

    if ((hasRMApproval && hasAPEApproval) || hasCFOApproval) {
      await db.query('UPDATE reimbursements SET status = \'APPROVED\' WHERE id = $1', [reimbursement.id]);
      return res.json({ status: 'success', message: 'Reimbursement approved successfully' });
    }

    return res.json({ status: 'success', message: 'Approval recorded successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  }
});

// GET /rest/reimbursements
router.get('/', authenticate, async (req, res) => {
  const { role, userId } = req.user;

  try {
    let queryText = '';
    let queryParams = [];

    if (role === 'EMP') {
      // lists their own reimbursements
      queryText = `
        SELECT id, employee_id, title, description, amount, status 
        FROM reimbursements 
        WHERE employee_id = $1
        ORDER BY created_at DESC
      `;
      queryParams = [userId];
    } else if (role === 'RM') {
      // sees the reimbursements that are PENDING from their EMPs
      queryText = `
        SELECT r.id, r.employee_id, r.title, r.description, r.amount, r.status
        FROM reimbursements r
        JOIN users u ON r.employee_id = u.id
        WHERE u.manager_id = $1 
          AND r.status = 'PENDING'
          AND NOT EXISTS (
            SELECT 1 FROM reimbursement_approvals ra 
            WHERE ra.reimbursement_id = r.id AND ra.approver_id = $1
          )
        ORDER BY r.created_at DESC
      `;
      queryParams = [userId];
    } else if (role === 'APE') {
      // sees reimbursements PENDING at the APE level but already APPROVED by the RM
      queryText = `
        SELECT DISTINCT r.id, r.employee_id, r.title, r.description, r.amount, r.status
        FROM reimbursements r
        JOIN reimbursement_approvals ra ON r.id = ra.reimbursement_id
        WHERE r.status = 'PENDING' 
          AND ra.approver_role = 'RM' 
          AND ra.decision = 'APPROVED'
          AND NOT EXISTS (
            SELECT 1 FROM reimbursement_approvals ra2 
            WHERE ra2.reimbursement_id = r.id AND ra2.approver_id = $1
          )
        ORDER BY r.created_at DESC
      `;
      queryParams = [userId];
    } else if (role === 'CFO') {
      // sees reimbursements already APPROVED by the APEs
      queryText = `
        SELECT DISTINCT r.id, r.employee_id, r.title, r.description, r.amount, r.status
        FROM reimbursements r
        JOIN reimbursement_approvals ra ON r.id = ra.reimbursement_id
        WHERE ra.approver_role = 'APE' AND ra.decision = 'APPROVED'
        ORDER BY r.amount DESC
      `;
    }

    const result = await db.query(queryText, queryParams);

    // Format output amounts to number
    const formattedRows = result.rows.map(row => ({
      ...row,
      amount: parseFloat(row.amount)
    }));

    return res.json({
      status: 'success',
      data: {
        reimbursements: formattedRows
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  }
});

// GET /rest/reimbursements/<user-id>
router.get('/:userId', authenticate, async (req, res) => {
  const requestingUserId = req.user.userId;
  const requestingUserRole = req.user.role;
  const targetUserId = req.params.userId;

  try {
    // Check if target user is an EMP
    const targetUserRes = await db.query('SELECT * FROM users WHERE id = $1', [targetUserId]);
    if (targetUserRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const targetUser = targetUserRes.rows[0];
    if (targetUser.role !== 'EMP') {
      return res.status(400).json({ status: 'error', message: 'Target user is not an Employee (EMP)' });
    }

    // Access control: only allowed if the target user is the requesting user's subordinate.
    // - For RM: employee reports to them (manager_id = RM's userId)
    // - For APE or CFO: they don't have direct subordinates under the org structure rules.
    if (requestingUserRole === 'RM') {
      if (targetUser.manager_id !== requestingUserId) {
        return res.status(403).json({ status: 'error', message: 'Forbidden: Target user is not your subordinate' });
      }
    } else {
      // APE/CFO or EMP cannot access other's files unless they are their direct subordinate.
      return res.status(403).json({ status: 'error', message: 'Forbidden: Target user is not your subordinate' });
    }

    const result = await db.query(
      'SELECT id, employee_id, title, description, amount, status FROM reimbursements WHERE employee_id = $1 ORDER BY created_at DESC',
      [targetUserId]
    );

    const formattedRows = result.rows.map(row => ({
      ...row,
      amount: parseFloat(row.amount)
    }));

    return res.json({
      status: 'success',
      data: {
        reimbursements: formattedRows
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  }
});

module.exports = router;
