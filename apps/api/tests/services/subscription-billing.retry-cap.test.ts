import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionStatus } from "@esencia-glow/shared";
import { SubscriptionAccount } from "../../src/models/subscription-account.model.js";
import { AppError } from "../../src/utils/app-error.js";
import type * as SubscriptionSeatService from "../../src/services/subscription-seat.service.js";

/**
 * Test AISLADO en su propio archivo (nunca junto a subscription-billing.
 * service.test.ts): `vi.mock` de `subscription-seat.service.js` intercepta
 * TODAS las importaciones de ese módulo en el mismo grafo, incluida
 * `applyStatusTransition` que usan las fixtures compartidas — mezclarlo con
 * otras suites rompería `seedSubscribedAccount`.
 */

const applyStatusTransitionMock = vi.fn();

vi.mock("../../src/services/subscription-seat.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof SubscriptionSeatService>();
  return {
    ...actual,
    applyStatusTransition: (...args: unknown[]) => applyStatusTransitionMock(...args),
  };
});

const { applySystemStatus } = await import("../../src/services/subscription-billing.service.js");

describe("services/subscription-billing — applySystemStatus, tope del reintento por CAS perdido", () => {
  beforeEach(() => {
    applyStatusTransitionMock.mockReset();
  });

  it("tras perder el CAS repetidamente (un patrón insólito), deja de reintentar sin límite y relanza el 409", async () => {
    const account = await SubscriptionAccount.create({
      userId: new Types.ObjectId(),
      planId: new Types.ObjectId(),
      status: SubscriptionStatus.ACTIVE,
      cancelAtPeriodEnd: false,
      dunningAttempts: 0,
    });

    // La cuenta en la base nunca se mueve (el mock nunca escribe): cada
    // reintento vuelve a ver una transición legítima y vuelve a fallar,
    // simulando un CAS que siempre pierde.
    applyStatusTransitionMock.mockRejectedValue(
      new AppError("La suscripción cambió de estado, vuelve a intentarlo.", 409),
    );

    await expect(applySystemStatus(account, SubscriptionStatus.PAST_DUE)).rejects.toMatchObject({
      statusCode: 409,
    });

    // Nunca sin límite: se detiene en MAX_STATUS_RETRY_ATTEMPTS intentos.
    expect(applyStatusTransitionMock).toHaveBeenCalledTimes(3);
  });
});
