import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionStatus } from "@esencia-glow/shared";
import { AppError } from "../../src/utils/app-error.js";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { SubscriptionAccount } from "../../src/models/subscription-account.model.js";
import {
  confirmPaymentMethod,
  createPaymentMethodSetup,
} from "../../src/services/subscription-payment-method.service.js";
import { __setSubscriptionProviderForTests } from "../../src/services/subscription-provider.js";
import type { SubscriptionProvider } from "../../src/services/subscription-provider.js";
import { buildFakeSubscriptionProvider } from "../helpers/fake-subscription-provider.js";
import { seedManaged } from "../helpers/subscription-fixtures.js";

/**
 * Autoservicio de la tarjeta (Milestone 1.7.3). Dos pasos: `createPaymentMethodSetup`
 * (SetupIntent para que el front confirme en sesión) y `confirmPaymentMethod`
 * (fija la tarjeta ya confirmada). El `setupIntentId` lo manda el CLIENTE:
 * nunca se confía en él — se verifica que el intento pertenece al customer y
 * a la cuenta de quien pregunta, y cualquier discrepancia de dueño es 404
 * (no un 403 que confirme que ese id existe).
 */

let provider: SubscriptionProvider;

function useProvider(overrides: Partial<SubscriptionProvider> = {}): SubscriptionProvider {
  provider = buildFakeSubscriptionProvider(overrides);
  __setSubscriptionProviderForTests(provider);
  return provider;
}

beforeEach(() => {
  useProvider();
});

/** SetupIntent confirmado que pertenece a la cuenta sembrada. */
function ownedSetup(seed: { subscriptionRef: string; accountId: unknown }, overrides = {}) {
  return {
    status: "succeeded" as const,
    customerRef: `cus_${seed.subscriptionRef}`,
    paymentMethodRef: "pm_nueva",
    accountIdHint: String(seed.accountId),
    ...overrides,
  };
}

describe("subscription-payment-method — createPaymentMethodSetup", () => {
  it.each([SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE, SubscriptionStatus.PAUSED])(
    "estado %s: crea el SetupIntent sobre SU customer con su accountId y devuelve el clientSecret",
    async (status) => {
      const seed = await seedManaged({ status });

      const result = await createPaymentMethodSetup(seed.userId);

      expect(provider.createPaymentMethodSetup).toHaveBeenCalledWith({
        customerRef: `cus_${seed.subscriptionRef}`,
        accountId: seed.accountId.toString(),
      });
      expect(result.clientSecret).toMatch(/^seti_fake_/);
    },
  );

  it.each([SubscriptionStatus.INCOMPLETE, SubscriptionStatus.CANCELED])("estado %s -> 409 sin llamar a Stripe", async (status) => {
    const seed = await seedManaged({ status });

    await expect(createPaymentMethodSetup(seed.userId)).rejects.toMatchObject({ statusCode: 409 });
    expect(provider.createPaymentMethodSetup).not.toHaveBeenCalled();
  });

  it("sin suscripción -> 404", async () => {
    await expect(createPaymentMethodSetup("aaaaaaaaaaaaaaaaaaaaaaaa")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("sin providerCustomerId (datos corruptos) -> 500, nunca crea un SetupIntent huérfano", async () => {
    const seed = await seedManaged();
    await SubscriptionAccount.updateOne({ _id: seed.accountId }, { $unset: { providerCustomerId: 1 } });

    await expect(createPaymentMethodSetup(seed.userId)).rejects.toMatchObject({ statusCode: 500 });
    expect(provider.createPaymentMethodSetup).not.toHaveBeenCalled();
  });
});

describe("subscription-payment-method — confirmPaymentMethod", () => {
  it("ACTIVE: fija la tarjeta como default (suscripción + customer), NO reintenta factura, audita", async () => {
    const seed = await seedManaged();
    useProvider({ getPaymentMethodSetup: vi.fn().mockResolvedValue(ownedSetup(seed)) });

    const result = await confirmPaymentMethod(seed.userId, "seti_1");

    expect(provider.setDefaultPaymentMethod).toHaveBeenCalledWith({
      subscriptionRef: seed.subscriptionRef,
      customerRef: `cus_${seed.subscriptionRef}`,
      paymentMethodRef: "pm_nueva",
    });
    expect(provider.retryInvoicePayment).not.toHaveBeenCalled();
    expect(result).toEqual({ invoiceRetry: "not_needed" });
    const audit = await AuditLog.findOne({ action: "subscription_payment_method_updated", targetId: seed.accountId });
    expect((audit?.metadata as { retry?: string } | undefined)?.retry).toBe("not_needed");
  });

  it("PAUSED también puede cambiar la tarjeta (sin cobrar nada)", async () => {
    const seed = await seedManaged({ status: SubscriptionStatus.PAUSED });
    useProvider({ getPaymentMethodSetup: vi.fn().mockResolvedValue(ownedSetup(seed)) });

    const result = await confirmPaymentMethod(seed.userId, "seti_1");

    expect(result).toEqual({ invoiceRetry: "not_needed" });
    expect(provider.retryInvoicePayment).not.toHaveBeenCalled();
  });

  it("PAST_DUE con dunningInvoiceId: reintenta ESA factura (no latestInvoiceId, que es la última PAGADA) con la tarjeta nueva", async () => {
    const seed = await seedManaged({ status: SubscriptionStatus.PAST_DUE });
    await SubscriptionAccount.updateOne(
      { _id: seed.accountId },
      { $set: { dunningInvoiceId: "in_pendiente", latestInvoiceId: "in_ultima_pagada" } },
    );
    useProvider({ getPaymentMethodSetup: vi.fn().mockResolvedValue(ownedSetup(seed)) });

    const result = await confirmPaymentMethod(seed.userId, "seti_1");

    expect(provider.retryInvoicePayment).toHaveBeenCalledWith({
      invoiceRef: "in_pendiente",
      paymentMethodRef: "pm_nueva",
      idempotencyKey: `account:${seed.accountId.toString()}:inv:in_pendiente:pm:pm_nueva`,
    });
    expect(result).toEqual({ invoiceRetry: "paid" });
  });

  it.each(["already_settled", "requires_action", "declined"] as const)(
    "PAST_DUE: outcome '%s' se devuelve tal cual y el ESTADO de la cuenta no cambia (solo el webhook la reactiva)",
    async (outcome) => {
      const seed = await seedManaged({ status: SubscriptionStatus.PAST_DUE });
      await SubscriptionAccount.updateOne({ _id: seed.accountId }, { $set: { dunningInvoiceId: "in_pendiente" } });
      useProvider({
        getPaymentMethodSetup: vi.fn().mockResolvedValue(ownedSetup(seed)),
        retryInvoicePayment: vi.fn().mockResolvedValue({ outcome }),
      });

      const result = await confirmPaymentMethod(seed.userId, "seti_1");

      expect(result).toEqual({ invoiceRetry: outcome });
      expect((await SubscriptionAccount.findById(seed.accountId))?.status).toBe(SubscriptionStatus.PAST_DUE);
    },
  );

  it("PAST_DUE sin dunningInvoiceId: no hay factura que reintentar -> not_needed", async () => {
    const seed = await seedManaged({ status: SubscriptionStatus.PAST_DUE });
    useProvider({ getPaymentMethodSetup: vi.fn().mockResolvedValue(ownedSetup(seed)) });

    const result = await confirmPaymentMethod(seed.userId, "seti_1");

    expect(result).toEqual({ invoiceRetry: "not_needed" });
    expect(provider.retryInvoicePayment).not.toHaveBeenCalled();
  });

  it("SetupIntent de OTRO customer -> 404 (sin oráculo de existencia) y NADA se fija", async () => {
    const seed = await seedManaged();
    useProvider({
      getPaymentMethodSetup: vi.fn().mockResolvedValue(ownedSetup(seed, { customerRef: "cus_de_otra_persona" })),
    });

    await expect(confirmPaymentMethod(seed.userId, "seti_ajeno")).rejects.toMatchObject({ statusCode: 404 });
    expect(provider.setDefaultPaymentMethod).not.toHaveBeenCalled();
  });

  it("SetupIntent del mismo customer pero de OTRA cuenta (accountId distinto) -> 404", async () => {
    const seed = await seedManaged();
    useProvider({
      getPaymentMethodSetup: vi.fn().mockResolvedValue(ownedSetup(seed, { accountIdHint: "bbbbbbbbbbbbbbbbbbbbbbbb" })),
    });

    await expect(confirmPaymentMethod(seed.userId, "seti_x")).rejects.toMatchObject({ statusCode: 404 });
    expect(provider.setDefaultPaymentMethod).not.toHaveBeenCalled();
  });

  it("SetupIntent sin accountId en metadata (no lo creamos nosotros) -> 404", async () => {
    const seed = await seedManaged();
    useProvider({
      getPaymentMethodSetup: vi.fn().mockResolvedValue(ownedSetup(seed, { accountIdHint: undefined })),
    });

    await expect(confirmPaymentMethod(seed.userId, "seti_x")).rejects.toMatchObject({ statusCode: 404 });
  });

  it.each(["pending", "failed"] as const)(
    "SetupIntent propio pero en estado '%s' -> 409 'aún no está confirmada'",
    async (status) => {
      const seed = await seedManaged();
      useProvider({ getPaymentMethodSetup: vi.fn().mockResolvedValue(ownedSetup(seed, { status })) });

      await expect(confirmPaymentMethod(seed.userId, "seti_1")).rejects.toMatchObject({ statusCode: 409 });
      expect(provider.setDefaultPaymentMethod).not.toHaveBeenCalled();
    },
  );

  it("un SetupIntent que Stripe no encuentra sube como 404 (viene del adapter)", async () => {
    const seed = await seedManaged();
    useProvider({ getPaymentMethodSetup: vi.fn().mockRejectedValue(new AppError("Método de pago no encontrado.", 404)) });

    await expect(confirmPaymentMethod(seed.userId, "seti_no_existe")).rejects.toMatchObject({ statusCode: 404 });
  });

  it.each([SubscriptionStatus.INCOMPLETE, SubscriptionStatus.CANCELED])("estado %s -> 409 sin consultar a Stripe", async (status) => {
    const seed = await seedManaged({ status });

    await expect(confirmPaymentMethod(seed.userId, "seti_1")).rejects.toMatchObject({ statusCode: 409 });
    expect(provider.getPaymentMethodSetup).not.toHaveBeenCalled();
  });

  it("si Stripe falla al fijar la tarjeta: el error sube y no se audita ni se reintenta ninguna factura", async () => {
    const seed = await seedManaged({ status: SubscriptionStatus.PAST_DUE });
    await SubscriptionAccount.updateOne({ _id: seed.accountId }, { $set: { dunningInvoiceId: "in_pendiente" } });
    useProvider({
      getPaymentMethodSetup: vi.fn().mockResolvedValue(ownedSetup(seed)),
      setDefaultPaymentMethod: vi.fn().mockRejectedValue(new AppError("Stripe caído", 502)),
    });

    await expect(confirmPaymentMethod(seed.userId, "seti_1")).rejects.toMatchObject({ statusCode: 502 });
    expect(provider.retryInvoicePayment).not.toHaveBeenCalled();
    expect(await AuditLog.countDocuments({ action: "subscription_payment_method_updated" })).toBe(0);
  });
});
