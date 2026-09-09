# Esencia Glow

E-commerce de skincare y lifestyle. Monorepo pnpm: `apps/api` (Express 5 + TypeScript) y
`packages/shared` (contrato tipado). `apps/web` (Next.js) se agrega en el Milestone 2.

## Requisitos

- Node ≥ 22, pnpm ≥ 10
- MongoDB corriendo localmente (o una URI remota) para desarrollo — no se requiere para los
  tests, que usan `mongodb-memory-server`.

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
| `MONGODB_URI` | Fail-fast, siempre | Debe incluir el **nombre de base explícito** |
| `CLIENT_URL` | Fail-fast en producción | Whitelist de CORS/CSRF. Default `localhost:3000` en dev |
| `STRIPE_SECRET_KEY` | Fail-fast en producción | Requerida para el flujo de pagos (Milestone 1.6) |
| `STRIPE_WEBHOOK_SECRET` | Fail-fast en producción | Verificación de firma del webhook de Stripe |
| `RESEND_API_KEY` | Fail-fast en producción | Correo transaccional (verificación de email, reset) |
| `TELEGRAM_BOT_TOKEN` | Opcional, siempre | Alertas operativas. Su ausencia degrada a loguear |
| `ADMIN_ALERT_EMAIL` | Opcional, siempre | Canal secundario de alerta operativa |
| `SENTRY_DSN` | Opcional, siempre | Error tracking. Su ausencia no bloquea nada |

En **desarrollo**, las variables marcadas "fail-fast en producción" son opcionales: el server
arranca sin ellas, y cualquier ruta que las necesite responde `503` explícito en vez de fingir
éxito (se implementa junto con cada integración, en su propio milestone).

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
