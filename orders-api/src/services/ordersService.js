const axios = require('axios');
const config = require('../config');
const pool = require('../db');
const productRepo = require('../repositories/productsRepository');
const ordersRepo = require('../repositories/ordersRepository');
const idempotencyRepo = require('../repositories/idempotencyRepository');
const { NotFoundError, ConflictError, AppError, UpstreamError } = require('../lib/errors');

async function fetchCustomer(customerId) {
  try {
    const response = await axios.get(
      `${config.customersApiBase}/internal/customers/${customerId}`,
      { headers: { Authorization: `Bearer ${config.serviceToken}` } }
    );
    return response.data.data;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      throw new NotFoundError('Customer not found in Customers API');
    }
    throw new UpstreamError('Customers API unavailable', 502, err.message);
  }
}

function parseStored(body) {
  if (!body) return null;
  return typeof body === 'string' ? JSON.parse(body) : body;
}

async function getOrder(id) {
  const order = await ordersRepo.getWithItems(id);
  if (!order) throw new NotFoundError('Order not found');
  return order;
}

async function listOrders(params) {
  const rows = await ordersRepo.list(params);
  const nextCursor = rows.length === params.limit ? rows[rows.length - 1].id : null;
  return { rows, nextCursor };
}

async function createOrder(customerId, items) {
  await fetchCustomer(customerId);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    let totalCents = 0;
    const itemDetails = [];

    for (const item of items) {
      const product = await productRepo.lockById(item.product_id, connection);
      if (!product) {
        throw new NotFoundError('Product not found');
      }
      if (product.stock < item.qty) {
        throw new AppError(`Insufficient stock for product ${item.product_id}`, 400);
      }
      const subtotal = product.price_cents * item.qty;
      totalCents += subtotal;
      itemDetails.push({
        product_id: item.product_id,
        qty: item.qty,
        unit_price_cents: product.price_cents,
        subtotal_cents: subtotal
      });
    }

    const orderId = await ordersRepo.insertOrder({ customerId, totalCents }, connection);

    for (const detail of itemDetails) {
      await ordersRepo.insertOrderItem(orderId, detail, connection);
      await productRepo.decrementStock(detail.product_id, detail.qty, connection);
    }

    await connection.commit();
    return ordersRepo.getWithItems(orderId, connection);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function confirmOrder(orderId, key) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const existing = await idempotencyRepo.findByKey(key, connection);
    if (existing && existing.target_id && existing.target_id !== Number(orderId)) {
      await connection.commit();
      throw new ConflictError('Idempotency key already used for another order');
    }

    if (existing && existing.status === 'COMPLETED' && existing.response_body) {
      await connection.commit();
      return parseStored(existing.response_body);
    }

    if (!existing) {
      const expiresAt = new Date(Date.now() + config.idempotencyTtlMinutes * 60 * 1000);
      await idempotencyRepo.insertPending(key, 'order_confirm', orderId, expiresAt, connection);
    }

    const order = await ordersRepo.lockById(orderId, connection);
    if (!order) {
      const response = { message: 'Order not found' };
      await idempotencyRepo.saveResponse(key, 'FAILED', response, orderId, connection);
      await connection.commit();
      throw new NotFoundError('Order not found');
    }

    if (order.status === 'CANCELED') {
      const response = { message: 'Order already canceled' };
      await idempotencyRepo.saveResponse(key, 'COMPLETED', response, orderId, connection);
      await connection.commit();
      throw new ConflictError('Order already canceled');
    }

    if (order.status === 'CONFIRMED') {
      const current = await ordersRepo.getWithItems(orderId, connection);
      const response = { data: current };
      await idempotencyRepo.saveResponse(key, 'COMPLETED', response, orderId, connection);
      await connection.commit();
      return response;
    }

    await ordersRepo.updateStatus(orderId, 'CONFIRMED', connection);
    const confirmed = await ordersRepo.getWithItems(orderId, connection);
    const response = { data: confirmed };
    await idempotencyRepo.saveResponse(key, 'COMPLETED', response, orderId, connection);
    await connection.commit();
    return response;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function cancelOrder(orderId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const order = await ordersRepo.lockById(orderId, connection);
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (order.status === 'CANCELED') {
      throw new ConflictError('Order already canceled');
    }

    if (order.status === 'CONFIRMED') {
      const ageMs = Date.now() - new Date(order.created_at).getTime();
      if (ageMs > 10 * 60 * 1000) {
        throw new ConflictError('Confirmed orders can only be canceled within 10 minutes');
      }
    }

    const items = await ordersRepo.getItems(orderId, connection);
    for (const item of items) {
      await productRepo.incrementStock(item.product_id, item.qty, connection);
    }

    await ordersRepo.updateStatus(orderId, 'CANCELED', connection);
    await connection.commit();
    return { ...order, status: 'CANCELED', items };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  fetchCustomer,
  getOrder,
  listOrders,
  createOrder,
  confirmOrder,
  cancelOrder
};
