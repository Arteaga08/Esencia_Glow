import { Types } from "mongoose";
import { afterEach, describe, expect, it } from "vitest";
import { User } from "../../src/models/user.model.js";
import {
  sendSubscriptionPaymentConfirmedEmail,
  sendSubscriptionDunningEmail,
  sendSubscriptionAdminIncidentEmail,
  __setAdminAlertEmailForTests,
} from "../../src/services/subscription-email.service.js";
import { __setMailProviderForTests } from "../../src/services/mail-provider.js";
import { buildFakeMailProvider } from "../helpers/fake-mail-provider.js";

/**
 * `subscription-email.service` — correos de Billing (Fase 5 de 1.7.2a, §7 del
 * plan): confirmación de cada cobro exitoso y dunning a la clienta, alerta al
 * admin por edición/inventario faltante. Mismo criterio que
 * `order-email.service.ts`: best-effort (nunca lanza), nombre escapado,
 * `Idempotency-Key` propia por evento hacia Resend.
 */
describe("services/subscription-email", () => {
  afterEach(() => {
    __setAdminAlertEmailForTests(undefined);
  });

  async function seedUser(overrides: Partial<{ firstName: string; lastName: string }> = {}) {
    const userId = new Types.ObjectId();
    await User.create({
      _id: userId,
      email: `${userId.toString()}@example.com`,
      password: "P4ssword!!",
      firstName: overrides.firstName ?? "Ana",
      lastName: overrides.lastName ?? "Pérez",
      emailVerified: true,
    });
    return userId;
  }

  it("sendSubscriptionPaymentConfirmedEmail: asunto, monto formateado y Idempotency-Key por factura", async () => {
    const userId = await seedUser();
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);
    const accountId = new Types.ObjectId().toString();

    await sendSubscriptionPaymentConfirmedEmail({
      accountId,
      userId,
      invoiceRef: "in_123",
      amountPaidCents: 59900,
      currency: "mxn",
      periodEnd: new Date("2026-10-15T12:00:00Z"),
    });

    expect(fake.calls).toHaveLength(1);
    const call = fake.calls[0]!;
    expect(call.subject.toLowerCase()).toContain("cobro");
    expect(call.html).toMatch(/\$\s?599\.00/);
    expect(call.html).not.toContain("<style");
    expect(call.idempotencyKey).toBe(`subscription-${accountId}-invoice-in_123`);
  });

  it("sendSubscriptionDunningEmail: copy de dunning e Idempotency-Key por factura+intento", async () => {
    const userId = await seedUser();
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);
    const accountId = new Types.ObjectId().toString();

    await sendSubscriptionDunningEmail({ accountId, userId, invoiceRef: "in_456", attemptCount: 2 });

    expect(fake.calls).toHaveLength(1);
    const call = fake.calls[0]!;
    expect(call.subject.toLowerCase()).toContain("pago");
    expect(call.idempotencyKey).toBe(`subscription-${accountId}-dunning-in_456-2`);
  });

  it("escapa el nombre de la clienta antes de interpolarlo", async () => {
    const userId = await seedUser({ firstName: "<script>alert(1)</script>" });
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);

    await sendSubscriptionPaymentConfirmedEmail({
      accountId: new Types.ObjectId().toString(),
      userId,
      invoiceRef: "in_789",
      amountPaidCents: 10000,
      currency: "mxn",
      periodEnd: new Date(),
    });

    const call = fake.calls[0]!;
    expect(call.html).not.toContain("<script>alert(1)</script>");
    expect(call.html).toContain("&lt;script&gt;");
  });

  it("usuaria inexistente: no lanza, no envía", async () => {
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);

    await sendSubscriptionPaymentConfirmedEmail({
      accountId: new Types.ObjectId().toString(),
      userId: new Types.ObjectId(),
      invoiceRef: "in_ghost",
      amountPaidCents: 10000,
      currency: "mxn",
      periodEnd: new Date(),
    });

    expect(fake.calls).toHaveLength(0);
  });

  it("un proveedor que lanza no rompe la llamada (best-effort)", async () => {
    const userId = await seedUser();
    __setMailProviderForTests({
      send: async () => {
        throw new Error("boom");
      },
    });

    await expect(
      sendSubscriptionDunningEmail({
        accountId: new Types.ObjectId().toString(),
        userId,
        invoiceRef: "in_boom",
        attemptCount: 1,
      }),
    ).resolves.toBeUndefined();
  });

  describe("sendSubscriptionAdminIncidentEmail", () => {
    it("sin ADMIN_ALERT_EMAIL configurado: no envía, no lanza", async () => {
      const fake = buildFakeMailProvider();
      __setMailProviderForTests(fake);

      await sendSubscriptionAdminIncidentEmail({
        shipmentId: new Types.ObjectId().toString(),
        reason: "edition_missing",
        cycleYear: 2026,
        cycleMonth: 10,
      });

      expect(fake.calls).toHaveLength(0);
    });

    it("con ADMIN_ALERT_EMAIL configurado: envía al admin con Idempotency-Key por caja", async () => {
      __setAdminAlertEmailForTests("admin-alerts@example.com");
      const fake = buildFakeMailProvider();
      __setMailProviderForTests(fake);
      const shipmentId = new Types.ObjectId().toString();

      await sendSubscriptionAdminIncidentEmail({
        shipmentId,
        reason: "inventory_shortage",
        cycleYear: 2026,
        cycleMonth: 10,
      });

      expect(fake.calls).toHaveLength(1);
      const call = fake.calls[0]!;
      expect(call.to).toBe("admin-alerts@example.com");
      expect(call.idempotencyKey).toBe(`subscription-shipment-${shipmentId}-incident`);
    });

    it("edition_missing vs inventory_shortage producen asuntos distintos", async () => {
      __setAdminAlertEmailForTests("admin-alerts@example.com");
      const fake = buildFakeMailProvider();
      __setMailProviderForTests(fake);

      await sendSubscriptionAdminIncidentEmail({
        shipmentId: new Types.ObjectId().toString(),
        reason: "edition_missing",
        cycleYear: 2026,
        cycleMonth: 10,
      });

      expect(fake.calls[0]!.subject.toLowerCase()).toContain("edición");
    });
  });
});
