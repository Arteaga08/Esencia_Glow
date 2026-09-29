import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { SubscriptionInvoice } from "../../src/models/subscription-invoice.model.js";

function buildInvoiceAttrs(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    invoiceRef: "in_123",
    accountId: new mongoose.Types.ObjectId(),
    userId: new mongoose.Types.ObjectId(),
    planId: new mongoose.Types.ObjectId(),
    amountPaidCents: 24900,
    currency: "mxn",
    paidAt: new Date("2026-09-15T18:00:00.000Z"),
    ...overrides,
  };
}

describe("models/SubscriptionInvoice", () => {
  it("crea un registro válido de cobro", async () => {
    const invoice = await SubscriptionInvoice.create(buildInvoiceAttrs());
    expect(invoice.invoiceRef).toBe("in_123");
    expect(invoice.amountPaidCents).toBe(24900);
  });

  it("se crea válido sin billingInterval (cuentas creadas antes de 2.7b)", async () => {
    const invoice = await SubscriptionInvoice.create(buildInvoiceAttrs());
    expect(invoice.billingInterval).toBeUndefined();
  });

  it("rechaza un invoiceRef duplicado (11000) — la fuente de idempotencia del registro", async () => {
    await SubscriptionInvoice.create(buildInvoiceAttrs({ invoiceRef: "in_dup" }));

    await expect(SubscriptionInvoice.create(buildInvoiceAttrs({ invoiceRef: "in_dup" }))).rejects.toMatchObject({
      code: 11000,
    });
  });

  it("rechaza amountPaidCents negativo", async () => {
    await expect(SubscriptionInvoice.create(buildInvoiceAttrs({ amountPaidCents: -100 }))).rejects.toThrow();
  });

  it("rechaza amountPaidCents no entero", async () => {
    await expect(SubscriptionInvoice.create(buildInvoiceAttrs({ amountPaidCents: 100.5 }))).rejects.toThrow();
  });
});
