const { isAppError } = require('../lib/errors');

function errorHandler(err, _req, res, _next) {
  if (isAppError(err)) {
    return res.status(err.status).json({ message: err.message, details: err.details });
  }
  console.error('Unexpected error', err);
  return res.status(500).json({ message: 'Internal server error' });
}

module.exports = errorHandler;
