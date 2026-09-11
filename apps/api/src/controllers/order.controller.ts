import type { Request, Response } from "express";
import type { CheckoutResult } from "@esencia-glow/shared";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { parseListQuery } from "../utils/parse-list-query.js";
import { createOrder, listMyOrders, getMyOrder, cancelMyOrder } from "../services/order.service.js";
import { buildPublicOrder, type LeanOrder } from "../services/order-dto.js";

const checkout = asyncHandler(async (req: Request, res: Response) => {
  const { order, replay } = await createOrder({
    userId: req.user!.id,
    lines: req.body.lines,
    quoteId: req.body.quoteId,
    rateId: req.body.rateId,
    termsAccepted: req.body.termsAccepted,
    idempotencyKey: req.idempotencyKey!,
  });

  const dto = buildPublicOrder(order.toObject() as unknown as LeanOrder);
  const message = replay ? "Ya habías creado este pedido." : "Pedido creado.";
  sendResponse(res, replay ? 200 : 201, message, { order: dto } satisfies CheckoutResult);
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

export { checkout, listMine, getMine, cancelMine };
