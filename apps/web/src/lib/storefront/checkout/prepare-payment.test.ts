import { describe, expect, it, vi } from "vitest";
import type { PublicOrder } from "@esencia-glow/shared";
import type { PlaceOrderResult } from "./place-order";
import { preparePayment, type PreparePaymentDeps } from "./prepare-payment";

const ORDER = { id: "o1", totals: { totalCents: 50000 } } as unknown as PublicOrder;

function deps(overrides: Partial<PreparePaymentDeps> = {}): PreparePaymentDeps {
  return {
    placed: null,
    quoteId: "q1",
    rateId: "r1",
    lines: [{ itemType: "product", itemId: "a", quantity: 1 }],
    shownTotalCents: 50000,
    placeOrder: vi.fn(async (): Promise<PlaceOrderResult> => ({ ok: true, order: ORDER, clientSecret: "secret_1" })),
    storage: null,
    makeId: () => "uuid-1",
    onPlaced: vi.fn(),
    onCartSpent: vi.fn(),
    onResume: vi.fn(),
    onRequote: vi.fn(),
    onRetryCart: vi.fn(),
    onSessionLost: vi.fn(),
    onCouponRejected: vi.fn(),
    ...overrides,
  };
}

function failed(action: "requote" | "cart" | "resume" | "unavailable" | "message" | "coupon", extra: { unauthorized?: boolean; retryable?: boolean } = {}): PlaceOrderResult {
  return { ok: false, unauthorized: extra.unauthorized ?? false, failure: { action, message: "mensaje del API", retryable: extra.retryable ?? false, orderId: "p1" } };
}

describe("preparePayment", () => {
  it("con el pedido ya creado solo reutiliza su clientSecret: nunca crea otro", async () => {
    const d = deps({ placed: { orderId: "o9", clientSecret: "viejo" } });
    expect(await preparePayment(d)).toEqual({ ok: true, clientSecret: "viejo", orderId: "o9" });
    expect(d.placeOrder).not.toHaveBeenCalled();
  });

  it("camino feliz: crea el pedido, avisa y gasta el carrito", async () => {
    const d = deps();
    expect(await preparePayment(d)).toEqual({ ok: true, clientSecret: "secret_1", orderId: "o1" });
    expect(d.onPlaced).toHaveBeenCalledWith(ORDER, "secret_1");
    expect(d.onCartSpent).toHaveBeenCalledOnce();
  });

  it("si el servidor recalculó otro total, el pedido queda creado pero NO se cobra a ciegas", async () => {
    const d = deps({ shownTotalCents: 45000 });
    const result = await preparePayment(d);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toMatch(/\$500\.00/);
    expect(d.onPlaced).toHaveBeenCalledOnce();
  });

  it("pedido creado sin clientSecret: se vacía el carrito y se reanuda ese pedido", async () => {
    const d = deps({ placeOrder: vi.fn(async (): Promise<PlaceOrderResult> => ({ ok: true, order: ORDER, clientSecret: null })) });
    const result = await preparePayment(d);
    expect(result.ok).toBe(false);
    expect(d.onCartSpent).toHaveBeenCalledOnce();
    expect(d.onResume).toHaveBeenCalledOnce();
    expect(d.onPlaced).not.toHaveBeenCalled();
  });

  it("cotización vencida o carrito cambiado: vuelve al envío y no vacía el carrito", async () => {
    const d = deps({ placeOrder: vi.fn(async () => failed("requote")) });
    expect((await preparePayment(d)).ok).toBe(false);
    expect(d.onRequote).toHaveBeenCalledWith("mensaje del API Consulta las tarifas otra vez.");
    expect(d.onCartSpent).not.toHaveBeenCalled();
  });

  it("algo agotado: relee el carrito; pedido pendiente: lo reanuda; sesión vencida: la refresca", async () => {
    const cart = deps({ placeOrder: vi.fn(async () => failed("cart")) });
    await preparePayment(cart);
    expect(cart.onRetryCart).toHaveBeenCalledOnce();

    const resume = deps({ placeOrder: vi.fn(async () => failed("resume")) });
    await preparePayment(resume);
    expect(resume.onResume).toHaveBeenCalledOnce();

    const session = deps({ placeOrder: vi.fn(async () => failed("message", { unauthorized: true })) });
    await preparePayment(session);
    expect(session.onSessionLost).toHaveBeenCalledOnce();
  });

  it("un rechazo definitivo del servidor suelta la llave; uno de red la conserva para el replay", async () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };

    await preparePayment(deps({ storage, placeOrder: vi.fn(async () => failed("message", { retryable: true })) }));
    expect(store.size).toBe(1);

    await preparePayment(deps({ storage, placeOrder: vi.fn(async () => failed("message", { retryable: false })) }));
    expect(store.size).toBe(0);
  });

  describe("con cupón", () => {
    it("manda el código al crear el pedido", async () => {
      const d = deps({ couponCode: "BIENVENIDA10" });
      await preparePayment(d);
      expect(d.placeOrder).toHaveBeenCalledWith(expect.objectContaining({ couponCode: "BIENVENIDA10" }));
    });

    it("sin cupón no manda el campo", async () => {
      const d = deps();
      await preparePayment(d);
      expect(d.placeOrder).toHaveBeenCalledWith(expect.not.objectContaining({ couponCode: expect.anything() }));
    });

    it("un rechazo de cupón lo quita en su campo, suelta la llave y NO crea nada ni toca el carrito", async () => {
      const d = deps({ couponCode: "VENCIDO1", placeOrder: vi.fn(async () => failed("coupon")) });
      const result = await preparePayment(d);
      expect(d.onCouponRejected).toHaveBeenCalledWith("mensaje del API");
      expect(d.onCartSpent).not.toHaveBeenCalled();
      expect(d.onRetryCart).not.toHaveBeenCalled();
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.message).toMatch(/quitamos el cupón/i);
    });

    it("el total con descuento que ve la clienta coincide con el del servidor: se cobra", async () => {
      const discounted = { id: "o2", totals: { totalCents: 45000 } } as unknown as PublicOrder;
      const d = deps({ couponCode: "BIENVENIDA10", shownTotalCents: 45000, placeOrder: vi.fn(async (): Promise<PlaceOrderResult> => ({ ok: true, order: discounted, clientSecret: "s2" })) });
      expect(await preparePayment(d)).toEqual({ ok: true, clientSecret: "s2", orderId: "o2" });
    });
  });
});
