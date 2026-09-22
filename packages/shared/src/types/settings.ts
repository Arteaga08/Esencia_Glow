import type { PublicShippingAddress } from "./shipping.js";

/**
 * Settings singleton, diseñado por secciones: cada milestone que necesita un
 * umbral de negocio configurable le suma su propia clave (1.8 sumará
 * contenido del home) sin tocar las demás.
 */
interface InventorySettings {
  lowStockThreshold: number;
  reservationTtlMinutes: number;
  sweepBatchSize: number;
}

/**
 * Sección de negocio del checkout (Milestone 1.5). `taxRateBps` en puntos
 * base enteros (1600 = 16%) — nunca un float, para que la aritmética de
 * centavos de `order-totals.ts` sea exacta. `freeShippingThresholdCents: 0`
 * significa desactivado, explícitamente (con `>=` cualquier carrito
 * calificaría). `shippingQuoteTtlMinutes` debe superar
 * `inventory.reservationTtlMinutes` o el cliente que vuelve de pagar se topa
 * con una cotización de envío ya vencida mientras su reserva sigue viva.
 */
interface CommerceSettings {
  taxRateBps: number;
  freeShippingThresholdCents: number;
  shippingQuoteTtlMinutes: number;
}

/**
 * Sección de negocio de pagos (Milestone 1.6). `oxxoVoucherDays` es el
 * plazo que se le da a la ficha OXXO (Stripe acepta 1-7); mientras esté
 * vigente el stock queda apartado (`reserved`), nunca descontado.
 * `oxxoConfirmationGraceHours` es la gracia DESPUÉS de que la ficha vence:
 * Stripe confirma un pago OXXO hasta el siguiente día hábil, así que soltar
 * el stock justo al vencer dejaría sin producto a quien pagó a último
 * momento (ver order-payment.md / plan de 1.6, decisión 1a).
 */
interface PaymentSettings {
  oxxoVoucherDays: number;
  oxxoConfirmationGraceHours: number;
}

/**
 * Sección de negocio de suscripciones (Milestone 1.7.2a). `billingAnchorDay`
 * regulariza la fecha de cobro de TODAS las suscriptoras (1-28: 29/30/31 es
 * indefinido en febrero) — decisión de Manuel para que la admin controle en
 * un solo lote cuántas cajas arma cada ciclo, en vez de un aniversario por
 * clienta. `enrollmentOpen`/`enrollmentOpenedAt`/`enrollmentClosesAt` los
 * escribe la acción de abrir/cerrar inscripciones (nunca este PATCH
 * genérico, ver subscription-enrollment.ts): solo `billingAnchorDay` es un
 * ajuste libre. Fechas como ISO string, no `Date` — mismo criterio que
 * `SubscriberCapability.currentPeriodEnd` en types/capabilities.ts.
 */
interface SubscriptionSettings {
  billingAnchorDay: number;
  enrollmentOpen: boolean;
  enrollmentOpenedAt?: string;
  enrollmentClosesAt?: string;
}

/**
 * Sección de envíos (Milestone 1.9). `origin` es la dirección desde la que se
 * despachan los pedidos (Skydropx la exige para generar la guía). Opcional:
 * mientras no esté capturada, las guías no se pueden generar y quedan en
 * revisión con un aviso explícito al admin.
 */
interface ShippingSettings {
  origin?: PublicShippingAddress;
}

interface AppSettings {
  inventory: InventorySettings;
  commerce: CommerceSettings;
  payments: PaymentSettings;
  subscriptions: SubscriptionSettings;
  shipping: ShippingSettings;
}

export type {
  InventorySettings,
  CommerceSettings,
  PaymentSettings,
  SubscriptionSettings,
  ShippingSettings,
  AppSettings,
};
