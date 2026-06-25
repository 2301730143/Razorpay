const { pool } = require('./index');

async function migrate() {
  console.log('Running database migrations...');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(10) NOT NULL DEFAULT 'EMP',
        manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "users" checked/created.');

    // Create reimbursements table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reimbursements (
        id UUID PRIMARY KEY,
        employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        amount NUMERIC(10, 2) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "reimbursements" checked/created.');

    // Create reimbursement_approvals table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reimbursement_approvals (
        id UUID PRIMARY KEY,
        reimbursement_id UUID NOT NULL REFERENCES reimbursements(id) ON DELETE CASCADE,
        approver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        approver_role VARCHAR(10) NOT NULL,
        decision VARCHAR(20) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (reimbursement_id, approver_id)
      );
    `);
    console.log('Table "reimbursement_approvals" checked/created.');

    await client.query('COMMIT');
    console.log('Database migrations completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during migrations:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
