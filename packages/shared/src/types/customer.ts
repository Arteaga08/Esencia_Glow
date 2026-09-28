import type { SubscriptionStatus } from "../enums/subscription-status.js";
import type { PublicShippingAddress } from "./shipping.js";

/**
 * Métricas de compra de un cliente (Milestone 2.6), calculadas al leer sobre
 * `Order` — nunca denormalizadas en `User`. Solo cuentan pedidos que de
 * verdad se compraron (ver `PURCHASED_ORDER_STATUSES` en
 * `customer-admin.service.ts`): `pending` (carrito abandonado), `cancelled`
 * y `refunded` quedan fuera.
 */
interface AdminCustomerStats {
  orderCount: number;
  spentCents: number;
  lastOrderAt: string | null;
}

/**
 * Fila del listado `GET /admin/customers` (§Milestone 2.6). Proyección
 * mínima de `User` — nunca `password`, `twoFactor.*`, `sessionVersion` ni
 * `passwordChangedAt` — más las métricas agregadas y el estatus de
 * suscripción (si tiene cuenta).
 */
interface AdminCustomerListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  stats: AdminCustomerStats;
  subscriptionStatus: SubscriptionStatus | null;
}

/**
 * Suscripción de un cliente vista desde el panel admin (`GET
 * /admin/customers/:id`). Deliberadamente sin `providerSubscriptionId`,
 * `providerCustomerId`, `latestInvoiceId`, `dunningInvoiceId`,
 * `cancelReason` ni `statusHistory` — mismo criterio que `MySubscription`
 * en `subscription.ts`: son detalles de Stripe o rastro interno de
 * auditoría, no algo que este listado necesite mostrar.
 */
interface AdminCustomerSubscriptionPlan {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
}

interface AdminCustomerSubscription {
  id: string;
  status: SubscriptionStatus;
  plan: AdminCustomerSubscriptionPlan | null;
  startedAt?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  pausedAt?: string;
  canceledAt?: string;
}

/**
 * Detalle de `GET /admin/customers/:id`: la fila del listado más la
 * dirección del pedido comprado más reciente (decisión de Manuel en el
 * brainstorming — nunca todas sus direcciones) y su suscripción completa si
 * tiene una.
 */
interface AdminCustomerDetail extends AdminCustomerListItem {
  lastShippingAddress: PublicShippingAddress | null;
  subscription: AdminCustomerSubscription | null;
}

export type {
  AdminCustomerStats,
  AdminCustomerListItem,
  AdminCustomerSubscriptionPlan,
  AdminCustomerSubscription,
  AdminCustomerDetail,
};
