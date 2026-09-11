import type { Request, Response } from "express";
import type { CheckoutResult } from "@esencia-glow/shared";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { parseListQuery } from "../utils/parse-list-query.js";
import { createOrder, listMyOrders, getMyOrder, cancelMyOrder } from "../services/order.service.js";
import { ensurePaymentIntent } from "../services/order-payment-intent.service.js";
import { resolvePaymentProvider } from "../services/payment-provider.js";
import { AppError } from "../utils/app-error.js";
import { buildPublicOrder, type LeanOrder } from "../services/order-dto.js";

const checkout = asyncHandler(async (req: Request, res: Response) => {
  // Verificado ANTES de reservar stock: sin esto, un entorno sin
  // `STRIPE_SECRET_KEY` dejaría una orden `pending` con inventario
  // apartado por cada intento de checkout, aunque el 503 final sea
  // correcto — el checkout debe fallar limpio, sin tocar nada.
  if (!resolvePaymentProvider()) {
    throw new AppError("Los pagos no están configurados.", 503);
  }

  const { order, replay } = await createOrder({
    userId: req.user!.id,
    lines: req.body.lines,
    quoteId: req.body.quoteId,
    rateId: req.body.rateId,
    paymentMethod: req.body.paymentMethod,
    termsAccepted: req.body.termsAccepted,
    idempotencyKey: req.idempotencyKey!,
  });

  // El PaymentIntent se crea DESPUÉS del commit de la orden (nunca dentro
  // de esa transacción — Stripe es una llamada de red a un tercero). Un
  // replay (misma Idempotency-Key) simplemente vuelve a pedir el intent ya
  // existente, nunca crea otro (ver order-payment-intent.service.ts).
  const { payment } = await ensurePaymentIntent(order._id.toString(), req.user!.id);

  const dto = buildPublicOrder(order.toObject() as unknown as LeanOrder);
  const message = replay ? "Ya habías creado este pedido." : "Pedido creado.";
  sendResponse(res, replay ? 200 : 201, message, { order: dto, payment } satisfies CheckoutResult);
});

/** `POST /orders/:id/payment` — reanudar el pago de un pedido `pending`
 * propio (ver plan de 1.6 §B punto 5): el front lo usa cuando el cliente
 * vuelve a un checkout que ya tenía orden pero cerró la pestaña antes de
 * pagar, o cuando 1.5 respondió 409 con el `orderId` de un pendiente. */
const resumePayment = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const { payment } = await ensurePaymentIntent(req.params.id, req.user!.id);
  sendResponse(res, 200, "Pago listo para continuar.", payment);
});

const listMine = asyncHandler(async (req: Request, res: Response) => {
  const query = parseListQuery(req.query);
  const { rows, meta } = await listMyOrders({ ...query, userId: req.user!.id });
  sendResponse(res, 200, "Pedidos.", rows.map(buildPublicOrder), meta);
});

const getMine = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const order = await getMyOrder(req.params.id, req.user!.id);
  sendResponse(res, 200, "Pedido.", buildPublicOrder(order));
});

const cancelMine = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const order = await cancelMyOrder(req.params.id, req.user!.id);
  sendResponse(res, 200, "Pedido cancelado.", buildPublicOrder(order));
});

export { checkout, resumePayment, listMine, getMine, cancelMine };
