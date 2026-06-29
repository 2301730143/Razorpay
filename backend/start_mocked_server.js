// start_mocked_server.js
const fs = require('fs');
const path = require('path');

// 1. Mock DB module
const dbMock = {
  users: new Map(),
  reimbursements: new Map(),
  approvals: [],
  query: async function (text, params) {
    const norm = text.replace(/\s+/g, ' ').trim();
    console.log('MOCK DB QUERY:', norm, params || '');

    if (norm.includes('SELECT * FROM users WHERE email = $1')) {
      const email = params[0];
      const user = Array.from(this.users.values()).find(u => u.email === email);
      return { rows: user ? [user] : [] };
    }
    if (norm.includes('INSERT INTO users')) {
      const [id, name, email, password_hash, role] = params;
      const newUser = { id, name, email, password_hash, role, manager_id: null };
      this.users.set(id, newUser);
      return { rows: [newUser] };
    }
    if (norm.includes('SELECT * FROM users WHERE id = $1')) {
      const id = params[0];
      const user = this.users.get(id);
      return { rows: user ? [user] : [] };
    }
    if (norm.includes('UPDATE users SET role = $1 WHERE id = $2')) {
      const [role, id] = params;
      const user = this.users.get(id);
      if (user) user.role = role;
      return { rows: [] };
    }
    if (norm.includes('UPDATE users SET manager_id = $1 WHERE id = $2')) {
      const [managerId, employeeId] = params;
      const user = this.users.get(employeeId);
      if (user) user.manager_id = managerId;
      return { rows: [] };
    }
    if (norm.includes('UPDATE users SET manager_id = NULL WHERE id = $1')) {
      const [employeeId] = params;
      const user = this.users.get(employeeId);
      if (user) user.manager_id = null;
      return { rows: [] };
    }
    if (norm.includes('INSERT INTO reimbursements')) {
      const [id, employee_id, title, description, amount, status] = params;
      const newReimb = { id, employee_id, title, description, amount, status, created_at: new Date() };
      this.reimbursements.set(id, newReimb);
      return { rows: [newReimb] };
    }
    if (norm.includes('SELECT * FROM reimbursements WHERE id = $1')) {
      const id = params[0];
      const r = this.reimbursements.get(id);
      return { rows: r ? [r] : [] };
    }
    if (norm.includes("SELECT * FROM reimbursements WHERE employee_id = $1 AND status = 'PENDING'")) {
      const empId = params[0];
      const r = Array.from(this.reimbursements.values()).find(x => x.employee_id === empId && x.status === 'PENDING');
      return { rows: r ? [r] : [] };
    }
    if (norm.includes("UPDATE reimbursements SET status = 'REJECTED' WHERE id = $1")) {
      const id = params[0];
      const r = this.reimbursements.get(id);
      if (r) r.status = 'REJECTED';
      return { rows: [] };
    }
    if (norm.includes("UPDATE reimbursements SET status = 'APPROVED' WHERE id = $1")) {
      const id = params[0];
      const r = this.reimbursements.get(id);
      if (r) r.status = 'APPROVED';
      return { rows: [] };
    }
    if (norm.includes('SELECT * FROM reimbursement_approvals WHERE reimbursement_id = $1 AND approver_id = $2')) {
      const [reimbId, approverId] = params;
      const app = this.approvals.find(x => x.reimbursement_id === reimbId && x.approver_id === approverId);
      return { rows: app ? [app] : [] };
    }
    if (norm.includes('INSERT INTO reimbursement_approvals')) {
      const [id, reimbursement_id, approver_id, approver_role, decision] = params;
      const newApp = { id, reimbursement_id, approver_id, approver_role, decision, created_at: new Date() };
      this.approvals.push(newApp);
      return { rows: [newApp] };
    }
    if (norm.includes("SELECT approver_role FROM reimbursement_approvals WHERE reimbursement_id = $1 AND decision = 'APPROVED'")) {
      const reimbId = params[0];
      const apps = this.approvals.filter(x => x.reimbursement_id === reimbId && x.decision === 'APPROVED');
      return { rows: apps.map(x => ({ approver_role: x.approver_role })) };
    }
    if (norm.includes('SELECT id, employee_id, title, description, amount, status FROM reimbursements WHERE employee_id = $1 ORDER BY created_at DESC')) {
      const empId = params[0];
      const rows = Array.from(this.reimbursements.values())
        .filter(r => r.employee_id === empId)
        .map(r => ({ id: r.id, employee_id: r.employee_id, title: r.title, description: r.description, amount: parseFloat(r.amount), status: r.status }))
        .sort((a, b) => b.created_at - a.created_at);
      return { rows };
    }
    if (norm.includes('u.manager_id = $1') && norm.includes("r.status = 'PENDING'")) {
      const rmId = params[0];
      const subs = Array.from(this.users.values()).filter(u => u.manager_id === rmId);
      const subIds = subs.map(u => u.id);
      const rows = Array.from(this.reimbursements.values())
        .filter(r => subIds.includes(r.employee_id) && r.status === 'PENDING')
        .filter(r => !this.approvals.some(ap => ap.reimbursement_id === r.id && ap.approver_id === rmId))
        .map(r => ({ id: r.id, employee_id: r.employee_id, title: r.title, description: r.description, amount: parseFloat(r.amount), status: r.status }))
        .sort((a, b) => b.created_at - a.created_at);
      return { rows };
    }
    if (norm.includes("ra.approver_role = 'RM'") && norm.includes("ra.decision = 'APPROVED'")) {
      const apeId = params[0];
      const rows = Array.from(this.reimbursements.values())
        .filter(r => r.status === 'PENDING')
        .filter(r => this.approvals.some(ap => ap.reimbursement_id === r.id && ap.approver_role === 'RM' && ap.decision === 'APPROVED'))
        .filter(r => !this.approvals.some(ap => ap.reimbursement_id === r.id && ap.approver_id === apeId))
        .map(r => ({ id: r.id, employee_id: r.employee_id, title: r.title, description: r.description, amount: parseFloat(r.amount), status: r.status }))
        .sort((a, b) => b.created_at - a.created_at);
      return { rows };
    }
    if (norm.includes("ra.approver_role = 'APE'") && norm.includes("ra.decision = 'APPROVED'")) {
      const rows = Array.from(this.reimbursements.values())
        .filter(r => this.approvals.some(ap => ap.reimbursement_id === r.id && ap.approver_role === 'APE' && ap.decision === 'APPROVED'))
        .map(r => ({ id: r.id, employee_id: r.employee_id, title: r.title, description: r.description, amount: parseFloat(r.amount), status: r.status }))
        .sort((a, b) => b.amount - a.amount);
      return { rows };
    }
    if (norm.includes('SELECT id as "userId", name, email, role')) {
      const rows = Array.from(this.users.values()).map(u => ({ userId: u.id, name: u.name, email: u.email, role: u.role, manager_id: u.manager_id }));
      return { rows };
    }

    return { rows: [] };
  }
};

// Seed CFO account in mock DB
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const cfoPasswordHash = bcrypt.hashSync('CFO#ORG@April2026', 10);
const cfoId = crypto.randomUUID();
dbMock.users.set(cfoId, {
  id: cfoId,
  name: 'Chief Financial Officer',
  email: 'cfo@org.com',
  password_hash: cfoPasswordHash,
  role: 'CFO',
  manager_id: null
});
console.log('Seeded CFO account in mock DB: cfo@org.com / CFO#ORG@April2026. ID:', cfoId);

// Inject mock
const dbPath = require.resolve('./src/db');
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: dbMock
};

// Start the express server
process.env.PORT = '7002';
require('./src/app.js');
console.log('Mocked server started on http://localhost:7002');
