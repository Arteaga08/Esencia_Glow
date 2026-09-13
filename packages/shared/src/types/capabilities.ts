import type { SubscriptionStatus } from "../enums/subscription-status.js";

/**
 * Capacidades del usuario, derivadas en lectura vía `resolveCapabilities`
 * (apps/api/src/services/capabilities.service.ts) — nunca denormalizadas en
 * `User` (ver el comentario de cabecera de user-role.ts). Un objeto con una
 * clave por capacidad, no un `string[]`: sumar una capacidad futura
 * (afiliado, etc.) no rompe este contrato ni el de quien lo consume.
 */
interface SubscriberCapability {
  status: SubscriptionStatus;
  planId: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd?: string;
}

interface UserCapabilities {
  subscriber: SubscriberCapability | null;
}

export type { SubscriberCapability, UserCapabilities };
