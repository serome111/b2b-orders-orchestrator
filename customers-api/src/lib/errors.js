class AppError extends Error {
  constructor(message, status = 500, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

class ValidationError extends AppError {
  constructor(details) {
    super('Validation error', 400, details);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409);
  }
}

const isAppError = (err) => err instanceof AppError;

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  isAppError
};
