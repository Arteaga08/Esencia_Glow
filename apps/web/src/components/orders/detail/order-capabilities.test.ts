import { DisputeStatus, OrderStatus, type AdminOrder } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { getOrderCapabilities } from "./order-capabilities";

function buildOrder(overrides: Partial<AdminOrder> = {}): AdminOrder {
  return {
    status: OrderStatus.PAID,
    totals: { totalCents: 50000 },
    payment: { method: "card", state: "captured" },
    ...overrides,
  } as unknown as AdminOrder;
}

describe("getOrderCapabilities — retención por contracargo (auditoría run-2, hallazgo 18)", () => {
  it("un contracargo abierto bloquea el siguiente estado", () => {
    const caps = getOrderCapabilities(buildOrder({ disputeStatus: DisputeStatus.OPEN }));
    expect(caps.nextStatusBlockedReason).toBe("El pedido tiene un contracargo abierto.");
  });

  it("un contracargo perdido también bloquea el siguiente estado, con su propio motivo", () => {
    const caps = getOrderCapabilities(buildOrder({ disputeStatus: DisputeStatus.LOST }));
    expect(caps.nextStatusBlockedReason).toBe("El pedido tiene un contracargo perdido; no se puede despachar.");
  });

  it("ganado o retirado no bloquean", () => {
    for (const status of [DisputeStatus.WON, DisputeStatus.WITHDRAWN]) {
      expect(getOrderCapabilities(buildOrder({ disputeStatus: status })).nextStatusBlockedReason).toBeNull();
    }
  });

  it("un contracargo perdido no bloquea shipped -> delivered", () => {
    const caps = getOrderCapabilities(buildOrder({ status: OrderStatus.SHIPPED, disputeStatus: DisputeStatus.LOST }));
    expect(caps.nextStatusBlockedReason).toBeNull();
  });
});
