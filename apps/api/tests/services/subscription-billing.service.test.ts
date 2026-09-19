import { describe, expect, it } from "vitest";
import { SubscriptionStatus } from "@esencia-glow/shared";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { SubscriptionAccount } from "../../src/models/subscription-account.model.js";
import { SubscriptionPlan } from "../../src/models/subscription-plan.model.js";
import { applyStatusTransition } from "../../src/services/subscription-seat.service.js";
import {
  applySystemStatus,
  recordPaidInvoice,
  recordPaymentFailure,
} from "../../src/services/subscription-billing.service.js";
import { seedPlanWithStripeRefs, seedSubscribedAccount } from "../helpers/subscription-fixtures.js";

/**
 * `subscription-billing.service.ts` (Fase 3 de 1.7.2a, §D del plan):
 * `applySystemStatus` tolera la carrera legítima `invoice.paid` /
 * `customer.subscription.updated` — nunca lanza para un `noop` esperado, y
 * el único 409 real posible (el CAS) se resuelve releyendo, nunca
 * propagando. `recordPaidInvoice`/`recordPaymentFailure` son idempotentes
 * por construcción.
 */

describe("services/subscription-billing — applySystemStatus", () => {
  it("aplica la transición y audita SUBSCRIPTION_PAST_DUE", async () => {
    const plan = await seedPlanWithStripeRefs();
    const account = await seedSubscribedAccount({ planId: plan._id.toString(), status: SubscriptionStatus.ACTIVE });

    const result = await applySystemStatus(account, SubscriptionStatus.PAST_DUE);

    expect(result.outcome).toBe("applied");
    expect(result.account.status).toBe(SubscriptionStatus.PAST_DUE);
    const audit = await AuditLog.findOne({ action: "subscription_past_due", targetId: account._id });
    expect(audit).not.toBeNull();
  });

  it("mismo estado actual -> noop directo, sin lanzar, sin auditar", async () => {
    const plan = await seedPlanWithStripeRefs();
    const account = await seedSubscribedAccount({ planId: plan._id.toString(), status: SubscriptionStatus.ACTIVE });

    const result = await applySystemStatus(account, SubscriptionStatus.ACTIVE);

    expect(result.outcome).toBe("noop");
    expect(result.account.status).toBe(SubscriptionStatus.ACTIVE);
  });

  it("ACTIVE -> PAUSED (no es una transición de system) -> noop sin lanzar, sin auditar", async () => {
    const plan = await seedPlanWithStripeRefs();
    const account = await seedSubscribedAccount({ planId: plan._id.toString(), status: SubscriptionStatus.ACTIVE });

    const result = await applySystemStatus(account, SubscriptionStatus.PAUSED);

    expect(result.outcome).toBe("noop");
    expect(result.account.status).toBe(SubscriptionStatus.ACTIVE);
    expect(await AuditLog.countDocuments({ action: "subscription_paused" })).toBe(0);
  });

  it("CAS perdido con un documento viejo (otro evento ya la movió al MISMO destino) -> noop, no lanza", async () => {
    const plan = await seedPlanWithStripeRefs();
    const account = await seedSubscribedAccount({ planId: plan._id.toString(), status: SubscriptionStatus.ACTIVE });
    const stale = account;

    await applyStatusTransition(account, SubscriptionStatus.PAST_DUE, "system");

    const result = await applySystemStatus(stale, SubscriptionStatus.PAST_DUE);
    expect(result.outcome).toBe("noop");
    expect(result.account.status).toBe(SubscriptionStatus.PAST_DUE);
  });

  it("CAS perdido y la cuenta ya no puede transicionar a `to` (se canceló mientras tanto) -> noop, no lanza", async () => {
    const plan = await seedPlanWithStripeRefs();
    const account = await seedSubscribedAccount({ planId: plan._id.toString(), status: SubscriptionStatus.ACTIVE });
    const stale = account;

    await applyStatusTransition(account, SubscriptionStatus.CANCELED, "system");

    const result = await applySystemStatus(stale, SubscriptionStatus.PAST_DUE);
    expect(result.outcome).toBe("noop");
    expect(result.account.status).toBe(SubscriptionStatus.CANCELED);
  });

  it("CANCELED libera el cupo una sola vez: una segunda llamada sobre la cuenta ya cancelada es noop", async () => {
    const plan = await seedPlanWithStripeRefs({ maxActiveSeats: 1 });
    const account = await seedSubscribedAccount({ planId: plan._id.toString(), status: SubscriptionStatus.ACTIVE });

    const first = await applySystemStatus(account, SubscriptionStatus.CANCELED);
    expect(first.outcome).toBe("applied");
    expect((await SubscriptionPlan.findById(plan._id))?.seatsTaken).toBe(0);
    const auditsAfterFirst = await AuditLog.countDocuments({ action: "subscription_canceled", targetId: account._id });
    expect(auditsAfterFirst).toBe(1);

    const second = await applySystemStatus(first.account, SubscriptionStatus.CANCELED);
    expect(second.outcome).toBe("noop");
    expect((await SubscriptionPlan.findById(plan._id))?.seatsTaken).toBe(0);
    expect(await AuditLog.countDocuments({ action: "subscription_canceled", targetId: account._id })).toBe(1);
  });

  it("acepta campos hermanos (canceledAt/cancelReason) y los escribe en la MISMA operación que la transición", async () => {
    const plan = await seedPlanWithStripeRefs();
    const account = await seedSubscribedAccount({ planId: plan._id.toString(), status: SubscriptionStatus.ACTIVE });
    const canceledAt = new Date("2026-09-20T00:00:00Z");

    const result = await applySystemStatus(account, SubscriptionStatus.CANCELED, {
      canceledAt,
      cancelReason: "payment_failed",
    });

    expect(result.outcome).toBe("applied");
    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.canceledAt?.getTime()).toBe(canceledAt.getTime());
    expect(reloaded?.cancelReason).toBe("payment_failed");
  });
});

describe("services/subscription-billing — recordPaidInvoice", () => {
  it("sella latestInvoiceId, período, resetea dunning/pastDueSince, y startedAt solo la primera vez", async () => {
    const plan = await seedPlanWithStripeRefs();
    const account = await seedSubscribedAccount({ planId: plan._id.toString(), status: SubscriptionStatus.PAST_DUE });
    await SubscriptionAccount.updateOne(
      { _id: account._id },
      { $set: { dunningAttempts: 3, pastDueSince: new Date() } },
    );

    const start = new Date("2026-09-01T15:00:00Z");
    const end = new Date("2026-10-01T15:00:00Z");
    await recordPaidInvoice(account._id.toString(), { invoiceRef: "in_1", periodStart: start, periodEnd: end });

    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.latestInvoiceId).toBe("in_1");
    expect(reloaded?.currentPeriodStart?.getTime()).toBe(start.getTime());
    expect(reloaded?.currentPeriodEnd?.getTime()).toBe(end.getTime());
    expect(reloaded?.dunningAttempts).toBe(0);
    expect(reloaded?.pastDueSince).toBeUndefined();
    expect(reloaded?.startedAt).toBeInstanceOf(Date);
    const firstStartedAt = reloaded!.startedAt!.getTime();

    await recordPaidInvoice(account._id.toString(), {
      invoiceRef: "in_2",
      periodStart: end,
      periodEnd: new Date("2026-11-01T15:00:00Z"),
    });
    const reloadedAgain = await SubscriptionAccount.findById(account._id);
    expect(reloadedAgain?.startedAt?.getTime()).toBe(firstStartedAt);
  });

  it("un período VIEJO entregado fuera de orden no pisa uno más nuevo", async () => {
    const plan = await seedPlanWithStripeRefs();
    const account = await seedSubscribedAccount({ planId: plan._id.toString(), status: SubscriptionStatus.ACTIVE });

    const newEnd = new Date("2026-11-01T00:00:00Z");
    await recordPaidInvoice(account._id.toString(), {
      invoiceRef: "in_new",
      periodStart: new Date("2026-10-01T00:00:00Z"),
      periodEnd: newEnd,
    });

    await recordPaidInvoice(account._id.toString(), {
      invoiceRef: "in_old",
      periodStart: new Date("2026-09-01T00:00:00Z"),
      periodEnd: new Date("2026-10-01T00:00:00Z"),
    });

    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.currentPeriodEnd?.getTime()).toBe(newEnd.getTime());
    expect(reloaded?.latestInvoiceId).toBe("in_new");
  });
});

describe("services/subscription-billing — recordPaymentFailure", () => {
  it("dunningAttempts se fija al valor de la factura (idempotente), pastDueSince solo la primera vez", async () => {
    const plan = await seedPlanWithStripeRefs();
    const account = await seedSubscribedAccount({ planId: plan._id.toString(), status: SubscriptionStatus.ACTIVE });

    await recordPaymentFailure(account._id.toString(), 1, "in_misma");
    const first = await SubscriptionAccount.findById(account._id);
    expect(first?.dunningAttempts).toBe(1);
    expect(first?.pastDueSince).toBeInstanceOf(Date);
    const firstPastDueSince = first!.pastDueSince!.getTime();

    await recordPaymentFailure(account._id.toString(), 1, "in_misma");
    const replayed = await SubscriptionAccount.findById(account._id);
    expect(replayed?.dunningAttempts).toBe(1);
    expect(replayed?.pastDueSince?.getTime()).toBe(firstPastDueSince);

    await recordPaymentFailure(account._id.toString(), 2, "in_misma");
    const second = await SubscriptionAccount.findById(account._id);
    expect(second?.dunningAttempts).toBe(2);
    expect(second?.pastDueSince?.getTime()).toBe(firstPastDueSince);
  });
});

describe("services/subscription-billing — recordPaymentFailure entre facturas", () => {
  it("una factura NUEVA reinicia el contador aunque la anterior hubiera llegado más alto", async () => {
    // `attempt_count` de Stripe es por FACTURA: reinicia en 1 cada ciclo. Una
    // guarda monotónica sobre el número suelto descartaría los primeros
    // intentos del ciclo siguiente tras una factura que murió en el 3.º.
    const plan = await seedPlanWithStripeRefs();
    const account = await seedSubscribedAccount({ planId: plan._id.toString(), status: SubscriptionStatus.ACTIVE });

    await recordPaymentFailure(account._id.toString(), 3, "in_ciclo_1");
    await recordPaymentFailure(account._id.toString(), 1, "in_ciclo_2");

    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.dunningAttempts).toBe(1);
  });
});

describe("services/subscription-billing — recordPaymentFailure fuera de orden", () => {
  it("no baja dunningAttempts cuando llega un intento VIEJO después de uno más nuevo", async () => {
    const plan = await seedPlanWithStripeRefs();
    const account = await seedSubscribedAccount({ planId: plan._id.toString(), status: SubscriptionStatus.ACTIVE });

    await recordPaymentFailure(account._id.toString(), 3, "in_misma");
    // Stripe no garantiza el orden de entrega: el `payment_failed` del
    // intento 1 puede llegar DESPUÉS del intento 3.
    await recordPaymentFailure(account._id.toString(), 1, "in_misma");

    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.dunningAttempts).toBe(3);
  });
});
