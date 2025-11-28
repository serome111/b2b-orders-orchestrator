const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function run() {
  const seedPath = path.join(__dirname, '..', '..', 'db', 'seed.sql');
  const sql = fs.readFileSync(seedPath, 'utf8');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  });

  await connection.query(sql);
  await connection.end();
  console.log('Seed data inserted');
}

run().catch((err) => {
  console.error('Seed failed', err);
  process.exit(1);
});
