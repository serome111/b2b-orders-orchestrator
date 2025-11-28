const pool = require('../db');

async function findById(id, connection = pool) {
  const [rows] = await connection.query(
    'SELECT id, sku, name, price_cents, stock, created_at, updated_at FROM products WHERE id = ?',
    [id]
  );
  return rows[0];
}

async function lockById(id, connection) {
  const [rows] = await connection.query(
    'SELECT id, sku, name, price_cents, stock FROM products WHERE id = ? FOR UPDATE',
    [id]
  );
  return rows[0];
}

async function list({ search, cursor, limit }) {
  const conditions = [];
  const params = [];

  if (search) {
    conditions.push('(name LIKE ? OR sku LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (cursor > 0) {
    conditions.push('id > ?');
    params.push(cursor);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT id, sku, name, price_cents, stock, created_at, updated_at FROM products ${where} ORDER BY id ASC LIMIT ?`;
  params.push(limit);
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function create({ sku, name, price_cents, stock }) {
  const [result] = await pool.query(
    'INSERT INTO products (sku, name, price_cents, stock) VALUES (?, ?, ?, ?)',
    [sku, name, price_cents, stock]
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
  const [result] = await pool.query(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, params);
  return result.affectedRows;
}

async function decrementStock(productId, qty, connection) {
  await connection.query('UPDATE products SET stock = stock - ? WHERE id = ?', [qty, productId]);
}

async function incrementStock(productId, qty, connection) {
  await connection.query('UPDATE products SET stock = stock + ? WHERE id = ?', [qty, productId]);
}

module.exports = {
  findById,
  lockById,
  list,
  create,
  update,
  decrementStock,
  incrementStock
};
