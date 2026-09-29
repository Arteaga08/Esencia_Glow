import { SubscriptionStatus } from "@esencia-glow/shared";
import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { SubscriptionAccount } from "../../src/models/subscription-account.model.js";
import { SubscriptionShipment } from "../../src/models/subscription-shipment.model.js";
import { createPrepaidCycleShipments } from "../../src/jobs/create-prepaid-cycle-shipments.js";
import { startSubscription, applyStatusTransition } from "../../src/services/subscription-seat.service.js";
import {
  seedPlanWithStripeRefs,
  seedPublishedEdition,
  seedSubscriptionVariantWithStock,
} from "../helpers/subscription-fixtures.js";

/**
 * `createPrepaidCycleShipments` (Milestone 2.7b) — las cajas mensuales
 * intermedias de una cuenta ANUAL, cuyo webhook de Stripe solo dispara
 * `invoice.paid` una vez al año (al alta y en cada renovación). Ancla de la
 * cuenta = el día del mes de su propio `currentPeriodEnd`.
 */

describe("jobs/createPrepaidCycleShipments", () => {
  async function seedAccount(
    planId: string,
    userId: string,
    fields: {
      billingInterval?: "month" | "year";
      status?: SubscriptionStatus;
      currentPeriodStart?: Date;
      currentPeriodEnd?: Date;
      cancelAtPeriodEnd?: boolean;
      latestInvoiceId?: string;
    } = {},
  ) {
    let account = await startSubscription({
      userId,
      planId,
      ...(fields.billingInterval ? { billingInterval: fields.billingInterval } : {}),
    });
    if (fields.status && fields.status !== SubscriptionStatus.INCOMPLETE) {
      account = await applyStatusTransition(account, SubscriptionStatus.ACTIVE, "system");
      if (fields.status !== SubscriptionStatus.ACTIVE) {
        account = await applyStatusTransition(account, fields.status, "system");
      }
    }
    await SubscriptionAccount.updateOne(
      { _id: account._id },
      {
        $set: {
          ...(fields.currentPeriodStart ? { currentPeriodStart: fields.currentPeriodStart } : {}),
          ...(fields.currentPeriodEnd ? { currentPeriodEnd: fields.currentPeriodEnd } : {}),
          ...(fields.cancelAtPeriodEnd !== undefined ? { cancelAtPeriodEnd: fields.cancelAtPeriodEnd } : {}),
          ...(fields.latestInvoiceId ? { latestInvoiceId: fields.latestInvoiceId } : {}),
        },
      },
    );
    return (await SubscriptionAccount.findById(account._id))!;
  }

  // Alta 2026-09-15, renovación 2027-09-15 -> ancla día 15. Ciclo intermedio
  // de prueba: octubre 2026.
  const PERIOD_START = new Date("2026-09-15T18:00:00Z");
  const PERIOD_END = new Date("2027-09-15T18:00:00Z");
  const ON_ANCHOR_DAY = new Date("2026-10-20T12:00:00Z"); // día 20, después del ancla 15
  const BEFORE_ANCHOR_DAY = new Date("2026-10-10T12:00:00Z"); // día 10, antes del ancla 15

  it("crea la caja del ciclo intermedio en/después del día-ancla de la cuenta", async () => {
    const plan = await seedPlanWithStripeRefs({ annualPriceCents: 599000 });
    const account = await seedAccount(plan._id.toString(), new Types.ObjectId().toString(), {
      billingInterval: "year",
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: PERIOD_START,
      currentPeriodEnd: PERIOD_END,
      latestInvoiceId: "in_annual_paid",
    });

    const summary = await createPrepaidCycleShipments(ON_ANCHOR_DAY);

    expect(summary.created).toBe(1);
    const shipment = await SubscriptionShipment.findOne({ accountId: account._id });
    expect(shipment).not.toBeNull();
    expect(shipment?.cycleYear).toBe(2026);
    expect(shipment?.cycleMonth).toBe(10);
    expect(shipment?.prepaidInvoiceId).toBe("in_annual_paid");
    expect(shipment?.invoiceId).toBeUndefined();
  });

  it("NO crea nada antes del día-ancla del mes en curso", async () => {
    const plan = await seedPlanWithStripeRefs({ annualPriceCents: 599000 });
    await seedAccount(plan._id.toString(), new Types.ObjectId().toString(), {
      billingInterval: "year",
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: PERIOD_START,
      currentPeriodEnd: PERIOD_END,
      latestInvoiceId: "in_annual_paid",
    });

    const summary = await createPrepaidCycleShipments(BEFORE_ANCHOR_DAY);

    expect(summary.created).toBe(0);
    expect(await SubscriptionShipment.countDocuments({})).toBe(0);
  });

  it("excluye el ciclo del ALTA y el de la RENOVACIÓN (ya los crea el webhook)", async () => {
    const plan = await seedPlanWithStripeRefs({ annualPriceCents: 599000 });
    await seedAccount(plan._id.toString(), new Types.ObjectId().toString(), {
      billingInterval: "year",
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: PERIOD_START,
      currentPeriodEnd: PERIOD_END,
      latestInvoiceId: "in_annual_paid",
    });

    const onAltaCycle = new Date("2026-09-20T12:00:00Z"); // mismo ciclo del alta (sep 2026)
    const onRenewalCycle = new Date("2027-09-20T12:00:00Z"); // mismo ciclo de la renovación (sep 2027)

    const altaSummary = await createPrepaidCycleShipments(onAltaCycle);
    const renewalSummary = await createPrepaidCycleShipments(onRenewalCycle);

    expect(altaSummary.created).toBe(0);
    expect(renewalSummary.created).toBe(0);
    expect(await SubscriptionShipment.countDocuments({})).toBe(0);
  });

  it("salta cuentas mensuales, sin billingInterval, PAST_DUE y CANCELED", async () => {
    const plan = await seedPlanWithStripeRefs({ annualPriceCents: 599000 });
    await seedAccount(plan._id.toString(), new Types.ObjectId().toString(), {
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: PERIOD_START,
      currentPeriodEnd: PERIOD_END,
    }); // sin billingInterval: mensual implícito
    await seedAccount(plan._id.toString(), new Types.ObjectId().toString(), {
      billingInterval: "year",
      status: SubscriptionStatus.PAST_DUE,
      currentPeriodStart: PERIOD_START,
      currentPeriodEnd: PERIOD_END,
    });
    await seedAccount(plan._id.toString(), new Types.ObjectId().toString(), {
      billingInterval: "year",
      status: SubscriptionStatus.CANCELED,
      currentPeriodStart: PERIOD_START,
      currentPeriodEnd: PERIOD_END,
    });

    const summary = await createPrepaidCycleShipments(ON_ANCHOR_DAY);

    expect(summary.created).toBe(0);
    expect(await SubscriptionShipment.countDocuments({})).toBe(0);
  });

  it("SÍ incluye una cuenta ACTIVE con cancelAtPeriodEnd (ya pagó las cajas restantes)", async () => {
    const plan = await seedPlanWithStripeRefs({ annualPriceCents: 599000 });
    const account = await seedAccount(plan._id.toString(), new Types.ObjectId().toString(), {
      billingInterval: "year",
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: PERIOD_START,
      currentPeriodEnd: PERIOD_END,
      cancelAtPeriodEnd: true,
      latestInvoiceId: "in_annual_paid",
    });

    const summary = await createPrepaidCycleShipments(ON_ANCHOR_DAY);

    expect(summary.created).toBe(1);
    expect(await SubscriptionShipment.countDocuments({ accountId: account._id })).toBe(1);
  });

  it("es idempotente entre ticks: un segundo tick del mismo mes no duplica la caja", async () => {
    const plan = await seedPlanWithStripeRefs({ annualPriceCents: 599000 });
    await seedAccount(plan._id.toString(), new Types.ObjectId().toString(), {
      billingInterval: "year",
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: PERIOD_START,
      currentPeriodEnd: PERIOD_END,
      latestInvoiceId: "in_annual_paid",
    });

    await createPrepaidCycleShipments(ON_ANCHOR_DAY);
    const secondSummary = await createPrepaidCycleShipments(ON_ANCHOR_DAY);

    expect(secondSummary.created).toBe(0);
    expect(await SubscriptionShipment.countDocuments({})).toBe(1);
  });

  it("respeta batchSize", async () => {
    const plan = await seedPlanWithStripeRefs({ annualPriceCents: 599000, maxActiveSeats: 10 });
    await seedAccount(plan._id.toString(), new Types.ObjectId().toString(), {
      billingInterval: "year",
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: PERIOD_START,
      currentPeriodEnd: PERIOD_END,
      latestInvoiceId: "in_annual_paid",
    });
    await seedAccount(plan._id.toString(), new Types.ObjectId().toString(), {
      billingInterval: "year",
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: PERIOD_START,
      currentPeriodEnd: PERIOD_END,
      latestInvoiceId: "in_annual_paid",
    });

    const summary = await createPrepaidCycleShipments(ON_ANCHOR_DAY, 1);

    expect(summary.scanned).toBe(1);
    expect(summary.created).toBe(1);
  });

  it("edición faltante para el ciclo: crea la caja de todos modos, con editionIncident", async () => {
    const plan = await seedPlanWithStripeRefs({ annualPriceCents: 599000 });
    const account = await seedAccount(plan._id.toString(), new Types.ObjectId().toString(), {
      billingInterval: "year",
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: PERIOD_START,
      currentPeriodEnd: PERIOD_END,
      latestInvoiceId: "in_annual_paid",
    });

    const summary = await createPrepaidCycleShipments(ON_ANCHOR_DAY);

    expect(summary.created).toBe(1);
    const shipment = await SubscriptionShipment.findOne({ accountId: account._id });
    expect(shipment?.editionIncident).toBe(true);
  });

  it("ancla en día 31: SÍ crea la caja de febrero (mes corto), acotando el ancla a los días del mes (hallazgo de code review)", async () => {
    // Alta el 31 de enero: ancla = día 31. Sin acotar al mes en curso, ningún
    // día de febrero (máx. 28) cumple `today >= 31` — la caja de febrero
    // nunca se crearía, para siempre.
    const plan = await seedPlanWithStripeRefs({ annualPriceCents: 599000 });
    const start = new Date("2026-01-31T18:00:00Z");
    const end = new Date("2027-01-31T18:00:00Z");
    const account = await seedAccount(plan._id.toString(), new Types.ObjectId().toString(), {
      billingInterval: "year",
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: start,
      currentPeriodEnd: end,
      latestInvoiceId: "in_annual_paid",
    });

    // Último día de febrero 2026 (no bisiesto): el ancla acotada a 28 debe
    // disparar aquí, no esperar un día 31 que febrero no tiene.
    const lastDayOfFebruary = new Date("2026-02-28T12:00:00Z");
    const summary = await createPrepaidCycleShipments(lastDayOfFebruary);

    expect(summary.created).toBe(1);
    const shipment = await SubscriptionShipment.findOne({ accountId: account._id });
    expect(shipment?.cycleYear).toBe(2026);
    expect(shipment?.cycleMonth).toBe(2);
  });

  it("con edición publicada, reserva el inventario de la edición del ciclo", async () => {
    const plan = await seedPlanWithStripeRefs({ annualPriceCents: 599000 });
    const { product, variantId } = await seedSubscriptionVariantWithStock({ onHand: 10 });
    await seedPublishedEdition({
      planId: plan._id.toString(),
      cycleYear: 2026,
      cycleMonth: 10,
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 2 }],
    });
    const account = await seedAccount(plan._id.toString(), new Types.ObjectId().toString(), {
      billingInterval: "year",
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: PERIOD_START,
      currentPeriodEnd: PERIOD_END,
      latestInvoiceId: "in_annual_paid",
    });

    await createPrepaidCycleShipments(ON_ANCHOR_DAY);

    const shipment = await SubscriptionShipment.findOne({ accountId: account._id });
    expect(shipment?.editionIncident).toBe(false);
    expect(shipment?.reservedItems).toHaveLength(1);
  });
});
