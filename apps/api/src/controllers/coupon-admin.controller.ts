import type { Request, Response } from "express";
import type { CouponKind } from "@esencia-glow/shared";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { parseListQuery } from "../utils/parse-list-query.js";
import { createPublicCoupon, listCoupons, setCouponActive } from "../services/coupon-admin.service.js";
import { giveCouponToCustomer } from "../services/coupon-grant.service.js";

const list = asyncHandler(async (req: Request, res: Response) => {
  const query = parseListQuery(req.query, "-createdAt");
  const { rows, meta } = await listCoupons({
    ...query,
    ...(req.query.kind ? { kind: req.query.kind as CouponKind } : {}),
    ...(req.query.status ? { status: req.query.status as "active" | "inactive" } : {}),
  });
  sendResponse(res, 200, "Cupones.", rows, meta);
});

const create = asyncHandler(async (req: Request, res: Response) => {
  sendResponse(res, 201, "Cupón creado.", await createPublicCoupon(req.body, req.user!.id));
});

const setActive = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const coupon = await setCouponActive(req.params.id, req.body.isActive, req.user!.id);
  sendResponse(res, 200, req.body.isActive ? "Cupón activado." : "Cupón desactivado.", coupon);
});

/** `POST /admin/customers/:id/coupons` — vive en la ruta de Clientes pero su lógica es de cupones. */
const give = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  sendResponse(res, 201, "Cupón entregado.", await giveCouponToCustomer(req.params.id, req.body, req.user!.id));
});

export { list, create, setActive, give };
