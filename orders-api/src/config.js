require('dotenv').config();
const { z } = require('zod');

const EnvSchema = z.object({
  PORT: z.string().optional().default('3002'),
  DB_HOST: z.string().min(1),
  DB_PORT: z.string().optional().default('3306'),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().optional().default(''),
  DB_NAME: z.string().min(1),
  JWT_SECRET: z.string().min(8),
  SERVICE_TOKEN: z.string().min(10),
  CUSTOMERS_API_BASE: z.string().url(),
  IDEMPOTENCY_TTL_MINUTES: z.string().optional().default('60'),
  LOG_LEVEL: z.string().optional().default('dev')
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration', parsed.error.flatten());
  process.exit(1);
}
const env = parsed.data;

module.exports = {
  port: parseInt(env.PORT, 10),
  db: {
    host: env.DB_HOST,
    port: parseInt(env.DB_PORT, 10),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME
  },
  jwtSecret: env.JWT_SECRET,
  serviceToken: env.SERVICE_TOKEN,
  customersApiBase: env.CUSTOMERS_API_BASE,
  idempotencyTtlMinutes: parseInt(env.IDEMPOTENCY_TTL_MINUTES, 10),
  logLevel: env.LOG_LEVEL
};
