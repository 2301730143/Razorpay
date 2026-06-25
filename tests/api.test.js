const test = require('node:test');
const assert = require('node:assert');

// 1. Setup Mock DB module in Node cache before loading app
const dbMock = {
  users: new Map(),
  reimbursements: new Map(),
  approvals: [],
  query: async function (text, params) {
    const norm = text.replace(/\s+/g, ' ').trim();

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
    if (norm.includes('SELECT title, description, amount, status FROM reimbursements WHERE employee_id = $1 ORDER BY created_at DESC')) {
      const empId = params[0];
      const rows = Array.from(this.reimbursements.values())
        .filter(r => r.employee_id === empId)
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
        .map(r => ({ ...r, employeeId: r.employee_id }))
        .sort((a, b) => b.created_at - a.created_at);
      return { rows };
    }
    if (norm.includes("ra.approver_role = 'RM'") && norm.includes("ra.decision = 'APPROVED'")) {
      const apeId = params[0];
      const rows = Array.from(this.reimbursements.values())
        .filter(r => r.status === 'PENDING')
        .filter(r => this.approvals.some(ap => ap.reimbursement_id === r.id && ap.approver_role === 'RM' && ap.decision === 'APPROVED'))
        .filter(r => !this.approvals.some(ap => ap.reimbursement_id === r.id && ap.approver_id === apeId))
        .map(r => ({ ...r, employeeId: r.employee_id }))
        .sort((a, b) => b.created_at - a.created_at);
      return { rows };
    }
    if (norm.includes("ra.approver_role = 'APE'") && norm.includes("ra.decision = 'APPROVED'")) {
      const rows = Array.from(this.reimbursements.values())
        .filter(r => this.approvals.some(ap => ap.reimbursement_id === r.id && ap.approver_role === 'APE' && ap.decision === 'APPROVED'))
        .map(r => ({ ...r, employeeId: r.employee_id }))
        .sort((a, b) => b.amount - a.amount);
      return { rows };
    }

    return { rows: [] };
  }
};

const dbPath = require.resolve('../src/db');
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: dbMock
};

// Start Server on random/free test port
process.env.PORT = '7015';
const app = require('../src/app');

// Helper to extract cookies
function getCookieValue(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

const baseUrl = 'http://localhost:7015';

test('API Integration Suite', async (t) => {
  let cfoToken, rmToken, apeToken, empToken;
  let cfoId, rmId, apeId, empId;
  let reimbursementId;

  await t.test('1. Register Users', async () => {
    // CFO
    const cfoRes = await fetch(`${baseUrl}/rest/onboardings/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Chief Financial Officer', email: 'cfo@org.com', password: 'password123' })
    });
    assert.strictEqual(cfoRes.status, 201);
    const cfoBody = await cfoRes.json();
    cfoId = cfoBody.data.userId;
    dbMock.users.get(cfoId).role = 'CFO';

    // RM
    const rmRes = await fetch(`${baseUrl}/rest/onboardings/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Reporting Manager', email: 'rm@org.com', password: 'password123' })
    });
    assert.strictEqual(rmRes.status, 201);
    rmId = (await rmRes.json()).data.userId;

    // APE
    const apeRes = await fetch(`${baseUrl}/rest/onboardings/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Associate Partner', email: 'ape@org.com', password: 'password123' })
    });
    assert.strictEqual(apeRes.status, 201);
    apeId = (await apeRes.json()).data.userId;

    // EMP
    const empRes = await fetch(`${baseUrl}/rest/onboardings/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Regular Employee', email: 'emp@org.com', password: 'password123' })
    });
    assert.strictEqual(empRes.status, 201);
    empId = (await empRes.json()).data.userId;
  });

  await t.test('2. Roles & Hierarchy Management', async () => {
    // We login CFO first
    const cfoLoginRes = await fetch(`${baseUrl}/rest/onboardings/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'cfo@org.com', password: 'password123' })
    });
    cfoToken = getCookieValue(cfoLoginRes.headers.get('set-cookie'), 'token');
    assert.ok(cfoToken);

    // CFO assigns RM role to RM user
    const res1 = await fetch(`${baseUrl}/rest/roles/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `token=${cfoToken}` },
      body: JSON.stringify({ userId: rmId, role: 'RM' })
    });
    assert.strictEqual(res1.status, 200);

    // CFO assigns APE role to APE user
    const res2 = await fetch(`${baseUrl}/rest/roles/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `token=${cfoToken}` },
      body: JSON.stringify({ userId: apeId, role: 'APE' })
    });
    assert.strictEqual(res2.status, 200);

    // CFO sets EMP's reporting line to RM
    const res3 = await fetch(`${baseUrl}/rest/employees/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `token=${cfoToken}` },
      body: JSON.stringify({ employeeId: empId, managerId: rmId })
    });
    assert.strictEqual(res3.status, 200);
  });

  await t.test('3. Post-Role Authentication & Logins', async () => {
    const login = async (email) => {
      const res = await fetch(`${baseUrl}/rest/onboardings/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password123' })
      });
      assert.strictEqual(res.status, 200);
      return getCookieValue(res.headers.get('set-cookie'), 'token');
    };

    rmToken = await login('rm@org.com');
    apeToken = await login('ape@org.com');
    empToken = await login('emp@org.com');

    assert.ok(rmToken);
    assert.ok(apeToken);
    assert.ok(empToken);
  });

  await t.test('4. Raise Reimbursement (EMP)', async () => {
    const res = await fetch(`${baseUrl}/rest/reimbursements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `token=${empToken}` },
      body: JSON.stringify({ title: 'Lunch client meeting', description: 'Met with Acme Corp', amount: 120.50 })
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    reimbursementId = body.data.id;
    assert.ok(reimbursementId);
    assert.strictEqual(body.data.status, 'PENDING');
  });

  await t.test('5. RM Approval Flow', async () => {
    // List pending for RM
    const listRes = await fetch(`${baseUrl}/rest/reimbursements`, {
      headers: { 'Cookie': `token=${rmToken}` }
    });
    assert.strictEqual(listRes.status, 200);
    const listBody = await listRes.json();
    assert.strictEqual(listBody.data.reimbursements.length, 1);

    // RM Approves
    const approveRes = await fetch(`${baseUrl}/rest/reimbursements`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Cookie': `token=${rmToken}` },
      body: JSON.stringify({ reimbursementId, status: 'APPROVED' })
    });
    assert.strictEqual(approveRes.status, 200);
  });

  await t.test('6. APE Approval Flow & State Transition', async () => {
    // APE Approves
    const approveRes = await fetch(`${baseUrl}/rest/reimbursements`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Cookie': `token=${apeToken}` },
      body: JSON.stringify({ reimbursementId, status: 'APPROVED' })
    });
    assert.strictEqual(approveRes.status, 200);

    // Verify overall status is now APPROVED
    const reimbObj = dbMock.reimbursements.get(reimbursementId);
    assert.strictEqual(reimbObj.status, 'APPROVED');
  });
});

// Terminate process after test completion
test.after(() => {
  setTimeout(() => process.exit(0), 500);
});
