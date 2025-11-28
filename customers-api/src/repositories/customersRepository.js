const pool = require('../db');

async function findById(id) {
  const [rows] = await pool.query(
    'SELECT id, name, email, phone, created_at, updated_at FROM customers WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
  return rows[0];
}

async function list({ search, cursor, limit }) {
  const conditions = ['deleted_at IS NULL'];
  const params = [];

  if (search) {
    conditions.push('(name LIKE ? OR email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (cursor > 0) {
    conditions.push('id > ?');
    params.push(cursor);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT id, name, email, phone, created_at, updated_at FROM customers ${where} ORDER BY id ASC LIMIT ?`;
  params.push(limit);
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function create({ name, email, phone }) {
  const [result] = await pool.query(
    'INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)',
    [name, email, phone]
  );
  return result.insertId;
}

async function update(id, fields) {
  const updates = [];
  const params = [];
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined) {
      updates.push(`${key} = ?`);
      params.push(value);
    }
  });
  params.push(id);
  const [result] = await pool.query(
    `UPDATE customers SET ${updates.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
    params
  );
  return result.affectedRows;
}

async function softDelete(id) {
  const [result] = await pool.query('UPDATE customers SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL', [id]);
  return result.affectedRows;
}

module.exports = {
  findById,
  list,
  create,
  update,
  softDelete
};
