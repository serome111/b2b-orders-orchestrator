const repo = require('../repositories/customersRepository');
const { ConflictError, NotFoundError } = require('../lib/errors');

async function get(id) {
  const customer = await repo.findById(id);
  if (!customer) throw new NotFoundError('Customer not found');
  return customer;
}

async function list(params) {
  const rows = await repo.list(params);
  const nextCursor = rows.length === params.limit ? rows[rows.length - 1].id : null;
  return { rows, nextCursor };
}

async function create(payload) {
  try {
    const id = await repo.create(payload);
    return get(id);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new ConflictError('Email already exists');
    }
    throw err;
  }
}

async function update(id, payload) {
  try {
    const affected = await repo.update(id, payload);
    if (affected === 0) throw new NotFoundError('Customer not found');
    return get(id);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new ConflictError('Email already exists');
    }
    throw err;
  }
}

async function remove(id) {
  const affected = await repo.softDelete(id);
  if (affected === 0) throw new NotFoundError('Customer not found');
}

module.exports = {
  get,
  list,
  create,
  update,
  remove
};
