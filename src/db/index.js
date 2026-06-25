const { Pool } = require('pg');
require('dotenv').config();

// Standard PostgreSQL env vars: PGHOST, PGUSER, PGDATABASE, PGPASSWORD, PGPORT
// Custom env vars: DB_HOST, DB_USER, DB_NAME, DB_PASSWORD, DB_PORT
const pool = new Pool({
  host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
  user: process.env.PGUSER || process.env.DB_USER || 'postgres',
  password: process.env.PGPASSWORD || process.env.DB_PASSWORD || 'password',
  database: process.env.PGDATABASE || process.env.DB_NAME || 'reimbursements',
  port: parseInt(process.env.PGPORT || process.env.DB_PORT || '5432', 10),
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
