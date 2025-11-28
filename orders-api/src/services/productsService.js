const repo = require('../repositories/productsRepository');
const { ConflictError, NotFoundError } = require('../lib/errors');

async function create(payload) {
  try {
    const id = await repo.create(payload);
    return repo.findById(id);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new ConflictError('SKU already exists');
    }
    throw err;
  }
}

async function update(id, payload) {
  const affected = await repo.update(id, payload);
  if (affected === 0) throw new NotFoundError('Product not found');
  return repo.findById(id);
}

async function get(id) {
  const product = await repo.findById(id);
  if (!product) throw new NotFoundError('Product not found');
  return product;
}

async function list(params) {
  const rows = await repo.list(params);
  const nextCursor = rows.length === params.limit ? rows[rows.length - 1].id : null;
  return { rows, nextCursor };
}

module.exports = {
  create,
  update,
  get,
  list
};
