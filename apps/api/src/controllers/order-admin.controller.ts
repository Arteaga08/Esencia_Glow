import type { Request, Response } from "express";
import type { OrderPriority, OrderStatus } from "@esencia-glow/shared";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { parseListQuery } from "../utils/parse-list-query.js";
import { listAdminOrders, getAdminOrderById, getOrderActivity } from "../services/order-admin.service.js";
import { getOrderStatusSummary } from "../services/order-summary.service.js";
import { changeOrderStatus, updateOrderShipment, bulkChangeStatus } from "../services/order-admin-status.service.js";
import { correctShippingAddress, changeOrderPriority, addInternalNote } from "../services/order-admin-fields.service.js";

const list = asyncHandler(async (req: Request, res: Response) => {
  const query = parseListQuery(req.query);
  const { status, group, priority, orderNumber, incident } = req.query as {
    status?: OrderStatus;
    group?: string;
    priority?: OrderPriority;
    orderNumber?: string;
    incident?: boolean;
  };
  const { rows, meta } = await listAdminOrders({ ...query, status, group, priority, orderNumber, incident });
  sendResponse(res, 200, "Pedidos.", rows, meta);
});

const summary = asyncHandler(async (_req: Request, res: Response) => {
  sendResponse(res, 200, "Resumen de pedidos.", await getOrderStatusSummary());
});

const getOne = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  sendResponse(res, 200, "Pedido.", await getAdminOrderById(req.params.id));
});

const activity = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  sendResponse(res, 200, "Bitácora del pedido.", await getOrderActivity(req.params.id));
});

const changeStatus = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  await changeOrderStatus({
    orderId: req.params.id,
    targetStatus: req.body.status,
    adminId: req.user!.id,
    reason: req.body.reason,
    shipment: req.body.shipment,
  });
  sendResponse(res, 200, "Estatus del pedido actualizado.", await getAdminOrderById(req.params.id));
});

const updateShipment = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  await updateOrderShipment({ orderId: req.params.id, adminId: req.user!.id, ...req.body });
  sendResponse(res, 200, "Guía actualizada.", await getAdminOrderById(req.params.id));
});

const correctAddress = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  await correctShippingAddress(req.params.id, req.user!.id, req.body);
  sendResponse(res, 200, "Dirección corregida.", await getAdminOrderById(req.params.id));
});

const changePriority = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  await changeOrderPriority(req.params.id, req.user!.id, req.body.priority);
  sendResponse(res, 200, "Prioridad actualizada.", await getAdminOrderById(req.params.id));
});

const addNote = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  await addInternalNote(req.params.id, req.user!.id, req.body.body);
  sendResponse(res, 201, "Nota agregada.", await getAdminOrderById(req.params.id));
});

const bulkStatus = asyncHandler(async (req: Request, res: Response) => {
  const results = await bulkChangeStatus(req.body.orderIds, req.body.status, req.user!.id, req.body.reason);
  sendResponse(res, 200, "Cambio de estatus en lote procesado.", results);
});

export { list, summary, getOne, activity, changeStatus, updateShipment, correctAddress, changePriority, addNote, bulkStatus };
