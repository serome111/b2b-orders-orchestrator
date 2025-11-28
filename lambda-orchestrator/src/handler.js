const axios = require('axios');
const { z } = require('zod');
require('dotenv').config();

const requestSchema = z.object({
  customer_id: z.coerce.number().int().positive(),
  items: z
    .array(
      z.object({
        product_id: z.coerce.number().int().positive(),
        qty: z.coerce.number().int().positive()
      })
    )
    .min(1),
  idempotency_key: z.string().min(3),
  correlation_id: z.string().optional()
});

function buildResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

function axiosErrorMessage(err) {
  if (err.response) {
    return { status: err.response.status, data: err.response.data };
  }
  return { status: 500, data: { message: err.message || 'Upstream error' } };
}

exports.createAndConfirmOrder = async (event) => {
  const rawBody = event?.body;
  let payload;

  try {
    const parsed = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    payload = requestSchema.parse(parsed);
  } catch (err) {
    return buildResponse(400, {
      success: false,
      message: 'Validation error',
      errors: err.errors || err.message
    });
  }

  const correlationId = payload.correlation_id || `corr-${Date.now()}`;

  try {
    const customerResp = await axios.get(
      `${process.env.CUSTOMERS_API_BASE}/internal/customers/${payload.customer_id}`,
      {
        headers: { Authorization: `Bearer ${process.env.SERVICE_TOKEN}` }
      }
    );
    const customer = customerResp.data.data;

    const orderResp = await axios.post(
      `${process.env.ORDERS_API_BASE}/orders`,
      { customer_id: payload.customer_id, items: payload.items },
      { headers: { Authorization: `Bearer ${process.env.SERVICE_TOKEN}` } }
    );
    const order = orderResp.data.data;

    const confirmResp = await axios.post(
      `${process.env.ORDERS_API_BASE}/orders/${order.id}/confirm`,
      {},
      {
        headers: {
          Authorization: `Bearer ${process.env.SERVICE_TOKEN}`,
          'X-Idempotency-Key': payload.idempotency_key
        }
      }
    );

    const confirmedOrder = confirmResp.data.data;

    return buildResponse(201, {
      success: true,
      correlationId,
      data: { customer, order: confirmedOrder }
    });
  } catch (err) {
    const upstream = axiosErrorMessage(err);
    const status = upstream.status || 500;
    return buildResponse(status, {
      success: false,
      correlationId,
      message: upstream.data?.message || 'Error processing order',
      details: upstream.data
    });
  }
};
