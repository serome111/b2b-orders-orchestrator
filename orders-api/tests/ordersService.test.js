const { describe, it, expect, beforeEach, vi } = require('vitest');

const productRepo = {
  lockById: vi.fn(),
  decrementStock: vi.fn(),
  incrementStock: vi.fn()
};
const ordersRepo = {
  insertOrder: vi.fn(),
  insertOrderItem: vi.fn(),
  getWithItems: vi.fn(),
  getItems: vi.fn(),
  lockById: vi.fn(),
  updateStatus: vi.fn()
};
const idempotencyRepo = {
  findByKey: vi.fn(),
  insertPending: vi.fn(),
  saveResponse: vi.fn()
};
const poolConnection = {
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn()
};
const pool = {
  getConnection: vi.fn()
};

vi.mock('../src/db', () => pool);
vi.mock('../src/repositories/productsRepository', () => productRepo);
vi.mock('../src/repositories/ordersRepository', () => ordersRepo);
vi.mock('../src/repositories/idempotencyRepository', () => idempotencyRepo);
const service = require('../src/services/ordersService');
const { NotFoundError, ConflictError, AppError } = require('../src/lib/errors');

// mock fetchCustomer to avoid HTTP
vi.spyOn(service, 'fetchCustomer').mockImplementation(async (customerId) => {
  if (customerId === 999) throw new NotFoundError('Customer not found in Customers API');
  return { id: customerId };
});

describe('ordersService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pool.getConnection.mockResolvedValue(poolConnection);
    poolConnection.beginTransaction.mockResolvedValue();
    poolConnection.commit.mockResolvedValue();
    poolConnection.rollback.mockResolvedValue();
    poolConnection.release.mockResolvedValue();
  });

  it('creates order and returns it', async () => {
    productRepo.lockById.mockResolvedValue({ id: 1, price_cents: 100, stock: 10 });
    ordersRepo.insertOrder.mockResolvedValue(7);
    ordersRepo.getWithItems.mockResolvedValue({ id: 7, status: 'CREATED', items: [] });

    const order = await service.createOrder(1, [{ product_id: 1, qty: 2 }]);

    expect(ordersRepo.insertOrder).toHaveBeenCalledWith({ customerId: 1, totalCents: 200 }, poolConnection);
    expect(order.id).toBe(7);
  });

  it('throws when stock insufficient', async () => {
    productRepo.lockById.mockResolvedValue({ id: 1, price_cents: 100, stock: 1 });
    await expect(service.createOrder(1, [{ product_id: 1, qty: 2 }])).rejects.toBeInstanceOf(AppError);
  });

  it('cancel order restores stock and enforces window', async () => {
    const past = new Date(Date.now() - 9 * 60 * 1000); // 9 minutes ago
    ordersRepo.lockById.mockResolvedValue({ id: 1, status: 'CONFIRMED', created_at: past });
    ordersRepo.getItems.mockResolvedValue([{ product_id: 1, qty: 1 }]);

    const result = await service.cancelOrder(1);
    expect(productRepo.incrementStock).toHaveBeenCalledWith(1, 1, poolConnection);
    expect(result.status).toBe('CANCELED');
  });

  it('cancel order fails after 10 minutes', async () => {
    const past = new Date(Date.now() - 11 * 60 * 1000);
    ordersRepo.lockById.mockResolvedValue({ id: 1, status: 'CONFIRMED', created_at: past });
    await expect(service.cancelOrder(1)).rejects.toBeInstanceOf(ConflictError);
  });

  it('cancel order throws not found', async () => {
    ordersRepo.lockById.mockResolvedValue(null);
    await expect(service.cancelOrder(99)).rejects.toBeInstanceOf(NotFoundError);
  });
});
