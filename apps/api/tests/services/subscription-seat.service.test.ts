import { describe, expect, it } from "vitest";
import { SubscriptionStatus } from "@esencia-glow/shared";
import { SubscriptionAccount } from "../../src/models/subscription-account.model.js";
import { applyStatusTransition, startSubscription } from "../../src/services/subscription-seat.service.js";
import { seedPlanWithStripeRefs } from "../helpers/subscription-fixtures.js";

/**
 * Reactivación `CANCELED -> INCOMPLETE` (hallazgo de code review de la Fase 4
 * de 1.7.2a): una cuenta cancelada con `providerSubscriptionId` de la
 * suscripción VIEJA de Stripe no puede quedar `INCOMPLETE` con ese ref
 * todavía puesto — un webhook tardío de esa suscripción cancelada la
 * encontraría por ese ref (`locateAccountForEvent`) y podría mover el estado
 * antes de que el endpoint de alta persista el ref de la suscripción NUEVA.
 */
describe("services/subscription-seat — reactivación CANCELED -> INCOMPLETE", () => {
  it("limpia el providerSubscriptionId VIEJO, conserva el providerCustomerId", async () => {
    const plan = await seedPlanWithStripeRefs({ maxActiveSeats: 5 });
    const account = await startSubscription({
      userId: "aaaaaaaaaaaaaaaaaaaaaaaa",
      planId: plan._id.toString(),
    });

    await SubscriptionAccount.updateOne(
      { _id: account._id },
      { $set: { providerCustomerId: "cus_old", providerSubscriptionId: "sub_old" } },
    );
    const withOldRefs = await SubscriptionAccount.findById(account._id);
    await applyStatusTransition(withOldRefs!, SubscriptionStatus.CANCELED, "system");

    const reactivated = await startSubscription({
      userId: "aaaaaaaaaaaaaaaaaaaaaaaa",
      planId: plan._id.toString(),
    });

    expect(reactivated.status).toBe(SubscriptionStatus.INCOMPLETE);
    expect(reactivated.providerSubscriptionId).toBeUndefined();
    expect(reactivated.providerCustomerId).toBe("cus_old");
  });
});
