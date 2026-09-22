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
| `STRIPE_WEBHOOK_TOLERANCE_SECONDS` | Con default, fail-fast si es inválida | Tolerancia de timestamp del webhook (anti-replay). Default `300` (5 min). Debe ser un entero positivo — `0` o negativo no arranca el server |
| `PAYMENT_RECONCILE_AFTER_MINUTES` | Con default, fail-fast si es inválida | Umbral del reconciliador: cuánto espera un pedido `pending` con PaymentIntent antes de que el cron le pregunte a Stripe. Default `10`, mismo criterio de entero positivo |
| `SUBSCRIPTION_INCOMPLETE_EXPIRE_MINUTES` | Con default, fail-fast si es inválida | Milestone 1.7.2a: minutos tras reclamar el cupo antes de que el cron libere una cuenta de suscripción `INCOMPLETE` sin `providerSubscriptionId`. Default `30`, mismo criterio de entero positivo |
| `SUBSCRIPTION_EDITION_ALERT_DAYS` | Con default, fail-fast si es inválida | Milestone 1.7.2b: días de anticipación con los que el cron avisa al admin que falta publicar la edición del ciclo que está por cobrarse. Default `7`, mismo criterio de entero positivo |
| `TRUST_PROXY_HOPS` | **Fail-fast en producción** (sin default silencioso ahí) | Milestone 1.10: saltos de reverse proxy de confianza delante de la API (`app.set("trust proxy", N)`) — sin esto, `req.ip` toma la IP del proxy y todo rate limiter por IP colapsa en un solo bucket compartido. Default `0` fuera de producción (sin proxy de confianza); en Railway + Cloudflare se exige explícito, ver el runbook abajo |
| `RESEND_API_KEY` | Fail-fast en producción | Correo transaccional (verificación de email, reset, pedidos, suscripciones) |
| `RESEND_FROM_EMAIL` | Con default | Remitente. Default `onboarding@resend.dev` (sandbox); en producción requiere dominio verificado en Resend |
| `ACCESS_TOKEN_TTL` | Con default | Vida del JWT de acceso. Default `15m` |
| `REFRESH_TOKEN_TTL_DAYS` | Con default | Vida del refresh token (revocable, hasheado en DB). Default `30` |
| `TELEGRAM_BOT_TOKEN` | Opcional, siempre | Alertas operativas. Su ausencia degrada a loguear |
| `ADMIN_ALERT_EMAIL` | Opcional, siempre | Milestone 1.7.2a: destino de la alerta por correo cuando la caja de un ciclo sale con edición o inventario faltante. Sin configurar, se degrada a loguear |
| `SENTRY_DSN` | Opcional, siempre | Error tracking. Su ausencia no bloquea nada |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_ROLE` | Opcional, siempre | Solo los lee `pnpm --filter @esencia-glow/api seed:admin`, nunca el server |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Fail-fast en producción | `uploadService` (Milestone 1.3). En dev, su ausencia hace que los endpoints de imagen respondan `503` |
| `CLOUDINARY_FOLDER` | Con default | Carpeta raíz en Cloudinary. Default `esencia-glow/<NODE_ENV>` |

En **desarrollo**, las variables marcadas "fail-fast en producción" son opcionales: el server
arranca sin ellas, y cualquier ruta que las necesite responde `503` explícito en vez de fingir
éxito (se implementa junto con cada integración, en su propio milestone).

## Pagos con Stripe (Milestone 1.6)

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

### Webhook (`POST /api/v1/webhooks/stripe`, Milestone 1.6.2)

Único evento "pagado" real: **el estado lo decide solo el webhook**, nunca el redirect del
navegador. Montado en `app.ts` **antes** de `cors`/`express.json`/`verifyOrigin`/el rate limiter
global (con body crudo vía `express.raw`, porque la verificación de firma de Stripe necesita el
Buffer tal cual, y un `JSON.parse`/re-serializado rompería el HMAC) — lleva su propio limiter
(`webhookRateLimiter`, 600/15 min), no el de clientes reales.

Eventos suscritos (configurar el endpoint en el Dashboard de Stripe o `stripe listen` con
exactamente estos siete): `payment_intent.succeeded`, `payment_intent.payment_failed`,
`payment_intent.canceled`, `charge.refunded`, `charge.refund.updated`, `charge.dispute.created`,
`charge.dispute.closed`. Cualquier otro tipo de evento llega `ignored`.

**Dedupe persistido** (`PaymentEvent`, `eventId` único, TTL a `PAYMENT_EVENT_RETENTION_DAYS` días
= la ventana de dedupe): el `insert` ocurre antes de despachar, así que dos reentregas
simultáneas del mismo evento nunca se procesan ambas. Una fila `processing` cuyo lease
(`PAYMENT_EVENT_LEASE_MINUTES`, 5 min) venció es reclamable por la siguiente reentrega — cubre
una caída del proceso a medio despacho.

**Localizar la orden**: por `payment.intentId` (índice único). Como respaldo, por
`metadata.orderId` — solo para localizar, nunca para autorizar: si esa orden ya tiene OTRO
intent, es una anomalía auditada, no un pago que se adopta a ciegas.

**Clasificación de errores**: un rechazo de negocio (orden inexistente, monto que no cuadra, pago
tardío sobre una orden ya cerrada) responde **200** con el evento marcado `failed` — reintentar
no lo arregla. Cualquier excepción (Stripe caído, DB, timeout) responde **500** para que Stripe
reintente la entrega.

**Sin `STRIPE_WEBHOOK_SECRET`** (Stripe configurado pero sin secreto de webhook): el endpoint
responde `503` "Los webhooks de pago no están configurados" sin escribir nada.

**Anti card-testing**: cada `payment_intent.payment_failed` de tarjeta suma 1 a
`payment.failedAttempts` (idempotente por evento — reprocesar el mismo no cuenta dos veces). Al
5.º rechazo (`MAX_CARD_FAILED_ATTEMPTS`) se cancela el `PaymentIntent` en Stripe y se cierra el
pedido, liberando el stock. Para OXXO, un `payment_failed` (ficha vencida sin pago, que Stripe
entrega hasta 10 días después) cierra directo — no hay "otro intento" con la misma ficha.

**Cancelación admin** (`PATCH /admin/orders/:id/status` a `cancelled`) también pasa por
`closePendingOrder` (Stripe-first, decisión 1 de 1.6.2): un admin ya no puede liberar stock de un
pedido cuyo cobro Stripe está procesando.

**Verificación local** con `stripe listen --forward-to localhost:4000/api/v1/webhooks/stripe`:
imprime el `whsec_...` que va en `STRIPE_WEBHOOK_SECRET` de `.env.development.local` (tiene que
ser el que imprime `stripe listen`, no el de un endpoint configurado en el Dashboard). Con el
server corriendo, `stripe trigger payment_intent.succeeded` o pagar de verdad con una tarjeta de
prueba contra un pedido creado por la API ejercita el flujo completo.

### Reembolsos (Milestone 1.6.3)

`POST /admin/orders/:id/refund` (`{ twoFactorCode, reason? }`) — **siempre total**, nunca un
parcial pedido desde la API. Exige **step-up 2FA** (código TOTP del admin) *antes* de tocar
Stripe: sin código válido, `provider.refund` nunca se llama. Solo aplica a pedidos
`paid`/`processing`/`shipped`/`delivered` pagados con **tarjeta** (OXXO responde 409: Stripe no
permite reembolsarlo) y sin un contracargo abierto. El monto es siempre el remanente
(`totalCents - refundedAmountCents`). Responde **202** — la orden pasa a `refunded` cuando el
webhook `charge.refunded` lo confirma, nunca al llamar el endpoint. Mutex con lease de
`REFUND_REQUEST_LEASE_MINUTES` (30 min) sobre `payment.refundRequestedAt`: dos solicitudes
concurrentes para el mismo pedido nunca disparan dos reembolsos, y un fallo de Stripe libera el
mutex para poder reintentar. Rate limit dedicado (`refundRateLimiter`, 5/15 min por admin) —
segunda excepción a "las rutas admin no llevan throttling" (la primera es la subida de imágenes).

Restock automático **solo si el pedido no se ha enviado** (`paid`/`processing`): las unidades
comprometidas vuelven a `Inventory.onHand`. Desde `shipped`/`delivered`, sin restock automático —
el admin ajusta el inventario a mano si el producto regresa en buen estado. Un reembolso **parcial**
hecho desde el Dashboard de Stripe se refleja en `payment.refundedAmountCents` sin transicionar la
orden (`$max`, así un evento fuera de orden nunca hace bajar el monto ya aplicado).

### Disputas / contracargos (Milestone 1.6.3)

`charge.dispute.created`/`.closed` traducen a `Order.disputeStatus` (`open` → `won`/`lost`/
`withdrawn`) y `disputedAt`. Vive en la orden, no en `payment`: un contracargo perdido **nunca**
es `refunded`, el dinero se fue por la vía de la disputa. Guard de estado terminal: una disputa
`won`/`lost`/`withdrawn` no se reabre si un evento fuera de orden llega después. Mientras
`disputeStatus: open`, `PATCH /admin/orders/:id/status` rechaza `paid → processing` y
`processing → shipped` con 409 "El pedido tiene un contracargo abierto" — no despachar mercancía
bajo contracargo.

### Correos transaccionales (Milestone 1.6.3)

Adapter `MailProvider` (`resolveMailProvider()`, mismo patrón que el de pagos) sobre **Resend**;
sin `RESEND_API_KEY` los correos se loguean y no fingen éxito. Shell HTML compartido
(`renderTransactionalEmail`) siguiendo las reglas de un cliente de correo real: tablas (no
flex/grid), CSS inline, botón en una `<td>` (Outlook), preheader oculto y disclaimer siempre
presente — usado también por los correos de auth (verificación, reset). Tres correos de pedido,
cada uno con su propia `Idempotency-Key` hacia Resend: pago recibido (dispara cuando el pedido
transiciona a `paid`, cubre webhook/reconciliador/`already_captured`), ficha OXXO (solo la
llamada que gana el claim del `PaymentIntent` la envía) y reembolso confirmado (solo con el
reembolso **total** — un parcial no envía correo). Todo texto que escribe la clienta
(`shippingAddress.fullName`) se escapa antes de interpolarse.

## Suscripciones — cimientos (Milestone 1.7.1)

Caja recurrente curada: `SubscriptionPlan` (precio fijo mensual + cupo `maxActiveSeats`),
`SubscriptionAccount` (un documento por usuaria, para siempre — re-suscribirse reusa el mismo,
nunca crea otro) y `SubscriptionEdition` (contenido curado por ciclo, identificado por
`{planId, cycleYear, cycleMonth}`). **Sin Stripe Billing todavía** — eso es 1.7.2; esta sesión
solo deja modelos, canal de catálogo, CRUD admin y `resolveCapabilities` listos y probados.

**Canal de suscripción en el catálogo.** `Product.channel` (`store` | `subscription`, default
`store`) separa la caja exclusiva del catálogo normal: mismas variantes/SKU/imágenes/`Inventory`,
pero un producto `subscription` no aparece en `GET /products`, no resuelve por slug, y no se puede
comprar suelto ni dentro de un bundle (`cart-resolution.service.ts`, `bundle.service.ts`). El
filtro público usa `channel: { $ne: "subscription" }`, nunca `{ $eq: "store" }`: un producto
creado antes de este milestone no tiene el campo, y exigir `store` explícito lo habría borrado del
catálogo de un día para otro — no hace falta ningún backfill.

**Cupo por plan.** `SubscriptionPlan.seatsTaken` es un contador denormalizado que decide en el
mismo `findOneAndUpdate` que lo incrementa (`subscription-seat.service.ts::claimSeat`), nunca un
`countDocuments` previo — mismo patrón que `Inventory.onHand/reserved`. Pausar una suscripción
libera su lugar (decisión de negocio: mientras está pausada no se cobra nada, así que ese lugar no
debe quedar congelado); reanudar vuelve a reclamarlo y puede responder 409 si el plan ya se llenó
mientras tanto.

**Capacidades derivadas en lectura.** `resolveCapabilities(userId)` (`capabilities.service.ts`)
consulta `SubscriptionAccount` en una sola query — nunca se denormaliza en `User`. `GET /auth/me`
las incluye junto al usuario completo. `requireCapability("subscriber")` se montó por primera vez en
1.7.3 (pausar, deshacer cancelación y cambiar de plan — ver §"Suscripciones — autoservicio").

**Solo tarjeta.** El módulo de suscripciones no acepta OXXO: una ficha OXXO es un pago de un solo
uso, no un método guardable para cobrar cada mes. La tienda normal sigue aceptando OXXO sin
cambios.

Endpoints admin: `/api/v1/admin/subscription-plans` y `/api/v1/admin/subscription-editions`
(CRUD + `POST .../publish` y `POST .../unpublish`). Una edición se publica solo si tiene al menos
un producto, todos de canal `subscription`, activos y con variante activa; publicada, sus
`items`/`planId`/`cycleYear`/`cycleMonth` quedan inmutables. `removeVariant` bloquea el hard
delete de una variante usada por una edición **publicada** (una en `draft` sigue siendo editable
libremente).

## Suscripciones — Stripe Billing (Milestone 1.7.2a)

Cierra el hueco que dejó 1.7.1 (cimientos, cero Stripe): conecta el módulo a Stripe Billing de
punta a punta — alta de la clienta, webhook de renovación/dunning/cancelación, la caja de cada
ciclo con su inventario reservado, y los correos + el barrendero que cierran el milestone. Al
terminar, una clienta puede suscribirse, se le cobra cada mes en una fecha regular, y cada cobro
produce una caja con los productos de la edición apartados a su nombre.

**Precio de plan inmutable, creado con el plan.** `createPlan` sincroniza Product+Price en Stripe
**antes** de insertar el documento local — un plan sin refs es inservible; un Product/Price
huérfano en Stripe por un fallo posterior es inofensivo y reutilizable. El precio **no se edita
nunca**: `PATCH` de un plan no acepta `priceCents`. Cambiar de precio = crear un plan nuevo y
desactivar el viejo (`DELETE /admin/subscription-plans/:id`, `isActive: false` — también el
interruptor de emergencia para cerrar altas de inmediato).

**Ventana de inscripciones manual** (`POST /api/v1/admin/subscriptions/enrollment/{open,close}`,
solo admin): la admin abre y cierra las altas a mano — sustituye a una ventana de gracia. Abrir
toma `durationDays` (default 15) y deriva `enrollmentClosesAt`; `assertWindowClearOfAnchor` rechaza
(409) abrir una ventana que cierre a menos de `SUBSCRIPTION_ANCHOR_GAP_DAYS` (7 días) del próximo
`billingAnchorDay` — única defensa real contra el doble cargo en días consecutivos. La ventana
controla **solo altas nuevas**: las renovaciones siguen cobrándose en el ancla aunque esté cerrada.

**Alta** (`POST /api/v1/subscriptions`, `{planId, termsAccepted}`, `subscribeRateLimiter` 10/15
min): el **cupo se reclama primero, Stripe después** — es el recurso escaso, y reclamarlo primero
garantiza cero `Customer`/`Subscription` huérfanos por plan lleno. `Customer` + `Subscription` con
`payment_behavior: "default_incomplete"`, tarjeta únicamente (nunca OXXO, no es guardable),
`billing_cycle_anchor_config` + `proration_behavior: "none"` + `add_invoice_items` (primera factura
por el precio **completo** del ciclo en curso, no prorrateado). Responde `clientSecret` +
`firstChargeCents` + `currency` + `nextChargeAt` para que el front confirme la tarjeta — ninguna
noción de "activa": eso lo decide solo el webhook. Si Stripe falla **después** de reclamar el cupo,
se compensa (`INCOMPLETE -> CANCELED`, libera el cupo) y se relanza el error original; nada se
cancela en Stripe (con `default_incomplete` la suscripción muere sola en ~23h).

**Webhook — 4 eventos nuevos de Billing** suman a los 7 de pagos (Milestone 1.6.2), **11 en
total**, mismo endpoint (`POST /api/v1/webhooks/stripe`) y misma colección de dedupe
(`PaymentEvent`): `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`,
`customer.subscription.deleted`. `invoice.payment_action_required` **no se suscribe** — con
`default_incomplete` el 3DS del alta lo resuelve el Payment Element en sesión, y en una renovación
off-session el mismo hecho ya llega por `customer.subscription.updated -> past_due`. Alta y
renovación producen el **mismo** evento (`invoice.paid`): la diferencia se deriva del estado de la
cuenta en nuestra base, nunca del evento — la única fuente correcta cuando Stripe entrega fuera de
orden.

**La caja del ciclo**: cada `invoice.paid` crea (o reentrega idempotente de) un `SubscriptionShipment`
con `Inventory.reserved` subido por cada ítem de la edición del ciclo — **reserva al cobrar, salida
al enviar** (la baja de `onHand` ocurre al marcar la caja como enviada, ver 1.7.2b abajo). Un faltante **nunca rechaza nada**: el cobro ya
ocurrió, se reserva lo que sí hay, se sella el incidente y se alerta al admin. Los dos índices
únicos de la caja fallan por razones distintas: `{invoiceId}` duplicado es una reentrega (éxito
idempotente, sin alertar); `{accountId, cycleYear, cycleMonth}` duplicado con un `invoiceId`
distinto es una anomalía de negocio (se sella la alerta una sola vez, se audita, se procesa igual —
nunca se rechaza un cobro que ya ocurrió).

**Correos** (Fase 5, `subscription-email.service.ts`, mismo shell `renderTransactionalEmail` que
Milestone 1.6.3): confirmación a la clienta de **cada cobro exitoso** (`Idempotency-Key` por
`invoiceRef`, dispara junto con la caja del ciclo), dunning a la clienta cuando falla un cobro
(`Idempotency-Key` por `invoiceRef`+intento), y alerta al admin cuando la caja sale con
`editionIncident`/`inventoryIncident` (`ADMIN_ALERT_EMAIL`, opcional incluso en producción — sin
configurar, se degrada a loguear). Los tres son best-effort: nunca bloquean ni revierten el efecto
de negocio que los disparó.

**Barrendero de altas abandonadas** (`jobs/expire-incomplete-subscriptions.ts`, mismo tick de cron
que los demás, `SUBSCRIPTION_INCOMPLETE_EXPIRE_MINUTES` = 30 min): red de seguridad para el caso "el
proceso murió entre reclamar el cupo y compensar" en el endpoint de alta. Filtro
`{status: INCOMPLETE, providerSubscriptionId: {$exists: false}, seatHeldAt: {$lt: umbral}}` — el
`$exists: false` es la guarda crítica: **jamás toca** una cuenta esperando el 3DS de la clienta (esa
sí tiene `providerSubscriptionId`, persistido antes de devolver el `clientSecret`).

**Verificación manual contra Stripe real** (los tipos de la SDK confirman que los parámetros
existen y son combinables, no la semántica de facturación):

```
stripe listen --forward-to localhost:4000/api/v1/webhooks/stripe
stripe trigger invoice.paid
stripe trigger invoice.payment_failed
```

Confirmar que la primera factura de una alta real cobra el precio **completo** del ciclo en curso y
que el siguiente cobro cae exactamente en `billingAnchorDay`.

**Deuda de verificación manual (hardening 1.10):** `startSubscription` (stripe-subscription-provider.ts)
crea la suscripción con `items` **y** `add_invoice_items` a la vez, así que la primera factura trae
dos líneas de tipo distinto (`subscription_item_details` e `invoice_item_details`).
`extractServicePeriod` (stripe-subscription-webhook-translator.ts) elige la línea por
`parent.type === "subscription_item_details"`, nunca por posición — pero el comportamiento REAL de
Stripe para esa primera factura (qué línea trae el período correcto, en qué orden llegan) sigue sin
confirmarse contra el sandbox, porque no hubo `stripe listen`/`stripe trigger` disponible durante la
auditoría de seguridad que encontró este caso. Repetir la verificación de arriba (`stripe trigger
invoice.paid` sobre una alta real) prestando atención a `invoice.lines.data[*].parent.type` y a qué
período trae cada línea, apenas haya sandbox de Stripe a mano.

## Suscripciones — panel de envíos y autoservicio de lectura (Milestone 1.7.2b)

Cierra el ciclo que 1.7.2a dejó a medias: la caja se cobraba y se apartaba inventario, pero no
había forma de **enviarla** ni de que la suscriptora viera nada.

### Máquina de estados del envío (`subscription-shipment-state.ts`)

Módulo puro, tabla como dato, calcado de `subscription-state.ts`. Solo avanza o se corta:

```
pending ──▶ processing ──▶ shipped ──▶ delivered
   │             │
   └─────────────┴──────▶ canceled
```

No hay retroceso `processing -> pending`, y `delivered`/`canceled` son terminales. Hoy todas las
aristas son de `admin`; `system` sigue declarado **sin emisor**: 1.7.3 no cancela cajas por su cuenta
(la clienta ya pagó el ciclo, y cancelar al fin del período o pausar no debe anular una caja pagada).
Si hace falta anular cajas de una baja a mitad del ciclo, es una decisión de negocio pendiente.

**El efecto sobre el inventario se DERIVA** de `STOCK_HELD_STATUSES = [pending, processing]`, nunca
de una segunda tabla a mano (mismo criterio que `seatEffect` deriva de `SEAT_HOLDING_STATUSES`):

| Transición | Efecto | Qué le pasa al stock |
|---|---|---|
| `-> processing` | `none` | sigue apartado |
| `-> shipped` | `commit` | `reserved` y `onHand` bajan en la misma cantidad |
| `-> canceled` | `release` | `reserved` baja, `onHand` intacto |
| `shipped -> delivered` | `none` | el stock ya salió |

### Panel de envíos

- `GET /api/v1/admin/subscription-shipments` — listado paginado. Filtros: `status`, `planId`,
  `cycleYear`/`cycleMonth`, `incident` (las cajas que necesitan atención: falta la edición **o** no
  alcanzó el inventario — dos banderas, una sola pregunta operativa).
- `GET /api/v1/admin/subscription-shipments/:id` — detalle con las líneas reservadas (lo que hay
  que empacar, que puede diferir de la edición si hubo faltante).
- `PATCH /api/v1/admin/subscription-shipments/:id/status` — transición. `carrier` +
  `trackingNumber` son **requeridos condicionalmente** al marcar `shipped` (y prohibidos en
  cualquier otra transición); `carrier` usa el mismo enum cerrado `ShippingCarrier` de la tienda,
  nunca texto libre.

El commit de inventario es el calco de `commitReservationCore` (condición y `$inc` en un solo
`findOneAndUpdate`), pero sobre `reservedItems` inline en vez de un `StockReservation`. Si una línea
no matchea, la transacción **entera** aborta con 409 — jamás un commit a medias. Dos panelistas
marcando "enviado" a la vez producen un WriteConflict: el perdedor reejecuta, relee la caja ya
`shipped` y muere en `assertShipmentTransition` — el stock se descuenta **una sola vez**.

### `GET /api/v1/subscriptions/me`

Lo que la suscriptora ve de su propia suscripción: estado, plan contratado, próximo cobro
(`currentPeriodEnd`), `cancelAtPeriodEnd`, `dunningAttempts` y sus cajas con guía de rastreo.
Nunca expone `providerCustomerId`/`providerSubscriptionId` ni `statusHistory`.

Quien nunca se suscribió recibe **200 con `subscription: null`**, no 404: "todavía no soy
suscriptora" es un estado normal del storefront, no un error. Las cajas se filtran por `userId`
directo — el campo que `SubscriptionShipment` denormaliza justamente para esto.

### Aviso preventivo de edición faltante (`jobs/alert-missing-edition.ts`)

`createCycleShipment` ya tolera que falte la edición al cobrar (crea la caja con `editionIncident` y
alerta), pero para entonces **la clienta ya fue cobrada** por una caja sin contenido definido. Este
job mueve el aviso a antes del cobro: cuando faltan `SUBSCRIPTION_EDITION_ALERT_DAYS` (default 7)
para el ancla y el ciclo no tiene edición publicada, avisa al admin.

Solo mira planes activos **con suscriptoras** (`seatsTaken > 0`) — un plan que nadie compró no va a
cobrar nada, y alertar por él enseñaría a ignorar estos correos. Idempotencia por ciclo vía
`SubscriptionPlan.missingEditionAlertedFor` (`"YYYY-MM"`) con claim **antes** de enviar: el cron
corre cada minuto, así que sin ese sello serían mil correos por semana. Fuera de la ventana de
aviso el job se corta sin tocar la base.

### Hardening incluido (hallazgos diferidos de 1.7.2a)

Cinco correcciones de code review que 1.7.2a había dejado anotadas:

1. `recordPaymentFailure` ahora es **monotónica** (`dunningAttempts: {$lte: attemptCount}`): un
   `payment_failed` viejo entregado fuera de orden ya no baja el contador de dunning.
2. La cancelación apaga `cancelAtPeriodEnd` en la misma transacción — `SubscriptionAccount` tiene
   índice único por `userId` y una re-alta reusa el MISMO documento, así que la bandera heredada
   habría hecho nacer la suscripción nueva marcada para cancelarse.
3. La rama replay del alta **compara el `planId`**: pedir el plan B teniendo un `INCOMPLETE` del
   plan A ya no devuelve el `clientSecret` del plan A en silencio (409).
4. `buildResult()` valida `status === "incomplete"` antes de devolver un `clientSecret` — una
   suscripción que Stripe ya canceló o activó ya no manda a la clienta a confirmar un
   PaymentIntent muerto.
5. `trialing` se traduce igual en el adapter y en el traductor de webhooks (`-> active`). Antes
   faltaba el `case` en el traductor y caía al `default` como `incomplete`, produciendo una
   transición inexistente que el webhook ignoraba en silencio.

El sexto hallazgo (`handleSubscriptionUpdated` sellaba `canceledAt` con la hora del servidor) se
cerró en 1.7.3 — ver §"Suscripciones — autoservicio y catálogo público" abajo.

## Suscripciones — autoservicio y catálogo público (Milestone 1.7.3)

La suscriptora ya puede pausar, reanudar, cancelar, cambiar de plan y actualizar su tarjeta, y el
storefront tiene un catálogo público de planes. Todas las rutas de autoservicio viven bajo
`/api/v1/subscriptions/me/…` (detrás de `protect`) y **responden con la suscripción ya actualizada**
(`{ subscription }`, la misma forma que `GET /me`), así el front tiene una sola forma que pintar.
Sin `STRIPE_SECRET_KEY` cada una responde **503** antes de tocar cupo o estado.

| Ruta | `requireCapability("subscriber")` | Qué hace |
|---|---|---|
| `POST /me/pause` | sí | `ACTIVE → PAUSED`. Libera el cupo. |
| `POST /me/resume` | **no** | `PAUSED → ACTIVE`. Reclama cupo: **409 si el plan se llenó**. |
| `POST /me/cancel` `{ reason? }` | **no** | `ACTIVE`/`PAST_DUE`: programa la cancelación al fin del período. `PAUSED`: cancela de inmediato. |
| `POST /me/undo-cancel` | sí | Quita la cancelación programada mientras el período pagado siga vigente. |
| `POST /me/change-plan` `{ planId }` | sí | Cambio de plan inmediato, sin prorrateo. |
| `POST /me/payment-method/setup-intent` | **no** | 201 con el `clientSecret` para confirmar la tarjeta en sesión. |
| `PUT /me/payment-method` `{ setupIntentId }` | **no** | Fija la tarjeta ya confirmada. |

`requireCapability` se montó por primera vez aquí, y **solo** donde tiene sentido: la capacidad
`subscriber` existe únicamente para `ACTIVE`/`PAST_DUE`, así que las acciones que también deben
aceptar `PAUSED` (reanudar, cancelar, tarjeta) **no** la llevan — una pausada recibiría un 403 justo
en la acción que más necesita. En todas el service valida el estado exacto como segunda defensa.

### Regla de orden Stripe ↔ base

El paso que puede fallar sin poder deshacerse va primero, y toda compensación es un paso que siempre
funciona (soltar un cupo, reenviar a Stripe un valor idempotente), nunca "volver a reclamar un
cupo", que puede dar 409:

- **Pausar**: Stripe primero (`pause_collection: {behavior: "void"}`), luego local. Si lo local falla,
  se compensa con `resumeCollection`.
- **Reanudar**: local primero (reclamar cupo → 409 antes de tocar Stripe), luego Stripe. Si Stripe
  falla **no se vuelve a `PAUSED` a ciegas**: un timeout puede haber ocurrido *después* de que
  Stripe reanudó, y dejar la cuenta local pausada cobraría a la clienta sin generar caja (el
  `invoice.paid` se rechazaría como `paused_account_charged`). Se pregunta a Stripe el estado real:
  si ya reanudó, se trata como éxito; si sigue pausado (o ya cancelado), la compensación vuelve a
  `PAUSED`, que solo *suelta* el cupo; si ni siquiera se puede consultar, la cuenta se queda
  `ACTIVE` (peor es cobrar sin caja) y se audita `PROVIDER_MISMATCH`. Al reanudar se refresca el
  período (mientras estuvo pausada Stripe siguió avanzándolo y los `.updated` se ignoraron).
- **Cancelar / deshacer**: Stripe primero (`cancel_at_period_end`), luego un CAS local. Si dos
  requests idénticos compiten y uno pierde el CAS, **no compensa** (deshacería en Stripe lo que el
  ganador acaba de poner): relee y, si el efecto ya quedó, lo trata como éxito.
- **Cancelar una pausada**: `cancelNow` en Stripe es final — no hay "des-cancelar" con qué
  compensar. Si la escritura local falla, el webhook `.deleted` converge (ver abajo).

Si una compensación **también** falla, no tapa el error original: se loguea y se audita
`SUBSCRIPTION_PROVIDER_MISMATCH` (`metadata.operation`) para que ops reconcilie a mano.

### Pausar

Pausa **indefinida**: solo la clienta reanuda, nunca un job (una reanudación automática con el plan
lleno fallaría sin nadie presente). Usa `pause_collection` con `behavior: "void"`: Stripe sigue
generando las facturas del ciclo pero las anula, así no se acumula deuda. **El `status` de la
suscripción en Stripe sigue siendo `active`** mientras la cobranza está pausada (no es el
`status: "paused"` de un trial sin tarjeta), por eso `SubscriptionUpdatedEvent` lleva
`collectionPaused`.

**No se puede pausar a menos de 48 h del siguiente cobro** (409): Stripe no garantiza detener una
factura que ya se generó justo antes del ancla. Si aun así se cuela un cobro sobre una cuenta
pausada, el webhook lo rechaza como `paused_account_charged` y el admin reembolsa a mano.
Tampoco se puede pausar con `cancelAtPeriodEnd` pendiente, con `PAST_DUE` ni con un cambio de plan
en curso.

**Riesgo aceptado**: pausar justo antes del ancla (la factura se anula) y reanudar después deja la
cuenta `ACTIVE` sin haber pagado ese ciclo. No hay pérdida real (no se genera caja sin
`invoice.paid`) y hoy `subscriber` no desbloquea nada de valor; revisar si algún día se agregan
perks para suscriptoras.

### Cancelar

La clienta **nunca cancela directo** una suscripción activa: marca `cancelAtPeriodEnd` y el webhook
transiciona a `CANCELED` al cerrar el período pagado. `PAST_DUE` también puede programarla (es
justo cuando alguien quiere salirse). El motivo es opcional (`reason`, máximo 300 caracteres, se
guarda en `cancelReason` y **nunca** se devuelve por la API; el `reason` enum que Stripe manda al
cerrar la suscripción —`cancellation_requested`, etc.— **no lo pisa**). Volver a pedir la cancelación de una
cuenta ya programada es idempotente: reenvía a Stripe (repara una divergencia) pero no reescribe ni
audita.

`PAUSED → CANCELED` admite ahora el actor `system`: la pausa ya vive en Stripe, así que una
cancelación hecha desde el Dashboard —o una escritura local que falló después de cancelar en
Stripe— llega como `.deleted` y debe converger; sin esa arista la cuenta quedaba `PAUSED` para
siempre.

**`canceledAt` (deferido de 1.7.2a, cerrado)**: ambos traductores leen `ended_at ?? canceled_at`.
En Stripe, `canceled_at` es la hora de la **solicitud** de cancelación (semanas antes del término
en una cancelación al fin del período); `ended_at` es la real. Antes el traductor de `.deleted`
tomaba la equivocada y el de `.updated` ni la propagaba (el handler sellaba la hora del servidor).
Las cuentas históricas `CANCELED` conservan lo que se escribió entonces (sin backfill).

### Cambiar de plan

Inmediato y **sin prorrateo**: el cupo se mueve al instante (409 si el plan nuevo está lleno), la
caja del ciclo ya pagado no cambia y el siguiente cobro anclado ya usa el precio nuevo
(`proration_behavior: "none"`, `billing_cycle_anchor: "unchanged"`). Solo desde `ACTIVE` sin
cancelación programada; el plan nuevo debe estar activo, tener precio en Stripe, ser distinto y
usar la misma moneda. No pasa por la ventana de inscripciones (esa controla solo altas nuevas).

Los dos cupos y Stripe no caben en una transacción, así que el cambio usa un **marcador**
`SubscriptionAccount.pendingPlanChange { planId, requestedAt }`:

1. Una transacción reclama el cupo del plan NUEVO (sin soltar el viejo) y deja el marcador. Por unos
   instantes la cuenta ocupa **dos** cupos: puede mostrar un "agotado" falso, nunca sobrevender.
2. Se llama a Stripe con una clave de idempotencia derivada del marcador.
3. `finalizePlanChange` confirma (plan nuevo, suelta el viejo); si Stripe falló, `abortPlanChange`
   suelta el nuevo.

**Regla de propiedad**: quien borra el marcador —finalizar, abortar o la re-alta de
`startSubscription`— es dueño de soltar el cupo que corresponda. Todos lo borran con un CAS sobre
`requestedAt`, así que solo uno lo consume y ninguno puede soltar dos veces ni filtrar uno.

**Solo un rechazo definitivo de Stripe (409) aborta.** Cualquier otro error (502: timeout, red) es
*ambiguo* —Stripe pudo aplicar el precio antes de perderse la respuesta—, y abortar entonces
soltaría el cupo nuevo mientras Stripe ya cobra el precio nuevo, sin que nada pudiera repararlo
(todo necesita el marcador). Ahí el marcador se conserva.

Si el proceso muere entre los pasos 1 y 3, o el error fue ambiguo, la recuperación es **un solo
camino**: `jobs/reconcile-pending-plan-changes.ts` (mismo tick del cron, marcadores de más de 5 min)
le pregunta a Stripe qué precio tiene y finaliza o aborta con evidencia
(`SUBSCRIPTION_PLAN_CHANGE_RECONCILED`). Deliberadamente **no** hay atajo por webhook: un
`.updated` no trae orden ni versión, y una reentrega vieja con el precio de un plan anterior
parecería confirmar un cambio que Stripe todavía no aplicó. Mientras el marcador existe, pausar,
cancelar y cambiar de plan dan 409.

Todo `applyStatusTransition` incluye `planId` en su CAS: el efecto de cupo se aplica contra
`account.planId`, y `finalizePlanChange` cambia el plan sin cambiar el estado — sin esa guarda una
transición con un documento viejo soltaría el cupo del plan equivocado.
Un `invoice.paid` tardío del ciclo viejo entregado después de un cambio de plan crearía su caja con
el plan nuevo; la ventana es mínima y queda como riesgo aceptado.

### Tarjeta

Dos pasos. `setup-intent` crea un SetupIntent `off_session`, solo tarjeta, con el `accountId` en la
metadata. `PUT` recibe el `setupIntentId` que el front ya confirmó con Stripe y verifica que **el
intento es de su customer y de su cuenta** — el id lo manda el cliente, nunca se confía en él.
Cualquier discrepancia de dueño es **404** (nunca un 403 que confirme que ese id existe) y se
evalúa antes que el estado del intento. La tarjeta se fija en la suscripción *y* en el customer
(cubre una re-alta futura).

Si la cuenta está `PAST_DUE` con factura pendiente, se reintenta **`dunningInvoiceId`** (la que
está fallando; `latestInvoiceId` es la última *pagada*). El resultado va en `invoiceRetry`:
`not_needed` · `paid` · `already_settled` · `requires_action` · `declined`. Un rechazo o una
autenticación pendiente son desenlaces de negocio, **no** excepciones (200, no 5xx); y si la
factura se paga *entre* la lectura y el cobro (el reintento automático de Stripe), se relee y se
devuelve `already_settled` en vez de un 502. Nunca hay
transición local aquí: quien pasa `PAST_DUE → ACTIVE` y crea la caja es el webhook `invoice.paid`.
Con `requires_action` la clienta completa el pago por el flujo de dunning de Stripe hasta que el
front de M3 maneje la confirmación en sesión.
Rate limit dedicado (10/15 min por usuaria): con una sesión robada este flujo es un canal de
card-testing.

### Webhook: divergencia con Stripe

`.updated` **no sincroniza** `cancelAtPeriodEnd` ni la pausa desde Stripe: no hay clave de orden y
una reentrega vieja (cancelar y deshacer rápido) las voltearía. Los endpoints son los únicos
escritores. El webhook solo **audita** la divergencia (`SUBSCRIPTION_PROVIDER_MISMATCH`,
`metadata.field` = `cancelAtPeriodEnd` | `collectionPaused`), y solo si la cuenta lleva más de 2 min
sin escribirse — para no marcar como divergencia nuestra propia ventana "Stripe primero, local
después". Un cambio hecho a mano en el Dashboard de Stripe queda visible, no se pisa en silencio.

### `GET /me`: campos nuevos

`pausedAt` (solo `PAUSED`), `cancelRequestedAt` (solo con cancelación programada), `canUndoCancel`
(derivado en el servidor: cancelación programada con el período aún vigente) y `planChangePending`.
Sigue sin exponer refs de Stripe, `statusHistory` ni `cancelReason`.

### Catálogo público de planes (sin sesión)

`GET /api/v1/subscription-plans` y `GET /api/v1/subscription-plans/:slug` (router propio: `/subscriptions`
va detrás de `protect`). Solo planes `isActive` **con precio en Stripe** (los que se pueden
contratar), ordenados por `sortOrder`. Devuelve `{ plans, enrollment }` con `enrollment: { open,
closesAt? }` (misma regla que el alta: `closesAt` solo viaja con la ventana abierta). Como en la
disponibilidad de productos, **una señal, nunca el número**: `soldOut` en vez de `seatsTaken`/
`maxActiveSeats`, y ningún id del proveedor. `catalogRateLimiter`, anti-scraping.

### Bajas de suscripción vs. cajas de envío pendientes (decisión cerrada, Milestone 1.10)

Pausar, cancelar (al fin del período o de inmediato vía Stripe) o que una suscripción termine en
`CANCELED`/`INCOMPLETE_EXPIRED` **nunca anula solo por eso** una caja de envío ya generada y
pendiente (`SubscriptionShipment` en `pending`/`processing`/`shipped`) — la clienta ya pagó ese
ciclo. Anularla es una acción manual del admin desde el panel de envíos (`assertShipmentTransition`
en `subscription-shipment-state.ts` sí admite un emisor `system` para esa arista, pero hoy ningún
caller lo dispara — queda declarado por si algún día se decide automatizar, no por descuido).

### Verificación manual pendiente (requiere Stripe real, no automatizable)

Con `stripe listen` / una cuenta de prueba: pausar (la siguiente factura sale `void`), reanudar (el
cobro vuelve al ancla), `cancel_at_period_end` seguido de `.deleted` (`canceledAt` = `ended_at`),
cambio de precio sin prorrateo, y SetupIntent + reintento de factura en `PAST_DUE`. Se suma a la
verificación del cobro anclado ya pendiente desde 1.7.2a.

## Contenido del home (Milestone 1.8)

Singleton `HomeContent` (`_id: "home"`, colección propia — **no** es una clave de Settings: Settings es
configuración de negocio solo para admin, el home es contenido público). Siete secciones:
`announcement`, `hero` (carrusel de hasta 5 slides), `featuredProducts` (≤ 12), `featuredCategories`
(≤ 8), `subscriptionPromo`, `testimonials` (≤ 12) y `benefits` (≤ 6, ícono de un enum fijo). Los
límites viven en `HOME_CONTENT_LIMITS` (`@esencia-glow/shared`). La forma es aditiva: sumar o ajustar
una sección no toca a las demás.

### Escritura: un endpoint por sección, con control optimista

`GET /api/v1/admin/home` devuelve las 7 secciones (las nunca escritas salen con `version: 0`,
`isActive: false`; un GET nunca crea el documento). Cada sección tiene su propio `PUT` — nunca uno que
reemplace el documento entero:

| Ruta (`/api/v1/admin/home/…`) | Sección |
|---|---|
| `PUT /announcement` | barra de anuncio |
| `PUT /hero` | textos, orden y activación de slides |
| `PUT /featured-products` · `PUT /featured-categories` | ids en orden (deben existir) |
| `PUT /subscription-promo` | texto y cta de la promo |
| `PUT /testimonials` · `PUT /benefits` | ítems |
| `PUT\|DELETE /hero/slides/:slideId/images/:slot` (`desktop`\|`mobile`) | imagen de un slide |
| `PUT\|DELETE /subscription-promo/image` | imagen de la promo |

- **`version` obligatoria.** Cada PUT manda la `version` de la sección que el editor leyó (en multipart
  como campo de formulario; en el `DELETE` de imagen como `?version=`). Es un compare-and-swap
  (`home-content-store.ts::writeSection`): si otra persona ya editó esa sección → **409** "recarga",
  nunca un pisado silencioso. Dos ediciones en secciones distintas no se estorban. Cada escritura
  exitosa sube la versión en +1.
- El PUT describe la sección **completa**: un campo opcional ausente se quita. Los ítems con `id`
  conservan su identidad (y en el hero, sus imágenes); sin `id` son nuevos; un `id` desconocido → 400.
- Las **imágenes no viajan en el PUT de contenido**: se conservan por `_id` de slide. Subir una imagen
  hace pre-chequeo de versión/slide (409/404) **antes** de tocar Cloudinary, y si el CAS pierde después
  de subir se destruye lo subido. Las imágenes reemplazadas o de slides quitados se borran en
  Cloudinary best-effort (pueden quedar huérfanas si falla, se loguea).
- `href`/`ctaHref`: solo ruta interna (`/tienda`, nunca `//host`) o `https://`.
- **Auditoría:** una entrada `home_section_updated` por escritura, con `metadata.section`,
  `version` y `change: "content" | "image"` (más `slot` en imágenes del hero y conteos). Un 409 no deja
  entrada. Los 4 PATCH de Settings ahora también llevan `metadata.section`.

### Lectura pública (`GET /api/v1/home`, sin sesión, con `catalogRateLimiter`)

Filtra **al servir**, nunca al guardar (el documento conserva todo): omite secciones inactivas o que
quedan vacías, ítems/slides inactivos, slides sin imagen `desktop`, productos que no pasan
`buildPublicProductMatch` (borrador, archivado, canal suscripción) y categorías inactivas. Respeta el
orden guardado; los productos salen como `PublicProduct` completo (categoría y badge resueltas). No
expone `version`, `isActive`, `updatedAt` ni `publicId`. Sin documento responde `{}`.

## Envíos — guías y rastreo (Milestone 1.9a)

El cliente elige y paga la tarifa de envío en el checkout (cotizada en vivo); la **guía** se compra
DESPUÉS de que el webhook de pago confirma, nunca antes. **1.9a** construye todo lo que no toca la
red de Skydropx, contra un adapter *stub*; **1.9b** (con credenciales y sandbox) suma el adapter HTTP
real, el webhook de tracking con firma y el `SKYDROPX_*` del entorno. Sin credenciales, en producción
el resolver devuelve `undefined` y los endpoints responden **503 "Los envíos no están configurados."**
(el stub nunca corre en producción, ver `selectShippingProvider`).

### Cotización (`POST /api/v1/shipping/quotes`)

Es una llamada a un tercero dentro del checkout: deadline duro de `SHIPPING_QUOTE_TIMEOUT_MS` (8 s,
`runWithDeadline`: señal + temporizador propio, así un adapter que ignore la señal no cuelga el
checkout) y rate limit por usuaria (`shippingQuoteRateLimiter`, 60/15 min). Nunca se persiste una
cotización a medias, así que un total jamás se calcula sin una tarifa real:

| Situación | Respuesta |
|---|---|
| El proveedor tarda más del deadline | **504** "La cotización de envío tardó demasiado, intenta de nuevo." |
| El proveedor rechaza / no está disponible / falla inesperadamente | **502** "No pudimos cotizar el envío en este momento." |
| El proveedor no devuelve ninguna tarifa | **422** "No hay opciones de envío para esta dirección." |
| No hay proveedor configurado (producción) | **503** |

La orden guarda de dónde salió la tarifa en `Order.providerShipping` (proveedor, cotización y tarifa
del proveedor). Vive aparte de `shippingSelection` a propósito: ese objeto sí llega al cliente y los
ids del proveedor jamás deben cruzarle.

### Guía de envío (`Order.label`, `order-label.service.ts`)

Una guía se paga con **créditos prepagados**: comprarla dos veces es gastar dos veces. Por eso hay una
máquina de estados y una sola regla — *nunca se recompra una guía cuyo resultado se desconoce*:

| Estado | Significado |
|---|---|
| `pending` | En cola. Se escribe en la MISMA transacción que `pending → paid` (solo en el resultado `paid`; un `inventory_incident` la retira). |
| `requested` | Un proceso reclamó la compra (CAS); la llamada al proveedor va en vuelo. |
| `processing` | El proveedor la aceptó (ya cobró) pero aún no termina. Solo se CONSULTA (`getLabel`), jamás se recompra. |
| `ready` | Guía y número de rastreo listos. El sistema mueve `paid → processing`. |
| `failed` | Rechazo explícito (seguro de reintentar). Backoff 5 min × 2ⁿ⁻¹, hasta 5 intentos. |
| `needs_review` | Resultado desconocido (timeout a media compra, excepción inesperada, proceso muerto), intentos agotados o falta configuración. **Alerta por correo** a `ADMIN_ALERT_EMAIL` (una vez). |

- **Claim y fencing.** El claim es un CAS (`pending|failed` → `requested`, con `nextAttemptAt` vencido,
  orden `paid|processing` y **sin contracargo abierto**). El resultado se escribe filtrando por
  `requestedAt` + `attempts`: la respuesta tardía de un intento viejo no pisa a uno nuevo. Un ÉXITO
  tardío sí se registra aunque el lease ya se hubiera mandado a revisión (el dinero ya se gastó).
- **Disparo.** Inmediato y *fire-and-forget* desde `settleCapturedPayment` (solo en `paid`; un `await`
  convertiría una falla del proveedor en un 500 del webhook y Stripe reentregaría para siempre) y,
  como respaldo, `jobs/process-shipping-labels.ts` cada minuto: (1) guías vencidas, (2) consulta de las
  `processing` (a las 6 h sin terminar → revisión), (3) `requested` con el lease de 10 min vencido →
  `needs_review`.
- **Reintento manual** `POST /api/v1/admin/orders/:id/label/retry` (202): `needs_review|failed → pending`
  (intentos en 0, se compra) o, si el proveedor YA aceptó la compra (`providerShipmentId`),
  `→ processing` (solo se consulta). **Antes de reintentar confirma en el panel del proveedor que no
  exista ya una guía para el pedido.** El camino manual de "marcar enviado" con guía propia sigue
  intacto; el job excluye órdenes `shipped`.
- **Dirección de origen**: `PATCH /api/v1/admin/settings/shipping` `{ origin: {…} }` (reemplaza la
  dirección completa; la auditoría guarda solo `{section, field}`, sin PII). Sin ella, la guía va
  directo a `needs_review` con un motivo claro.
- **Sin proveedor configurado** la guía se queda `pending` sin consumir intentos; el job la retoma en
  cuanto haya proveedor.

### Rastreo (`Order.tracking` + `ShipmentTrackingEvent`)

`recordTrackingEvent` guarda cada evento del proveedor en una bitácora (índice único
`{provider, providerEventId}` = dedupe) y avanza el estado agregado. Estados:
`label_created < picked_up < in_transit < out_for_delivery < delivered`, más `exception` (lateral) y
`returned`; `delivered` y `returned` son terminales. **El estado solo avanza** (los proveedores
entregan eventos duplicados y fuera de orden): la regla vive en una tabla única
(`shipment-tracking-state.ts`) de la que salen la función pura y el filtro atómico de Mongo.

Efectos sobre la orden, como actor `system` (el admin conserva su camino manual):
`picked_up | in_transit | out_for_delivery` → `shipped` (sella `Order.shipment` desde la etiqueta) y
`delivered` → `delivered` (pasando por `shipped` si hacía falta). `label_created`, `exception` y
`returned` no mueven la orden. **Con un contracargo abierto el sistema no despacha**: el rastreo se
registra, la orden no se mueve y queda auditado (`tracking_transition_skipped_dispute`).

- `GET /api/v1/orders/:id/tracking` (clienta, anti-IDOR: un pedido ajeno es 404) y
  `GET /api/v1/admin/orders/:id/tracking` (con `provider`/`providerEventId`). Hasta 200 eventos,
  ordenados por `occurredAt`.
- En 1.9a nadie llama a `recordTrackingEvent` en producción: en 1.9b lo alimenta el webhook de
  tracking firmado de Skydropx.

### Pendiente para 1.9b (requiere sandbox)

Adapter HTTP de Skydropx (OAuth con caché de token de 2 h, throttle de ~2 req/s, polling de la
cotización hasta `is_completed`, compra de guía, verificar si soporta idempotencia por
`Idempotency-Key`), webhook `POST /api/v1/webhooks/skydropx` con verificación de firma (la doc pública
no la describe: pedirla a soporte) y dedupe, variables `SKYDROPX_*` en `config/env.ts`, cancelación de
la guía al reembolsar, envíos de más de 20 kg (multi-paquete) y guías para cajas de suscripción
(hoy `SubscriptionAccount` no guarda dirección).

## Idempotencia del checkout (Milestone 1.5)

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

## Cron (Milestone 1.4 + 1.5 + 1.6.1 + 1.7.2a + 1.7.2b + 1.7.3 + 1.9a)

Un solo `node-cron` corre cada minuto (`jobs/index.ts`, nunca montado en `buildApp()`): libera
reservas de stock vencidas, cierra pedidos `pending` vencidos (Stripe-first, ver arriba),
reconcilia pagos pendientes sin webhook, refresca `Bundle.stockCache` y libera cuentas de
suscripción `INCOMPLETE` abandonadas (ver arriba, §"Suscripciones — Stripe Billing") y avisa al
admin cuando falta publicar la edición del ciclo que está por cobrarse (1.7.2b) y resuelve los
cambios de plan que quedaron a medias (1.7.3, ver §"Cambiar de plan") y procesa las guías de envío
pendientes, en proceso o a medias (1.9a, ver §"Envíos"). Todas las
operaciones son idempotentes por documento — seguro correr varias instancias de la API sin lock
distribuido.

## Runbook de deploy (Milestone 1.10 — Railway + Atlas + Cloudflare)

Stack de hosting decidido con Manuel: **Railway** (API, una sola instancia), **MongoDB Atlas**
(BD) y **Cloudflare** (dominio + Pages para el front, cuando exista). CI en GitHub Actions
(`.github/workflows/ci.yml`) corre `pnpm verify` + `pnpm audit --prod --audit-level high` en cada
PR y push a `main`; Railway espera a que ese workflow esté en verde antes de desplegar.

### 1. MongoDB Atlas

- Cluster con **replica set** (obligatorio: el inventario, los pagos y las suscripciones usan
  `session.withTransaction`, y las transacciones de Mongo solo corren sobre un replica set).
- TLS activado (Atlas lo trae por default, no desactivarlo).
- Usuario de base de datos dedicado con el mínimo privilegio que la API necesita (lectura/escritura
  sobre `esencia_glow`, nada de admin del cluster) — nunca el usuario owner del proyecto de Atlas.
- IP access list: mientras Railway no tenga IP saliente fija, usar `0.0.0.0/0` documentado como
  deuda (el usuario de BD dedicado + TLS + el propio `MONGODB_URI` con contraseña siguen siendo la
  barrera real) — o el peering/Private Endpoint de Atlas si el plan de Railway lo soporta.
- `MONGODB_URI` final: `mongodb+srv://<usuario>:<password-url-encoded>@<cluster>.xxxxx.mongodb.net/esencia_glow?retryWrites=true&w=majority`
  — el nombre de la base va explícito en el path, antes del `?` (ver tabla de variables arriba).

### 2. Railway — configuración del servicio (dashboard, sin `railway.json`)

La configuración vive en el dashboard de Railway, no en un archivo del repo: la doc oficial de
Railway deprecó "Config as Code" (`railway.json`/`railway.toml`) a favor de su nueva
Infrastructure as Code (`.railway/railway.ts`), con los archivos viejos dejando de funcionar el
**2026-12-01**. Su sucesor no documenta (a la fecha de este runbook) cómo apuntar a un Dockerfile
ni la política de reinicio, así que escribirlo habría sido inventar API. Configurar a mano:

| Ajuste | Valor |
|---|---|
| Builder | Dockerfile (el `Dockerfile` de la raíz del repo) |
| Pre-deploy command | `node dist/scripts/sync-indexes.js` — la imagen final no trae pnpm instalado (solo runtime de Node), así que se invoca el script compilado directo, no vía `pnpm run` — ver §5 |
| Healthcheck path | `/api/v1/health/ready` |
| Restart policy | On failure |
| Réplicas | **1** (ver la nota de Redis más abajo antes de subir este número) |
| Variables | Todas las de `apps/api/.env.production.example`, con valores reales — nunca copiar ese archivo tal cual, es solo la lista de nombres |

### 3. Cloudflare — dominio y DNS

- Dominio comprado en Cloudflare. `www.<dominio>` → Cloudflare Pages (front, Milestone 2/3 — no
  existe todavía). `api.<dominio>` → CNAME al dominio de Railway, en modo **DNS-only (nube gris,
  no naranja)** — con el proxy de Cloudflare activado ahí se suma un salto extra delante de la API
  que `TRUST_PROXY_HOPS` no esperaría, y el rate limiting por IP se rompe.
- **Por qué front y API van en el mismo dominio registrable:** la cookie de sesión es
  `SameSite=strict` (`BACKEND_SECURITY_GUIDELINES.md`). Con el front en `*.pages.dev` y la API en
  `*.up.railway.app` (dominios registrables distintos) el navegador nunca manda la cookie en las
  peticiones del front a la API y el login no funciona. `www.<dominio>` + `api.<dominio>` comparten
  dominio registrable (`<dominio>`) y sí funcionan.
- `CLIENT_URL=https://www.<dominio>` en las variables de Railway.

### 4. Confirmar `TRUST_PROXY_HOPS` tras el primer deploy

`.env.production.example` propone `2` (Railway + Cloudflare DNS-only en `api.` sigue sumando su
propio salto interno) pero es una estimación, no un valor verificado. Después del primer deploy:

1. Hacer una petición real a `api.<dominio>`.
2. Mirar en los logs (`pino-http`, Milestone 1.10) el `req.headers["x-forwarded-for"]` recibido y
   compararlo contra la IP real del cliente.
3. Si `req.ip` (ya con `trust proxy` aplicado) no coincide con la IP real, ajustar
   `TRUST_PROXY_HOPS` y redesplegar — un valor de más deja los rate limiters por IP falsificables
   (cualquiera puede inyectar un `X-Forwarded-For` falso en el salto que sobra).

### 5. Orden del deploy

1. CI (`pnpm verify` + `pnpm audit --prod --audit-level high`) en verde sobre el commit a desplegar.
2. Railway construye la imagen (`Dockerfile` de la raíz).
3. **Pre-deploy**: corre el script de índices (`apps/api/src/scripts/sync-indexes.ts`,
   `createIndexes()` por modelo — solo agrega, nunca borra; `diffIndexes()` reporta sobrantes, que
   se borran solo con `--prune` explícito, corrido a mano y nunca en el pre-deploy automático).
   Exit code ≠ 0 aborta el deploy antes de cortar tráfico al código nuevo.
4. Railway espera a que `/api/v1/health/ready` responda 200 (Mongo conectado y respondiendo al
   `ping`) antes de mandarle tráfico a la instancia nueva.
5. Instancia vieja se apaga: `SIGTERM` → `server.closeIdleConnections()` → cierre ordenado del
   cron y la conexión a Mongo (`apps/api/src/server.ts`, con guarda contra una segunda señal).

### 6. Primer admin en producción

`pnpm seed:admin:prod` (`node dist/scripts/seed-admin.js --force`) — se niega a tocar un admin ya
existente salvo que además se pase `--overwrite-existing` (Milestone 1.10: evita que correrlo dos
veces por hábito resetee en silencio la contraseña del admin real). Pasos:

1. En Railway, setear temporalmente `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`.
2. `railway ssh` hacia el servicio ya desplegado y, dentro, `node dist/scripts/seed-admin.js
   --force` (una sola vez). Se usa `ssh` y no `railway run`: este último corre el comando en la
   máquina local con las variables de Railway inyectadas, no dentro del contenedor — exigiría tener
   `dist/` compilado localmente y en el mismo estado que la imagen desplegada. `pnpm
   seed:admin:prod` (`apps/api/package.json`) documenta el mismo comando para cuando sí se corre
   desde dentro del contenedor (o un entorno con ese `dist/`).
3. **Borrar esas dos variables** de Railway — no deben quedar configuradas de forma permanente.
4. Iniciar sesión con ese admin y cambiar la contraseña desde el panel.

### 7. Integraciones externas

- **Webhook de Stripe en modo live**: apuntar a `https://api.<dominio>/api/v1/webhooks/stripe`,
  copiar el signing secret nuevo (live, no test) a `STRIPE_WEBHOOK_SECRET` en Railway.
- **Resend**: dominio de envío verificado por DNS (registros que Resend pide, en Cloudflare) antes
  de fijar `RESEND_FROM_EMAIL` a una dirección de ese dominio — el modo sandbox de Resend no sirve
  para producción.
- **Skydropx (Milestone 1.9b)**: sigue bloqueado (faltan datos fiscales de Manuel). Las rutas de
  cotización/guía que lo necesitan responden `503` en producción hasta que se resuelva — no es un
  bug, es el estado esperado mientras 1.9b no esté implementado.
- **Sentry**: `SENTRY_DSN` se lee en `config/env.ts` pero el paquete de Sentry **no está
  instalado** — dejar la variable vacía. Instalarlo es trabajo de otra sesión, no de este runbook.

### 8. Verificación post-deploy

- IP real del cliente en el primer log de una petición real (confirma que `TRUST_PROXY_HOPS` quedó
  bien, ver §4).
- Login end-to-end desde el front contra `api.<dominio>` (confirma cookie `SameSite=strict` +
  dominio compartido).
- `stripe trigger checkout.session.completed` (o el evento que corresponda) contra el webhook live,
  confirmar que llega y se procesa.
- `GET /api/v1/health/ready` → 200.

### 9. Rollback

Redesplegar la imagen anterior desde el historial de deploys de Railway. El script de índices solo
agrega — un rollback de código nunca deja índices "de más" que rompan el código viejo. Si el
rollback es por un índice roto (`--prune` corrido por error, o una migración de datos mala), ese
caso es manual: no hay automatización de rollback de datos en este milestone.

### 10. Antes de escalar a más de 1 instancia

El rate limiting (`express-rate-limit`) es **en memoria** y el cron (`node-cron`) corre **en
proceso** — con 2+ réplicas cada una tendría su propio bucket de rate limit (el límite real se
multiplica por el número de instancias) y el cron correría duplicado en cada una. Antes de subir
`numReplicas` en Railway hace falta mover ambos a algo compartido entre instancias — típicamente
Redis (rate limit distribuido + lock del cron, o un scheduler externo). Fuera de alcance de 1.10.

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
