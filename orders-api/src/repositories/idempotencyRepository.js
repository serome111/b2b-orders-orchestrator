const pool = require('../db');

async function findByKey(key, connection) {
  const [rows] = await connection.query('SELECT * FROM idempotency_keys WHERE `key` = ? FOR UPDATE', [key]);
  return rows[0];
}

async function insertPending(key, targetType, targetId, expiresAt, connection) {
  await connection.query(
    'INSERT INTO idempotency_keys (`key`, target_type, target_id, status, expires_at) VALUES (?, ?, ?, ?, ?)',
    [key, targetType, targetId, 'PENDING', expiresAt]
  );
}

async function saveResponse(key, status, responseBody, targetId, connection) {
  await connection.query(
    'UPDATE idempotency_keys SET status = ?, response_body = ?, target_id = ? WHERE `key` = ?',
    [status, JSON.stringify(responseBody), targetId, key]
  );
}

module.exports = {
  findByKey,
  insertPending,
  saveResponse
};
