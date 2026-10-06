import { PaymentMethod, type CartLineInput, type CheckoutResult, type PublicOrder } from "@esencia-glow/shared";
import { accountRequest } from "../account-api";
import { classifyError } from "../auth-errors";
import { mapPlaceOrderFailure, type PlaceOrderFailure } from "./checkout-failures";

type PlaceOrderResult = { ok: true; order: PublicOrder; clientSecret: string | null } | { ok: false; failure: PlaceOrderFailure; unauthorized: boolean };

interface PlaceOrderInput {
  lines: CartLineInput[];
  quoteId: string;
  rateId: string;
  idempotencyKey: string;
}

/**
 * Crea el pedido (`POST /orders`). La tienda solo cobra con tarjeta, así que el
 * método va fijo. Nunca manda un monto: el servidor recalcula todo y el total
 * real vuelve en `order.totals`. Un reintento con la misma llave devuelve el
 * mismo pedido (replay) en vez de crear otro.
 */
async function placeOrder({ lines, quoteId, rateId, idempotencyKey }: PlaceOrderInput): Promise<PlaceOrderResult> {
  try {
    const response = await accountRequest<CheckoutResult>("/api/v1/orders", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: { lines, quoteId, rateId, paymentMethod: PaymentMethod.CARD, termsAccepted: true },
      redirectOnFailure: false,
    });
    return { ok: true, order: response.data.order, clientSecret: response.data.payment.clientSecret ?? null };
  } catch (caught) {
    const failure = classifyError(caught);
    return { ok: false, failure: mapPlaceOrderFailure(failure), unauthorized: failure.kind === "unauthorized" };
  }
}

/** Reanuda el pago de un pedido propio pendiente (`POST /orders/:id/payment`): devuelve el `clientSecret` vigente. */
async function resumeOrderPayment(orderId: string): Promise<{ ok: true; clientSecret: string } | { ok: false; message: string; settled: boolean }> {
  try {
    const response = await accountRequest<{ clientSecret?: string }>(`/api/v1/orders/${orderId}/payment`, { method: "POST", redirectOnFailure: false });
    return response.data.clientSecret ? { ok: true, clientSecret: response.data.clientSecret } : { ok: false, message: "No pudimos retomar el pago. Inténtalo de nuevo.", settled: false };
  } catch (caught) {
    const failure = classifyError(caught);
    // 409: el pedido ya no está pendiente (se pagó o se cerró): la confirmación dirá cuál.
    return { ok: false, message: failure.message, settled: failure.kind === "conflict" };
  }
}

export { placeOrder, resumeOrderPayment };
export type { PlaceOrderInput, PlaceOrderResult };
