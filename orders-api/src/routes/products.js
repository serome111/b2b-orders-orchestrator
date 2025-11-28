const express = require('express');
const { z } = require('zod');
const { authenticate } = require('../middleware/auth');
const { validateBody, validateQuery } = require('../lib/validator');
const service = require('../services/productsService');

const router = express.Router();

const createSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  price_cents: z.coerce.number().int().positive(),
  stock: z.coerce.number().int().nonnegative()
});

const updateSchema = z.object({
  price_cents: z.coerce.number().int().positive().optional(),
  stock: z.coerce.number().int().nonnegative().optional(),
  name: z.string().min(1).optional()
});

const listQuerySchema = z.object({
  search: z.string().optional().default(''),
  cursor: z.coerce.number().int().nonnegative().optional().default(0),
  limit: z.coerce.number().int().positive().max(50).optional().default(10)
});

router.post('/products', authenticate(), validateBody(createSchema), async (req, res, next) => {
  try {
    const created = await service.create(req.body);
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
});

router.patch('/products/:id', authenticate(), validateBody(updateSchema), async (req, res, next) => {
  try {
    if (Object.keys(req.body).length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }
    const updated = await service.update(req.params.id, req.body);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

router.get('/products/:id', authenticate(), async (req, res, next) => {
  try {
    const product = await service.get(req.params.id);
    res.json({ data: product });
  } catch (err) {
    next(err);
  }
});

router.get('/products', authenticate(), validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    const { rows, nextCursor } = await service.list(req.query);
    res.json({ data: rows, nextCursor });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
