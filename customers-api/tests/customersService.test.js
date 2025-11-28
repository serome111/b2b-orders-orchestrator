const { describe, it, expect, beforeEach, vi } = require('vitest');

const repo = {
  findById: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn()
};

vi.mock('../src/repositories/customersRepository', () => repo);
const service = require('../src/services/customersService');
const { ConflictError, NotFoundError } = require('../src/lib/errors');

describe('customersService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a customer and returns it', async () => {
    repo.create.mockResolvedValueOnce(10);
    repo.findById.mockResolvedValueOnce({ id: 10, name: 'ACME', email: 'a@b.com', phone: '123' });

    const result = await service.create({ name: 'ACME', email: 'a@b.com', phone: '123' });

    expect(repo.create).toHaveBeenCalledWith({ name: 'ACME', email: 'a@b.com', phone: '123' });
    expect(result.id).toBe(10);
  });

  it('throws conflict on duplicate email', async () => {
    const duplicateError = new Error('dup');
    duplicateError.code = 'ER_DUP_ENTRY';
    repo.create.mockRejectedValueOnce(duplicateError);

    await expect(service.create({ name: 'ACME', email: 'a@b.com', phone: '123' })).rejects.toBeInstanceOf(ConflictError);
  });

  it('lists customers with nextCursor', async () => {
    repo.list.mockResolvedValueOnce([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' }
    ]);

    const { rows, nextCursor } = await service.list({ search: '', cursor: 0, limit: 2 });

    expect(rows).toHaveLength(2);
    expect(nextCursor).toBe(2);
  });

  it('updates a customer', async () => {
    repo.update.mockResolvedValueOnce(1);
    repo.findById.mockResolvedValueOnce({ id: 1, name: 'New', email: 'n@b.com', phone: '555' });

    const updated = await service.update(1, { name: 'New' });
    expect(updated.name).toBe('New');
  });

  it('throws NotFound on update when no rows affected', async () => {
    repo.update.mockResolvedValueOnce(0);
    await expect(service.update(99, { name: 'X' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('deletes (soft) a customer', async () => {
    repo.softDelete.mockResolvedValueOnce(1);
    await expect(service.remove(1)).resolves.toBeUndefined();
  });

  it('throws NotFound on delete when no rows affected', async () => {
    repo.softDelete.mockResolvedValueOnce(0);
    await expect(service.remove(999)).rejects.toBeInstanceOf(NotFoundError);
  });
});
