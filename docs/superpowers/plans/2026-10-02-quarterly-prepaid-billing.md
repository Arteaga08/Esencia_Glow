# Cobro trimestral prepagado (3.1.7b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`) syntax. **No hay pasos de commit**: por regla del proyecto solo Manuel commitea; al final se muestra `git status`/`git diff --stat`.

**Goal:** añadir el periodo trimestral prepagado (`billingInterval: "quarter"`) calcando el patrón anual de 2.7b, con paridad en el panel admin, y dejar la base de desarrollo con UNA caja de 3 periodos visible en el catálogo público.

**Architecture:** un módulo puro `subscription-billing-interval.ts` centraliza qué es "prepagado" y cuántos meses cubre; las guardas, jobs, correos y DTOs lo consumen en vez de comparar `=== "year"`. El Price trimestral es un tercer Price de Stripe (`interval:"month", interval_count:3`) sobre el MISMO Product. Spec aprobado: `~/.claude/plans/pasted-content-id-a475-milestone-3-1-7b-jaunty-acorn.md`.

**Tech Stack:** Node/Express/Mongoose/Joi, Vitest + MongoMemoryReplSet, Stripe SDK 22.6.2, Next 16 (apps/web), pnpm monorepo.

**Comandos base** (desde `apps/api`): `pnpm vitest run <ruta>`; `pnpm typecheck`; `pnpm lint`.
Comentarios en español, nombres en inglés, exports al final.

---

## Task 1: Módulo puro de intervalos prepagados

**Files:** Create `apps/api/src/services/subscription-billing-interval.ts`; Test `apps/api/tests/services/subscription-billing-interval.test.ts`.

- [ ] Test (falla: módulo no existe):
```ts
import { describe, expect, it } from "vitest";
import { isPrepaidInterval, PREPAID_INTERVAL_MONTHS, normalizeBillingInterval } from "../../src/services/subscription-billing-interval.js";

describe("subscription-billing-interval", () => {
  it("quarter y year son prepagados; month y ausente no", () => {
    expect(isPrepaidInterval("quarter")).toBe(true);
    expect(isPrepaidInterval("year")).toBe(true);
    expect(isPrepaidInterval("month")).toBe(false);
    expect(isPrepaidInterval(undefined)).toBe(false);
  });
  it("meses cubiertos", () => {
    expect(PREPAID_INTERVAL_MONTHS).toEqual({ quarter: 3, year: 12 });
  });
  it("normalize: ausente se lee como month", () => {
    expect(normalizeBillingInterval(undefined)).toBe("month");
    expect(normalizeBillingInterval("quarter")).toBe("quarter");
  });
});
```
- [ ] Implementación:
```ts
type BillingInterval = "month" | "quarter" | "year";
type PrepaidInterval = "quarter" | "year";

/** Meses que cubre un cobro prepagado (Milestone 3.1.7b). */
const PREPAID_INTERVAL_MONTHS: Record<PrepaidInterval, number> = { quarter: 3, year: 12 };

function isPrepaidInterval(interval: BillingInterval | undefined): interval is PrepaidInterval {
  return interval === "quarter" || interval === "year";
}

/** Cuentas anteriores a 2.7b no traen el campo: se leen como mensuales. */
function normalizeBillingInterval(interval: BillingInterval | undefined): BillingInterval {
  return interval ?? "month";
}

export { PREPAID_INTERVAL_MONTHS, isPrepaidInterval, normalizeBillingInterval };
export type { BillingInterval, PrepaidInterval };
```
- [ ] Correr el test → PASS.

## Task 2: Modelos (plan, cuenta, factura)

**Files:** Modify `models/subscription-plan.model.ts`, `subscription-account.model.ts`, `subscription-invoice.model.ts`; Tests en `tests/models/subscription-{plan,account,invoice}.model.test.ts`.

- [ ] Tests: plan acepta `quarterlyPriceCents` entero y `providerQuarterlyPriceId` único (duplicado → error E11000); cuenta e invoice aceptan `billingInterval: "quarter"` y rechazan `"week"`.
- [ ] Plan: añadir a `SubscriptionPlanAttrs` y schema `quarterlyPriceCents?: number` (`min:0`, `integerValidator`) y `providerQuarterlyPriceId?: string` (trim) con JSDoc "inmutable, igual que `annualPriceCents`"; índice único parcial `{providerQuarterlyPriceId:1}` con `partialFilterExpression: {providerQuarterlyPriceId:{$type:"string"}}`.
- [ ] Cuenta/invoice: tipo `billingInterval?: BillingInterval` y enum `["month","quarter","year"]`.
- [ ] Correr tests de modelos → PASS.

## Task 3: Proveedor Stripe — Price trimestral

**Files:** Modify `services/subscription-provider.ts` (`CreatePlanProductInput.quarterlyPriceCents?`, `PlanProductRefs.quarterlyPriceRef?`), `services/stripe-subscription-provider.ts`, `tests/helpers/fake-subscription-provider.ts`; Test `tests/services/stripe-subscription-provider.test.ts`.

- [ ] Test (calco del test anual, línea ~93): con `quarterlyPriceCents: 146700` el segundo/tercer `prices.create` recibe `recurring: { interval: "month", interval_count: 3 }`, `unit_amount: 146700`, key `plan:caja-esencia:price-quarter`, y el resultado incluye `quarterlyPriceRef`. Otro: con ambos precios se crean 4 llamadas… (producto + 3 prices) en orden mensual, trimestral, anual. Otro: sin `quarterlyPriceCents` no se crea Price trimestral.
- [ ] Implementar en `createPlanProduct` tras el Price mensual:
```ts
let quarterlyPriceRef: string | undefined;
if (input.quarterlyPriceCents !== undefined) {
  const quarterlyPrice = await client.prices.create(
    {
      product: product.id,
      currency: input.currency,
      unit_amount: input.quarterlyPriceCents,
      recurring: { interval: "month", interval_count: 3 },
      metadata: { planSlug: input.planSlug },
    },
    { idempotencyKey: `${input.idempotencyKey}:price-quarter` },
  );
  quarterlyPriceRef = quarterlyPrice.id;
}
```
y devolver `...(quarterlyPriceRef ? { quarterlyPriceRef } : {})`. Actualizar el JSDoc de la función.
- [ ] Fake: si `input.quarterlyPriceCents !== undefined` → `refs.quarterlyPriceRef = \`price_fake_quarter_${counter}\``.
- [ ] Tests → PASS.

## Task 4: Ancla prepagada generalizada

**Files:** Modify `services/subscription-enrollment.ts` (+ `subscription-start.service.ts` en Task 5); Test `tests/services/subscription-enrollment.test.ts`.

- [ ] Tests nuevos (ANCHOR_DAY=1 como en el archivo): `resolvePrepaidAnchorMonth(new Date("2026-10-02T18:00:00Z"), 1, "quarter")` → `1` (enero); alta en noviembre → `2`; alta en diciembre → `3`; `"year"` mantiene el mes del alta (10); día `<=` ancla → 409 con mensaje que menciona "trimestral" para quarter y "anual" para year. Mantener `resolveAnnualAnchor` exportado como wrapper `(now, anchorDay, tz)` → `resolvePrepaidAnchorMonth(now, anchorDay, "year", tz)` para no romper los tests existentes.
- [ ] Implementar:
```ts
function resolvePrepaidAnchorMonth(now: Date, anchorDay: number, interval: PrepaidInterval, timeZone: string = DEFAULT_TIME_ZONE): number {
  const { month, day } = extractCalendarDate(now, timeZone);
  if (day <= anchorDay) {
    throw new AppError(
      `No puedes suscribirte al plan ${INTERVAL_LABEL[interval]} antes del día ${anchorDay} del mes: el próximo cobro caería en unos días. Inténtalo de nuevo después de esa fecha.`,
      409,
    );
  }
  return ((month - 1 + PREPAID_INTERVAL_MONTHS[interval]) % 12) + 1;
}
```
con `INTERVAL_LABEL = { quarter: "trimestral", year: "anual" }`. (Para 12: `(month-1+12)%12+1 = month`.)
- [ ] Tests → PASS (los anuales viejos siguen verdes).

## Task 5: Alta, validators y plan admin

**Files:** Modify `validators/subscription.validator.ts` (`valid("month","quarter","year")`), `validators/subscription-plan.validator.ts` (`quarterlyPriceCents` solo en create, mismos mensajes que annual), `services/subscription-plan.service.ts` (`quarterlyPriceCents` en input, pasa al proveedor, guarda `quarterlyPriceCents` y `providerQuarterlyPriceId`), `services/subscription-start.service.ts`, `services/subscription-seat.service.ts` (tipo de `billingInterval`), `controllers/subscription.controller.ts` (sin cambio si pasa el body tal cual); Tests: `tests/services/subscription-start.service.test.ts`, `tests/routes/subscription.routes.test.ts`, `tests/routes/admin-subscription-plan.routes.test.ts`, helper `seedPlanWithStripeRefs` (`tests/helpers/subscription-fixtures.ts`: aceptar `quarterlyPriceCents` y poblar `providerQuarterlyPriceId`).

- [ ] Tests: alta `quarter` con plan trimestral → `startSubscription` del proveedor recibe `priceRef` trimestral y `billingAnchorMonth` correcto (reloj fijo con `vi.setSystemTime`); plan sin precio trimestral → 409 "Este plan no admite cobro trimestral."; replay mensual→trimestral sobre cuenta INCOMPLETE → 409 de intervalo distinto; POST admin acepta `quarterlyPriceCents`, PATCH lo rechaza (400/strip según el comportamiento actual de `annualPriceCents` — copiar la aserción existente).
- [ ] Servicio de alta: 
```ts
const billingInterval: "quarter" | "year" | undefined =
  input.billingInterval === "quarter" || input.billingInterval === "year" ? input.billingInterval : undefined;
// ...
if (billingInterval === "quarter" && !plan.providerQuarterlyPriceId) throw new AppError("Este plan no admite cobro trimestral.", 409);
if (billingInterval === "year" && !plan.providerAnnualPriceId) throw new AppError("Este plan no admite cobro anual.", 409);
const billingAnchorMonth = billingInterval ? resolvePrepaidAnchorMonth(new Date(), billingAnchorDay, billingInterval) : undefined;
// priceRef:
const priceRef = billingInterval === "quarter" ? plan.providerQuarterlyPriceId! : billingInterval === "year" ? plan.providerAnnualPriceId! : plan.providerPriceId;
```
y actualizar `StartSubscriptionInput.billingInterval` a `BillingInterval`.
- [ ] Tests → PASS.

## Task 6: DTOs y shared

**Files:** Modify `services/subscription-dto.ts` (`quarterlyPriceCents?`), `services/subscription-plan-public.service.ts` (select + DTO, jamás `providerQuarterlyPriceId`), `services/subscription-account-admin-dto.ts` y `subscription-me.service.ts` (`normalizeBillingInterval`), `packages/shared/src/types/subscription-plan-public.ts` (`quarterlyPriceCents?`), `packages/shared/src/types/subscription.ts` (`"month"|"quarter"|"year"`); Tests: `tests/routes/subscription-plan-public.routes.test.ts`, `admin-subscription-account.routes.test.ts`, `subscription-me.routes.test.ts`.

- [ ] Tests: catálogo público expone `quarterlyPriceCents` y NO `providerQuarterlyPriceId`; `/subscriptions/me` y admin de cuentas devuelven `"quarter"` para cuentas trimestrales.
- [ ] Implementar y correr `pnpm --filter @esencia-glow/shared build` si el paquete se compila antes de consumirlo.
- [ ] Tests → PASS.

## Task 7: Job de cajas prepagadas

**Files:** Modify `jobs/create-prepaid-cycle-shipments.ts`; Test `tests/jobs/create-prepaid-cycle-shipments.test.ts`.

- [ ] Tests: cuenta `quarter` ACTIVE con periodo 2026-10-01→2026-01-01, "hoy" = 2026-11-02 crea la caja de noviembre; 2026-12-02 la de diciembre; 2026-10-02 (extremo inicial) y 2027-01-02 (extremo final) NO crean; cuenta `month` no se escanea.
- [ ] Cambiar el filtro a `billingInterval: { $in: ["quarter", "year"] }`, fallback `` `${account.billingInterval}:${account._id}` `` (select añade `billingInterval`), actualizar JSDoc/log ("ciclo prepagado").
- [ ] Tests → PASS.

## Task 8: Pausa/cambio de plan, correos y job de aviso

**Files:** Modify `services/subscription-self-service.service.ts`, `services/subscription-plan-change.service.ts`, `services/subscription-email.service.ts`, `services/subscription-webhook-handlers.ts` (tipo), `jobs/send-annual-renewal-reminders.ts` → renombrar a `jobs/send-renewal-reminders.ts` (función `sendRenewalReminders`, constante `RENEWAL_REMINDER_DAYS = { quarter: 7, year: 30 }`), `jobs/index.ts`; Tests: `subscription-self-service.service.test.ts`, `subscription-plan-change.service.test.ts`, `subscription-email.service.test.ts`, renombrar `tests/jobs/send-annual-renewal-reminders.test.ts` → `send-renewal-reminders.test.ts`.

- [ ] Tests: pausar/cambiar plan con cuenta `quarter` → 409 con "trimestre"; correo de confirmación `quarter` contiene "trimestre completo"; recordatorio trimestral: periodEnd en 6 días → envía, en 8 días → no; anual: 29 días → envía, 31 → no; asunto "Tu suscripción trimestral está por renovarse"; claim atómico sigue evitando doble envío.
- [ ] Guardas: `if (isPrepaidInterval(account.billingInterval)) throw new AppError(\`Las suscripciones ${label} no se pueden pausar: ya están cobradas por todo el ${period}.\`, 409)` con `label/period` = trimestrales/trimestre o anuales/año.
- [ ] Job: una consulta por intervalo (`$or` con ventanas distintas) y el correo recibe `billingInterval`:
```ts
const candidates = await SubscriptionAccount.find({
  status: SubscriptionStatus.ACTIVE,
  cancelAtPeriodEnd: false,
  $or: (Object.keys(RENEWAL_REMINDER_DAYS) as PrepaidInterval[]).map((interval) => ({
    billingInterval: interval,
    currentPeriodEnd: { $gt: now, $lte: new Date(now.getTime() + RENEWAL_REMINDER_DAYS[interval] * DAY_MS) },
  })),
}).select("_id userId currentPeriodEnd billingInterval").limit(batchSize).lean();
```
- [ ] `grep -rn "send-annual-renewal-reminders\|sendAnnualRenewal" apps/api` para actualizar todas las referencias (index de jobs, tests, docs).
- [ ] Tests → PASS.

## Task 9: Panel admin (apps/web)

**Files:** Modify `apps/web/src/lib/types/admin-subscription.ts`, `components/subscription-plans/{plan-form-value.ts,billing-mode-selector.tsx,plan-price-fields.tsx,plan-pricing.ts,plan-price-summary.tsx}`, `app/admin/(panel)/subscriptions/plans/page.tsx`, `components/overview/overview-sales-charts.tsx`; tests co-ubicados si existen (`ls apps/web` para el runner).

- [ ] Leer cada archivo completo antes de editar. `BillingMode` pasa de `"monthly"|"monthly_and_annual"` a casillas independientes `offersQuarterly`/`offersAnnual` (el selector se vuelve dos opciones marcables sobre el mensual base); `plan-pricing.ts`: `comparePrepaidToMonthly(priceCents, prepaidCents, months)` (generaliza `compareAnnualToMonthly`, que queda como wrapper con 12); campo "Precio trimestral (MXN)" con placeholder `1467` (regla: placeholders con ejemplo real) y error en línea (`errors.quarterlyPriceCents`); columna "Trimestral" en el listado; payload incluye `quarterlyPriceCents` solo si se marcó.
- [ ] Verificar: `pnpm --filter web typecheck lint build` (con `NEXT_PUBLIC_API_URL` si el build lo pide) y revisar en navegador crear/ver plan.

## Task 10: Script de reset de la base de desarrollo

**Files:** Create `apps/api/src/scripts/reset-subscriptions-dev.ts`; Modify `apps/api/package.json` (`"reset:subscriptions"`); Test: función pura `planResetTargets` si se extrae, o prueba manual dry-run (script de DB; no se mockea Mongo).

- [ ] Antes de escribir, leer `seed-subscriptions-demo.ts` (slugs/skus de los 5 productos) y los modelos `SubscriptionShipment`, `ShipmentTrackingEvent`, `StockReservation`, `Inventory` para conocer las referencias exactas (`shipmentId`/`reservedFor`...).
- [ ] Reglas: aborta si `NODE_ENV !== "development"`; sin `--confirm` solo imprime conteos por colección; con `--confirm` borra `SubscriptionPlan/Edition/Account/Invoice/Shipment`, tracking y reservas ligadas a esos envíos, y los 5 productos `channel:"subscription"` del seed + su `Inventory`. No toca `User`, catálogo `store/both`, `Settings`, `AuditLog`.
- [ ] Ejecutar dry-run, **mostrar conteos a Manuel**, y solo con su visto bueno `pnpm reset:subscriptions -- --confirm`.

## Task 11: Seed nuevo

**Files:** Rewrite `apps/api/src/scripts/seed-subscriptions-demo.ts`.

- [ ] Leer el archivo completo y `seed-customers-demo.ts` (cuentas demo) y `home-content` (campo `kits`: ruta de la imagen de portada) antes de reescribir.
- [ ] Plan único vía `createPlan()` (idempotente por slug; falla con mensaje claro sin `STRIPE_SECRET_KEY`): "Caja Esencia Glow", 49900/146700/574800, descripción y 4 viñetas del fixture `design-preview/subscription/_kit/fixture.ts`. Fotos: descargar la imagen de `HomeContent.kits` con `fetch`, re-subir con `resolveMediaProvider().upload({ buffer, folder: "subscription-plans", contentType })`, guardar en `plan.images`; sin portada → warning y sin fotos.
- [ ] Mantener productos canal `subscription` + inventario, ediciones (mes en curso publicada, siguiente borrador) y cuentas demo (una `month`, una `quarter`, una `year` + estados que el panel filtra), pasando por los servicios reales. Actualizar el JSDoc (ahora sí toca Stripe test).
- [ ] Correr `pnpm seed:subscriptions` dos veces (idempotente) y `curl localhost:<puerto>/subscription-plans` para ver la caja con 3 precios, viñetas y foto.

## Task 12: Verificación, riesgos Stripe y review

- [ ] `pnpm typecheck && pnpm lint && pnpm test` en `apps/api`; typecheck/lint/build de `apps/web` y `packages/shared`; `pnpm audit --prod --audit-level high`. Reportar resultados reales (si hay flakes por carga paralela, re-correr aislados).
- [ ] Prueba manual Stripe test: alta trimestral real (4242…) y comprobar (1) `billing_cycle_anchor_config.month` acepta ancla a ~3 meses con el Price `interval_count:3`; (2) renovación cada 3 meses. Si Stripe rechaza → fallback `billing_cycle_anchor` (timestamp) solo para trimestral, con test.
- [ ] `requesting-code-review` sobre el diff; corregir hallazgos reales.
- [ ] Actualizar memoria (`esencia-glow-3-1-7b.md` + índice) y mostrar `git status`/`git diff --stat` a Manuel. Sin commit.

---

## Self-review (spec ↔ tareas)
Spec: modelo/Stripe → T1-3; alta/anchor → T4-5; DTOs → T6; job cajas → T7; pausa/cambio/correos/aviso 7 días → T8; panel paridad → T9; reset → T10; seed + visibilidad pública + fotos → T11; riesgos Stripe/verify/review → T12. Tipos consistentes: `BillingInterval`, `PrepaidInterval`, `PREPAID_INTERVAL_MONTHS`, `isPrepaidInterval`, `normalizeBillingInterval`, `resolvePrepaidAnchorMonth`, `RENEWAL_REMINDER_DAYS`, `quarterlyPriceCents`/`providerQuarterlyPriceId`/`quarterlyPriceRef` usados igual en todas las tareas.
