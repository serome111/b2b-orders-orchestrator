const express = require('express');
const { z } = require('zod');
const { authenticate, serviceOnly } = require('../middleware/auth');
const { validateBody, validateQuery } = require('../lib/validator');
const service = require('../services/customersService');

const router = express.Router();

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(3).max(50)
});

const updateSchema = createSchema.partial();

const listQuerySchema = z.object({
  search: z.string().optional().default(''),
  cursor: z.coerce.number().int().nonnegative().optional().default(0),
  limit: z.coerce.number().int().positive().max(50).optional().default(10)
});

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

router.post('/customers', authenticate(), validateBody(createSchema), async (req, res, next) => {
  try {
    const created = await service.create(req.body);
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
});

router.get('/customers/:id', authenticate(), async (req, res, next) => {
  try {
    const customer = await service.get(req.params.id);
    res.json({ data: customer });
  } catch (err) {
    next(err);
  }
});

router.get('/customers', authenticate(), validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    const { rows, nextCursor } = await service.list(req.query);
    res.json({ data: rows, nextCursor });
  } catch (err) {
    next(err);
  }
});

router.put('/customers/:id', authenticate(), validateBody(updateSchema), async (req, res, next) => {
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

router.delete('/customers/:id', authenticate(), async (req, res, next) => {
  try {
    await service.remove(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get('/internal/customers/:id', serviceOnly, async (req, res, next) => {
  try {
    const customer = await service.get(req.params.id);
    res.json({ data: customer });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
