# Esencia Glow

E-commerce de skincare y lifestyle. Monorepo pnpm: `apps/api` (Express 5 + TypeScript) y
`packages/shared` (contrato tipado). `apps/web` (Next.js) se agrega en el Milestone 2.

## Requisitos

- Node ≥ 22, pnpm ≥ 10
- Un cluster de **MongoDB Atlas** para desarrollo (base `esencia_glow_dev`) — no se requiere
  para los tests, que usan `mongodb-memory-server`.

## Arranque en desarrollo

```bash
pnpm install
cp apps/api/.env.development.example apps/api/.env.development.local
# completar apps/api/.env.development.local con valores reales de desarrollo
pnpm dev:api
```

`pnpm dev:api` corre `tsx watch` sobre `apps/api/src/server.ts`. El server no arranca si falta
alguna variable requerida (`loadEnv()` fail-fast) — el mensaje de error dice cuál falta.

## Verificación

```bash
pnpm verify   # typecheck + lint + build + test en todo el monorepo
```

O por paso: `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test`.

## Variables de entorno

Nunca se versiona un `.env` con valores reales — solo `.env.*.example` con placeholders
(`apps/api/.env.development.example`, `apps/api/.env.production.example`). El `.gitignore` raíz
ignora cualquier `.env`/`.env.*` real y re-permite explícitamente los `.example`.

| Variable | Criticidad | Notas |
|---|---|---|
| `NODE_ENV` | Fail-fast, siempre | `development` \| `production` \| `test` |
| `PORT` | Con default | `4000` si no se especifica |
| `JWT_SECRET` | Fail-fast, siempre | ≥ 48 caracteres — `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | Fail-fast, siempre | ≥ 48 caracteres, **distinto** de `JWT_SECRET` |
| `ENCRYPTION_KEY` | Fail-fast, siempre | ≥ 32 caracteres. Cifra secretos at-rest (2FA, Milestone 1.2) |
| `MONGODB_URI` | Fail-fast, siempre | Atlas SRV (`mongodb+srv://…`). Debe incluir el **nombre de base explícito** en el path (`/esencia_glow_dev`), antes del `?` |
| `CLIENT_URL` | Fail-fast en producción | Whitelist de CORS/CSRF. Default `localhost:3000` en dev |
| `STRIPE_SECRET_KEY` | Fail-fast en producción | Requerida para el flujo de pagos (Milestone 1.6) |
| `STRIPE_WEBHOOK_SECRET` | Fail-fast en producción | Verificación de firma del webhook de Stripe |
| `STRIPE_WEBHOOK_TOLERANCE_SECONDS` | Con default | Tolerancia de timestamp del webhook (anti-replay). Default `300` (5 min), nunca `0` |
| `PAYMENT_RECONCILE_AFTER_MINUTES` | Con default | Umbral del reconciliador: cuánto espera un pedido `pending` con PaymentIntent antes de que el cron le pregunte a Stripe. Default `10` |
| `RESEND_API_KEY` | Fail-fast en producción | Correo transaccional (verificación de email, reset) |
| `RESEND_FROM_EMAIL` | Con default | Remitente. Default `onboarding@resend.dev` (sandbox); en producción requiere dominio verificado en Resend |
| `ACCESS_TOKEN_TTL` | Con default | Vida del JWT de acceso. Default `15m` |
| `REFRESH_TOKEN_TTL_DAYS` | Con default | Vida del refresh token (revocable, hasheado en DB). Default `30` |
| `TELEGRAM_BOT_TOKEN` | Opcional, siempre | Alertas operativas. Su ausencia degrada a loguear |
| `ADMIN_ALERT_EMAIL` | Opcional, siempre | Canal secundario de alerta operativa |
| `SENTRY_DSN` | Opcional, siempre | Error tracking. Su ausencia no bloquea nada |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_ROLE` | Opcional, siempre | Solo los lee `pnpm --filter @esencia-glow/api seed:admin`, nunca el server |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Fail-fast en producción | `uploadService` (Milestone 1.3). En dev, su ausencia hace que los endpoints de imagen respondan `503` |
| `CLOUDINARY_FOLDER` | Con default | Carpeta raíz en Cloudinary. Default `esencia-glow/<NODE_ENV>` |

En **desarrollo**, las variables marcadas "fail-fast en producción" son opcionales: el server
arranca sin ellas, y cualquier ruta que las necesite responde `503` explícito en vez de fingir
éxito (se implementa junto con cada integración, en su propio milestone).

## Pagos con Stripe (Milestone 1.6.1)

`POST /api/v1/orders` suma `paymentMethod: "card" | "oxxo"` al body. El checkout crea la orden
(transacción de 1.5, con el TTL de reserva según el método) y, **después** del commit, crea el
`PaymentIntent` en Stripe (`ensurePaymentIntent`, idempotente hacia Stripe con
`order:<id>:intent`). La respuesta de `POST /orders` incluye `payment.clientSecret` (tarjeta,
para el Payment Element) o `payment.oxxoVoucher` (OXXO, con `hostedVoucherUrl` y `expiresAt`) —
**nunca** una noción de "pagado": eso lo decide únicamente el webhook (1.6.2).

`POST /api/v1/orders/:id/payment` reanuda el pago de un pedido `pending` propio (mismo
`clientSecret`/ficha, sin crear otro PaymentIntent) — útil si el cliente cerró la pestaña antes
de pagar o volvió desde el 409 de "ya tienes un pedido pendiente".

**OXXO**: la ficha dura `Settings.payments.oxxoVoucherDays` (1-7, default 2) y el stock queda
**apartado, no descontado**, hasta que Stripe confirma el pago (hasta el siguiente día hábil).
Si no se paga, el pedido se cierra `oxxoConfirmationGraceHours` (default 96h) después de que la
ficha vence — nunca antes, porque Stripe **no permite cancelar una ficha OXXO vigente ni
reembolsar un pago OXXO**. Montos fuera de $10.00–$10,000.00 MXN se rechazan antes de reservar.

**Cierre "Stripe-first"** (`closePendingOrder`, usado por la cancelación del cliente y el
barrendero de expiración): si el pedido ya tiene un `PaymentIntent`, se consulta/cancela en
Stripe **antes** de tocar inventario — nunca se cancela localmente un pedido cuyo pago Stripe ya
procesó (en ese caso se liquida a `paid` y se responde 409 "tu pago ya se procesó").

**Reconciliación** (mismo tick del cron): un pedido `pending` con `PaymentIntent` que lleva más
de `PAYMENT_RECONCILE_AFTER_MINUTES` esperando se consulta directo a Stripe — respaldo para un
webhook que nunca llega.

**Sin `STRIPE_SECRET_KEY`** (dev sin configurar): el checkout verifica la configuración **antes**
de reservar stock — responde `503` "Los pagos no están configurados" sin crear ninguna orden ni
reserva. (Una llamada real a Stripe que falla en medio del checkout, en cambio, sí puede dejar un
pedido `pending` sin `PaymentIntent`: el barrendero de expiración lo cierra al vencer.)

Pendiente de 1.6.2/1.6.3: webhook (`payment_intent.succeeded/payment_failed/canceled`), dedupe
por `event.id`, **anti card-testing** (5 rechazos de tarjeta cierran el pedido — el campo
`payment.failedAttempts` ya existe en el modelo, falta conectarlo al webhook), reembolsos,
disputas y correos transaccionales.

## Checkout — header `Idempotency-Key` (Milestone 1.5)

`POST /api/v1/orders` **exige** el header `Idempotency-Key` (UUID v4). Contrato para el
cliente (front, Milestone 2):

- Generar un UUID v4 nuevo por intento de compra (no por request) y reenviarlo tal cual en
  cualquier reintento de ese mismo intento (doble clic, timeout de red, reintento del
  navegador).
- Mismo header + mismo body → **200** con la orden ya creada (replay, no una orden nueva).
- Mismo header + body distinto → **409** (`"Esa clave ya se usó para otro pedido"`) — nunca
  reusar una key para un carrito diferente.
- Si el checkout falla por falta de stock u otra validación, la key **no se consume**:
  reintentar con la misma key después de ajustar el carrito funciona normal.
- Un segundo intento de compra mientras el primero sigue `pending` responde **409** con el
  `orderId` del pendiente (`errors.orderId`) — un cliente solo puede tener un checkout abierto
  a la vez.

## Cron (Milestone 1.4 + 1.5 + 1.6.1)

Un solo `node-cron` corre cada minuto (`jobs/index.ts`, nunca montado en `buildApp()`): libera
reservas de stock vencidas, cierra pedidos `pending` vencidos (Stripe-first, ver arriba),
reconcilia pagos pendientes sin webhook y refresca `Bundle.stockCache`. Todas las operaciones son
idempotentes por documento — seguro correr varias instancias de la API sin lock distribuido.

## Runbook de deploy (referencia — se completa en Milestone 1.10)

1. Configurar las variables de `apps/api/.env.production.example` en el secrets manager del
   proveedor de hosting elegido.
2. `pnpm install --frozen-lockfile && pnpm build`.
3. Correr `syncIndexes()` como paso de CD, **después** de desplegar el código nuevo y **antes**
   de cortar tráfico hacia él (`autoIndex: false` en producción).
4. Verificar `GET /api/v1/health` antes de considerar el deploy exitoso.
5. DNS del dominio de correo transaccional (Resend) verificado — el modo sandbox no sirve para
   producción.

## Estructura

```
esencia_glow/
├── apps/
│   └── api/            # Express 5 + TS — routes/controllers/services/models/validators/middlewares/utils
└── packages/
    └── shared/          # Tipos y enums compartidos (ApiResponse, OrderStatus, ...)
```

Cada capa del backend depende solo de la inmediatamente inferior. El detalle de arquitectura y
seguridad vive en `~/.claude/standards/` (fuera de este repo, estándares globales del autor).
