# Monorepo Pedidos B2B

Infraestructura mínima solicitada en la prueba técnica: dos APIs (Customers y Orders) sobre MySQL, más un Lambda orquestador Serverless.

## Estructura
- `customers-api/`: API de clientes (Express + JWT + Zod) y `openapi.yaml`.
- `orders-api/`: API de productos y órdenes (Express + JWT + Zod + idempotencia) y `openapi.yaml`.
- `lambda-orchestrator/`: Lambda HTTP con Serverless que orquesta create+confirm.
- `db/schema.sql` y `db/seed.sql`: tablas y datos base.
- `docker-compose.yml`: arranque local de MySQL + APIs.

## Prerrequisitos
- Docker y Docker Compose.
- Node.js 22+ (para correr servicios sin Docker o el Lambda offline).

## Variables de entorno
Cada servicio trae `.env.example`; copia a `.env` si deseas cambiar valores.

### Customers API (`customers-api/.env`)
- `PORT=3001`
- `DB_HOST=db` (cuando usas Compose)
- `DB_USER=app`, `DB_PASSWORD=app`, `DB_NAME=b2b_orders`
- `JWT_SECRET=supersecret`
- `SERVICE_TOKEN=service-token-example` (token compartido entre servicios)

### Orders API (`orders-api/.env`)
- `PORT=3002`
- Misma configuración de BD que Customers.
- `CUSTOMERS_API_BASE=http://customers-api:3001` (o `http://localhost:3001` fuera de Docker)
- `IDEMPOTENCY_TTL_MINUTES=60`
- `SERVICE_TOKEN` y `JWT_SECRET` iguales al servicio de customers.

### Lambda (`lambda-orchestrator/.env`)
- `CUSTOMERS_API_BASE=http://localhost:3001`
- `ORDERS_API_BASE=http://localhost:3002`
- `SERVICE_TOKEN=service-token-example`

## Arranque con Docker Compose
```bash
docker-compose build
docker-compose up -d
```
Verifica health:
- Customers: http://localhost:3001/health
- Orders: http://localhost:3002/health

La base de datos se crea y seed-ata automáticamente con los scripts de `db/`.

## Scripts NPM principales
En cada servicio (`customers-api` u `orders-api`):
```bash
npm install
npm run migrate   # aplica schema.sql
npm run seed      # aplica seed.sql
npm run dev       # nodemon
npm start         # arranca el servidor
npm test          # ejecuta pruebas unitarias (vitest con mocks)
```
Lambda:
```bash
cd lambda-orchestrator
npm install
npm run dev       # serverless-offline en puerto 3003
npm run deploy    # serverless deploy (requiere credenciales AWS configuradas)
```
El orquestador usa runtime `nodejs22.x` (Serverless v4 + serverless-offline v14).

## Autenticación rápida
Genera un JWT de prueba (usa el `JWT_SECRET` de tus .env):
```bash
node -e "console.log(require('jsonwebtoken').sign({ sub: 'demo-user' }, 'supersecret'))"
```
En llamadas internas (Orders -> Customers y Lambda -> APIs) se usa `Authorization: Bearer ${SERVICE_TOKEN}`.

## Ejemplos cURL
### Customers API
```bash
# Crear cliente
curl -X POST http://localhost:3001/customers \
  -H "Authorization: Bearer <JWT_AQUI>" \
  -H "Content-Type: application/json" \
  -d '{"name":"ACME","email":"ops@example.com","phone":"+1-555"}'
```

### Orders API
```bash
# Crear producto
curl -X POST http://localhost:3002/products \
  -H "Authorization: Bearer <JWT_AQUI>" \
  -H "Content-Type: application/json" \
  -d '{"sku":"SKU-500","name":"Desk","price_cents":29900,"stock":15}'

# Crear orden (valida cliente en Customers)
curl -X POST http://localhost:3002/orders \
  -H "Authorization: Bearer <JWT_AQUI>" \
  -H "Content-Type: application/json" \
  -d '{"customer_id":1,"items":[{"product_id":1,"qty":2}]}'

# Confirmar orden de forma idempotente
curl -X POST http://localhost:3002/orders/1/confirm \
  -H "Authorization: Bearer <JWT_AQUI>" \
  -H "X-Idempotency-Key: abc-123" \
  -H "Content-Type: application/json"
```

### Lambda Orquestador (offline en 3003)
```bash
curl -X POST http://localhost:3003/orchestrator/create-and-confirm-order \
  -H "Content-Type: application/json" \
  -d '{"customer_id":1,"items":[{"product_id":1,"qty":2}],"idempotency_key":"abc-123","correlation_id":"req-789"}'
```
Respuesta esperada:
```json
{
  "success": true,
  "correlationId": "req-789",
  "data": { "customer": { ... }, "order": { "status": "CONFIRMED", "items": [...] } }
}
```

## Despliegue del Lambda en AWS
1. Configura credenciales AWS (`aws configure`).
2. Exporta/define variables de entorno con URLs públicas de las APIs (`CUSTOMERS_API_BASE`, `ORDERS_API_BASE`, `SERVICE_TOKEN`).
3. Desde `lambda-orchestrator`: `npm install && npm run deploy`.

## Documentación OpenAPI
- Customers: `customers-api/openapi.yaml`
- Orders: `orders-api/openapi.yaml`

Puedes importarlos en Postman/Insomnia. Incluye ejemplos de paginación por cursor, filtros y headers requeridos.

## Notas
- Confirmación usa cabecera `X-Idempotency-Key` y persiste la respuesta en `idempotency_keys`.
- Cancelación restaura stock; si la orden está `CONFIRMED`, solo permite cancelar dentro de 10 minutos de su creación.
- Todas las consultas SQL están parametrizadas y se agrupan en transacciones donde corresponde.
- Código organizado en capas (rutas → servicios → repositorios) con validación Zod via middleware y manejador central de errores para respuestas consistentes.
