const { describe, it, expect, beforeEach, vi } = require('vitest');

const repo = {
  findById: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn()
};

vi.mock('../src/repositories/productsRepository', () => repo);
const service = require('../src/services/productsService');
const { ConflictError, NotFoundError } = require('../src/lib/errors');

describe('productsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates product and returns it', async () => {
    repo.create.mockResolvedValueOnce(5);
    repo.findById.mockResolvedValueOnce({ id: 5, sku: 'SKU', name: 'Prod', price_cents: 100, stock: 1 });

    const result = await service.create({ sku: 'SKU', name: 'Prod', price_cents: 100, stock: 1 });
    expect(repo.create).toHaveBeenCalled();
    expect(result.id).toBe(5);
  });

  it('throws conflict on duplicate SKU', async () => {
    const dup = new Error('dup');
    dup.code = 'ER_DUP_ENTRY';
    repo.create.mockRejectedValueOnce(dup);
    await expect(service.create({ sku: 'SKU', name: 'Prod', price_cents: 100, stock: 1 })).rejects.toBeInstanceOf(ConflictError);
  });

  it('gets product or throws not found', async () => {
    repo.findById.mockResolvedValueOnce(null);
    await expect(service.get(99)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('updates product', async () => {
    repo.update.mockResolvedValueOnce(1);
    repo.findById.mockResolvedValueOnce({ id: 1, sku: 'S', name: 'N', price_cents: 100, stock: 1 });
    const updated = await service.update(1, { name: 'N' });
    expect(updated.name).toBe('N');
  });
});
