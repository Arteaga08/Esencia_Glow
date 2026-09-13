import type { UserCapabilities } from "@esencia-glow/shared";
import { SubscriptionAccount } from "../models/subscription-account.model.js";
import { isEntitled } from "./subscription-state.js";

/**
 * Capacidades del usuario, derivadas en lectura (Milestone 1.7.1) — nunca
 * denormalizadas en `User` (ver el comentario de cabecera de
 * packages/shared/src/enums/user-role.ts). Exactamente UNA query, sobre el
 * índice único `{userId}` de `SubscriptionAccount` — la lectura más barata
 * posible. Sin resolver `planId` a nombre: evita un segundo round-trip: el
 * consumidor ya tiene el catálogo de planes.
 */
async function resolveCapabilities(userId: string): Promise<UserCapabilities> {
  const account = await SubscriptionAccount.findOne({ userId })
    .select("status planId cancelAtPeriodEnd currentPeriodEnd")
    .lean();

  if (!account || !isEntitled(account.status)) {
    return { subscriber: null };
  }

  return {
    subscriber: {
      status: account.status,
      planId: account.planId.toString(),
      cancelAtPeriodEnd: account.cancelAtPeriodEnd,
      ...(account.currentPeriodEnd ? { currentPeriodEnd: account.currentPeriodEnd.toISOString() } : {}),
    },
  };
}

export { resolveCapabilities };
