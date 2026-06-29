const { pool } = require('./index');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

async function seed() {
  console.log('Seeding database...');
  const email = 'cfo@org.com';
  const password = 'CFO#ORG@April2026';
  
  const client = await pool.connect();
  try {
    // Check if CFO already exists
    const checkRes = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (checkRes.rows.length > 0) {
      console.log('CFO account already seeded.');
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();
    
    await client.query(
      `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'Chief Financial Officer', email, passwordHash, 'CFO']
    );
    
    console.log('CFO account seeded successfully!');
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
