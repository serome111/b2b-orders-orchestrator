const express = require('express');
const morgan = require('morgan');
const config = require('./config');
const productsRouter = require('./routes/products');
const ordersRouter = require('./routes/orders');
const errorHandler = require('./middleware/error-handler');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(morgan(config.logLevel));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(productsRouter);
  app.use(ordersRouter);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
