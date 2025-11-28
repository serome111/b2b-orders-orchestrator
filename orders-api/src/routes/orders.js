const express = require('express');
const { z } = require('zod');
const { authenticate } = require('../middleware/auth');
const { validateBody, validateQuery } = require('../lib/validator');
const { ValidationError } = require('../lib/errors');
const service = require('../services/ordersService');

const router = express.Router();

const createOrderSchema = z.object({
  customer_id: z.coerce.number().int().positive(),
  items: z
    .array(
      z.object({
        product_id: z.coerce.number().int().positive(),
        qty: z.coerce.number().int().positive()
      })
    )
    .min(1)
});

const listQuerySchema = z.object({
  status: z.enum(['CREATED', 'CONFIRMED', 'CANCELED']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  cursor: z.coerce.number().int().nonnegative().optional().default(0),
  limit: z.coerce.number().int().positive().max(50).optional().default(10)
});

function parseOptionalDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

router.get('/orders/:id', authenticate(), async (req, res, next) => {
  try {
    const order = await service.getOrder(req.params.id);
    res.json({ data: order });
  } catch (err) {
    next(err);
  }
});

router.get('/orders', authenticate(), validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    const from = parseOptionalDate(req.query.from);
    const to = parseOptionalDate(req.query.to);
    if (req.query.from && !from) return next(new ValidationError({ from: ['Invalid date'] }));
    if (req.query.to && !to) return next(new ValidationError({ to: ['Invalid date'] }));
    const { rows, nextCursor } = await service.listOrders({ ...req.query, from, to });
    res.json({ data: rows, nextCursor });
  } catch (err) {
    next(err);
  }
});

router.post('/orders', authenticate(), validateBody(createOrderSchema), async (req, res, next) => {
  try {
    const created = await service.createOrder(req.body.customer_id, req.body.items);
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
});

router.post('/orders/:id/confirm', authenticate(), async (req, res, next) => {
  const key = req.headers['x-idempotency-key'];
  if (!key) {
    return next(new ValidationError({ idempotencyKey: ['X-Idempotency-Key header is required'] }));
  }
  try {
    const response = await service.confirmOrder(req.params.id, key);
    res.json(response);
  } catch (err) {
    next(err);
  }
});

router.post('/orders/:id/cancel', authenticate(), async (req, res, next) => {
  try {
    const canceled = await service.cancelOrder(req.params.id);
    res.json({ data: canceled });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
