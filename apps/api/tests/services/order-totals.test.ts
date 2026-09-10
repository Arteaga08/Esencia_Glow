import { describe, expect, it } from "vitest";
import { computeOrderTotals } from "../../src/services/order-totals.js";

describe("services/order-totals", () => {
  it("suma las líneas como subtotal bruto (IVA incluido)", () => {
    const totals = computeOrderTotals({
      lineTotalsCents: [50000, 30000],
      chosenRateAmountCents: 12000,
      cheapestRateAmountCents: 12000,
      taxRateBps: 1600,
      freeShippingThresholdCents: 0,
    });
    expect(totals.subtotalCents).toBe(80000);
  });

  it("cobra la tarifa de envío elegida cuando no hay envío gratis", () => {
    const totals = computeOrderTotals({
      lineTotalsCents: [10000],
      chosenRateAmountCents: 15000,
      cheapestRateAmountCents: 12000,
      taxRateBps: 1600,
      freeShippingThresholdCents: 0,
    });
    expect(totals.shippingCents).toBe(15000);
    expect(totals.freeShippingApplied).toBe(false);
    expect(totals.totalCents).toBe(25000);
  });

  it("aplica envío gratis en la tarifa más barata cuando el subtotal alcanza el umbral", () => {
    const totals = computeOrderTotals({
      lineTotalsCents: [100000],
      chosenRateAmountCents: 12000,
      cheapestRateAmountCents: 12000,
      taxRateBps: 1600,
      freeShippingThresholdCents: 99900,
    });
    expect(totals.freeShippingApplied).toBe(true);
    expect(totals.shippingCents).toBe(0);
  });

  it("cobra la diferencia si el cliente elige una tarifa más cara con envío gratis activo", () => {
    const totals = computeOrderTotals({
      lineTotalsCents: [100000],
      chosenRateAmountCents: 19000,
      cheapestRateAmountCents: 12000,
      taxRateBps: 1600,
      freeShippingThresholdCents: 99900,
    });
    expect(totals.freeShippingApplied).toBe(true);
    expect(totals.shippingCents).toBe(7000);
  });

  it("umbral en 0 significa desactivado — nunca aplica envío gratis", () => {
    const totals = computeOrderTotals({
      lineTotalsCents: [1_000_000],
      chosenRateAmountCents: 12000,
      cheapestRateAmountCents: 12000,
      taxRateBps: 1600,
      freeShippingThresholdCents: 0,
    });
    expect(totals.freeShippingApplied).toBe(false);
    expect(totals.shippingCents).toBe(12000);
  });

  it("el umbral se compara contra subtotalCents, nunca contra el total con envío ya sumado", () => {
    // subtotal 99900 alcanza el umbral por sí solo, sin contar el envío
    const totals = computeOrderTotals({
      lineTotalsCents: [99900],
      chosenRateAmountCents: 15000,
      cheapestRateAmountCents: 15000,
      taxRateBps: 1600,
      freeShippingThresholdCents: 99900,
    });
    expect(totals.freeShippingApplied).toBe(true);
    expect(totals.shippingCents).toBe(0);
  });

  it("desglosa el IVA contenido en el total — vector conocido al 16%", () => {
    const totals = computeOrderTotals({
      lineTotalsCents: [100],
      chosenRateAmountCents: 0,
      cheapestRateAmountCents: 0,
      taxRateBps: 1600,
      freeShippingThresholdCents: 0,
    });
    // total=100 -> subtotal neto 86, iva 14 (86 * 1.16 = 99.76 ~ 100)
    expect(totals.totalCents).toBe(100);
    expect(totals.taxCents).toBe(14);
  });

  it("total 0 produce impuesto 0", () => {
    const totals = computeOrderTotals({
      lineTotalsCents: [],
      chosenRateAmountCents: 0,
      cheapestRateAmountCents: 0,
      taxRateBps: 1600,
      freeShippingThresholdCents: 0,
    });
    expect(totals.totalCents).toBe(0);
    expect(totals.taxCents).toBe(0);
  });

  it("taxRateBps en 0 no genera impuesto", () => {
    const totals = computeOrderTotals({
      lineTotalsCents: [50000],
      chosenRateAmountCents: 0,
      cheapestRateAmountCents: 0,
      taxRateBps: 0,
      freeShippingThresholdCents: 0,
    });
    expect(totals.taxCents).toBe(0);
  });

  it("respeta la identidad total = subtotal - discount + shipping, con discount siempre 0", () => {
    const totals = computeOrderTotals({
      lineTotalsCents: [12345, 6789],
      chosenRateAmountCents: 4321,
      cheapestRateAmountCents: 4000,
      taxRateBps: 1600,
      freeShippingThresholdCents: 0,
    });
    expect(totals.discountCents).toBe(0);
    expect(totals.totalCents).toBe(totals.subtotalCents - totals.discountCents + totals.shippingCents);
  });

  it("fuzz: la identidad subtotal - discount + shipping === total y 0 <= tax <= total se cumplen siempre", () => {
    for (let i = 0; i < 1000; i++) {
      const lineTotalsCents = Array.from(
        { length: 1 + Math.floor(Math.random() * 5) },
        () => Math.floor(Math.random() * 500_000),
      );
      const cheapestRateAmountCents = Math.floor(Math.random() * 30_000);
      const chosenRateAmountCents = cheapestRateAmountCents + Math.floor(Math.random() * 20_000);
      const taxRateBps = Math.floor(Math.random() * 3000);
      const freeShippingThresholdCents = Math.random() < 0.5 ? 0 : Math.floor(Math.random() * 200_000);

      const totals = computeOrderTotals({
        lineTotalsCents,
        chosenRateAmountCents,
        cheapestRateAmountCents,
        taxRateBps,
        freeShippingThresholdCents,
      });

      expect(totals.totalCents).toBe(totals.subtotalCents - totals.discountCents + totals.shippingCents);
      expect(totals.taxCents).toBeGreaterThanOrEqual(0);
      expect(totals.taxCents).toBeLessThanOrEqual(totals.totalCents);
      expect(Number.isInteger(totals.taxCents)).toBe(true);
    }
  });
});
