const express = require('express');
const morgan = require('morgan');
const config = require('./config');
const customersRouter = require('./routes/customers');
const errorHandler = require('./middleware/error-handler');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(morgan(config.logLevel));

  app.use(customersRouter);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
