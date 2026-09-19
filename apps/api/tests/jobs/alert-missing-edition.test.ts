import { describe, expect, it, beforeEach } from "vitest";
import { SubscriptionAction, SubscriptionStatus } from "@esencia-glow/shared";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { SubscriptionPlan } from "../../src/models/subscription-plan.model.js";
import { alertMissingEdition } from "../../src/jobs/alert-missing-edition.js";
import { __setAdminAlertEmailForTests } from "../../src/services/subscription-email.service.js";
import { __setMailProviderForTests } from "../../src/services/mail-provider.js";
import { buildFakeMailProvider } from "../helpers/fake-mail-provider.js";
import {
  seedPlanWithStripeRefs,
  seedPublishedEdition,
  seedSubscribedAccount,
  seedSubscriptionVariantWithStock,
} from "../helpers/subscription-fixtures.js";

/**
 * Job preventivo de edición faltante (Milestone 1.7.2b, Fase 6): avisa al
 * admin ANTES de que el cobro ocurra, en vez de que la caja nazca con
 * `editionIncident` y la clienta ya esté cobrada.
 *
 * El ancla se fija en 15 y "ahora" en el 10 para que el próximo cobro caiga
 * a 5 días — dentro de la ventana de alerta de 7 y sin depender de qué día
 * corre la suite.
 */

const ANCHOR_DAY = 15;
const ALERT_DAYS = 7;
/** Mediodía UTC del 10 de septiembre: el día 10 también en Ciudad de México,
 * la zona con la que `nextAnchorOnOrAfter` resuelve el ancla. */
const NOW = new Date("2026-09-10T18:00:00Z");

async function seedPlanWithSubscriber() {
  const plan = await seedPlanWithStripeRefs();
  await seedSubscribedAccount({ planId: plan._id.toString(), status: SubscriptionStatus.ACTIVE });
  return plan;
}

describe("jobs/alert-missing-edition", () => {
  beforeEach(() => {
    __setAdminAlertEmailForTests("admin@esenciaglow.mx");
  });

  it("alerta cuando falta la edición del ciclo del próximo cobro", async () => {
    const plan = await seedPlanWithSubscriber();
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);

    const summary = await alertMissingEdition(NOW, ANCHOR_DAY, ALERT_DAYS);

    expect(summary).toMatchObject({ scanned: 1, alerted: 1, failed: 0 });
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.to).toBe("admin@esenciaglow.mx");

    const reloaded = await SubscriptionPlan.findById(plan._id);
    expect(reloaded?.missingEditionAlertedFor).toBe("2026-09");

    const log = await AuditLog.findOne({
      action: SubscriptionAction.SHIPMENT_EDITION_MISSING_UPCOMING,
      targetId: plan._id,
    });
    expect(log).not.toBeNull();
  });

  it("no vuelve a alertar el mismo ciclo en el siguiente tick", async () => {
    await seedPlanWithSubscriber();
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);

    await alertMissingEdition(NOW, ANCHOR_DAY, ALERT_DAYS);
    const second = await alertMissingEdition(NOW, ANCHOR_DAY, ALERT_DAYS);

    expect(second.alerted).toBe(0);
    expect(fake.calls).toHaveLength(1);
  });

  it("no alerta si la edición del ciclo ya está publicada", async () => {
    const plan = await seedPlanWithSubscriber();
    const { product, variantId } = await seedSubscriptionVariantWithStock();
    await seedPublishedEdition({
      planId: plan._id.toString(),
      cycleYear: 2026,
      cycleMonth: 9,
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }],
    });
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);

    const summary = await alertMissingEdition(NOW, ANCHOR_DAY, ALERT_DAYS);

    expect(summary.alerted).toBe(0);
    expect(fake.calls).toHaveLength(0);
  });

  it("no alerta todavía si el cobro está más lejos que la ventana de aviso", async () => {
    await seedPlanWithSubscriber();
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);

    // 1 de septiembre: faltan 14 días para el ancla, el doble de la ventana.
    const summary = await alertMissingEdition(new Date("2026-09-01T18:00:00Z"), ANCHOR_DAY, ALERT_DAYS);

    expect(summary.alerted).toBe(0);
    expect(fake.calls).toHaveLength(0);
  });

  it("ignora los planes sin suscriptoras: nadie va a ser cobrado", async () => {
    await seedPlanWithStripeRefs();
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);

    const summary = await alertMissingEdition(NOW, ANCHOR_DAY, ALERT_DAYS);

    expect(summary).toMatchObject({ scanned: 0, alerted: 0 });
    expect(fake.calls).toHaveLength(0);
  });

  it("resuelve el ciclo del ancla incluso con billingAnchorDay = 1 (el default)", async () => {
    // Regresión de code review: `nextAnchorOnOrAfter` devuelve MEDIANOCHE UTC
    // del día-ancla, así que reconvertir ese instante a la zona del negocio
    // (UTC-6) cae en el día ANTERIOR — con ancla 1, el MES anterior. El job
    // buscaba entonces la edición del mes en curso (normalmente publicada) y
    // no avisaba nunca. Con ancla 1 el feature entero era un no-op.
    const plan = await seedPlanWithSubscriber();
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);

    // 28 de septiembre: el próximo cobro con ancla 1 es el 1 de OCTUBRE.
    const summary = await alertMissingEdition(new Date("2026-09-28T18:00:00Z"), 1, ALERT_DAYS);

    expect(summary.alerted).toBe(1);
    const reloaded = await SubscriptionPlan.findById(plan._id);
    expect(reloaded?.missingEditionAlertedFor).toBe("2026-10");
  });

  it("con ancla 1, una edición publicada para el ciclo SIGUIENTE silencia el aviso", async () => {
    // La otra mitad del mismo bug: si el ciclo se resolviera mal, esta
    // edición de octubre no se encontraría y el job alertaría de más.
    const plan = await seedPlanWithSubscriber();
    const { product, variantId } = await seedSubscriptionVariantWithStock();
    await seedPublishedEdition({
      planId: plan._id.toString(),
      cycleYear: 2026,
      cycleMonth: 10,
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }],
    });
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);

    const summary = await alertMissingEdition(new Date("2026-09-28T18:00:00Z"), 1, ALERT_DAYS);

    expect(summary.alerted).toBe(0);
    expect(fake.calls).toHaveLength(0);
  });

  it("ignora los planes desactivados", async () => {
    const plan = await seedPlanWithSubscriber();
    await SubscriptionPlan.updateOne({ _id: plan._id }, { $set: { isActive: false } });
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);

    const summary = await alertMissingEdition(NOW, ANCHOR_DAY, ALERT_DAYS);

    expect(summary.scanned).toBe(0);
  });
});
