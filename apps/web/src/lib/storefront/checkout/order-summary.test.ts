import { OrderStatus, PaymentMethod, PaymentState, ShippingCarrier, type PublicOrder } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { summarizeOrder } from "./order-summary";

const ORDER = {
  id: "o1",
  orderNumber: "EG-2026-0001",
  status: OrderStatus.PENDING,
  lines: [
    { itemType: "product", itemId: "v1", sku: "S1", name: "Sérum", variantName: "30 ml", image: { url: "https://x/y.jpg", alt: "Sérum" }, unitPriceCents: 34900, quantity: 2, lineTotalCents: 69800 },
    { itemType: "bundle", itemId: "k1", sku: "K1", name: "Kit glow", unitPriceCents: 50000, quantity: 1, lineTotalCents: 50000 },
  ],
  totals: { subtotalCents: 119800, discountCents: 0, taxCents: 19174, taxRateBps: 1600, shippingCents: 14900, totalCents: 134700, currency: "MXN" },
  payment: { provider: "stripe", method: PaymentMethod.CARD, state: PaymentState.PENDING, captureMethod: "automatic" },
  shippingSelection: { rateId: "r", carrier: ShippingCarrier.FEDEX, service: "Express", amountCents: 14900, estimatedDays: 2 },
} as unknown as PublicOrder;

describe("summarizeOrder", () => {
  it("convierte las líneas del pedido a renglones del resumen, de solo lectura", () => {
    const { lines } = summarizeOrder(ORDER);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ kind: "product", name: "Sérum", variantLabel: "30 ml", priceCents: 34900, quantity: 2, available: true, image: { url: "https://x/y.jpg", alt: "Sérum" } });
    expect(lines[1]).toMatchObject({ kind: "kit", variantLabel: "", available: true });
  });

  it("los totales salen del pedido ya cobrado, no se recalculan", () => {
    expect(summarizeOrder(ORDER).totals).toEqual({ itemCount: 3, subtotalCents: 119800, shippingCents: 14900, taxCents: 19174, totalCents: 134700 });
  });
});
