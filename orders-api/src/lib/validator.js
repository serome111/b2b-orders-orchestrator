const { ValidationError } = require('./errors');

function validate(schema, prop = 'body') {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req[prop]);
    if (!parsed.success) {
      return next(new ValidationError(parsed.error.flatten()));
    }
    req[prop] = parsed.data;
    return next();
  };
}

module.exports = {
  validateBody: (schema) => validate(schema, 'body'),
  validateQuery: (schema) => validate(schema, 'query'),
  validateParams: (schema) => validate(schema, 'params')
};
