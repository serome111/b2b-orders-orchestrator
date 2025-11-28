const pool = require('../db');

async function lockById(id, connection) {
  const [rows] = await connection.query(
    'SELECT id, customer_id, status, total_cents, created_at, updated_at FROM orders WHERE id = ? FOR UPDATE',
    [id]
  );
  return rows[0];
}

async function findById(id, connection = pool) {
  const [rows] = await connection.query(
    'SELECT id, customer_id, status, total_cents, created_at, updated_at FROM orders WHERE id = ?',
    [id]
  );
  return rows[0];
}

async function list({ status, cursor, limit, from, to }) {
  const conditions = [];
  const params = [];

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (cursor > 0) {
    conditions.push('id > ?');
    params.push(cursor);
  }
  if (from) {
    conditions.push('created_at >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('created_at <= ?');
    params.push(to);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT id, customer_id, status, total_cents, created_at, updated_at FROM orders ${where} ORDER BY id ASC LIMIT ?`;
  params.push(limit);

  const [rows] = await pool.query(sql, params);
  return rows;
}

async function insertOrder({ customerId, totalCents }, connection) {
  const [result] = await connection.query(
    'INSERT INTO orders (customer_id, status, total_cents) VALUES (?, ?, ?)',
    [customerId, 'CREATED', totalCents]
  );
  return result.insertId;
}

async function insertOrderItem(orderId, item, connection) {
  await connection.query(
    'INSERT INTO order_items (order_id, product_id, qty, unit_price_cents, subtotal_cents) VALUES (?, ?, ?, ?, ?)',
    [orderId, item.product_id, item.qty, item.unit_price_cents, item.subtotal_cents]
  );
}

async function getItems(orderId, connection = pool) {
  const [items] = await connection.query(
    'SELECT product_id, qty, unit_price_cents, subtotal_cents FROM order_items WHERE order_id = ?',
    [orderId]
  );
  return items;
}

async function getWithItems(orderId, connection = pool) {
  const order = await findById(orderId, connection);
  if (!order) return null;
  const items = await getItems(orderId, connection);
  return { ...order, items };
}

async function updateStatus(orderId, status, connection) {
  await connection.query('UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?', [status, orderId]);
}

module.exports = {
  lockById,
  findById,
  list,
  insertOrder,
  insertOrderItem,
  getItems,
  getWithItems,
  updateStatus
};
