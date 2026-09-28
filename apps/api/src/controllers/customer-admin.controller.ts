import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { parseListQuery } from "../utils/parse-list-query.js";
import { TopCustomersPeriod, TopCustomersSort } from "@esencia-glow/shared";
import { getAdminCustomerById, listAdminCustomers } from "../services/customer-admin.service.js";
import { getTopCustomers } from "../services/customer-top.service.js";

const list = asyncHandler(async (req: Request, res: Response) => {
  const query = parseListQuery(req.query);
  const { rows, meta } = await listAdminCustomers(query);
  sendResponse(res, 200, "Clientes.", rows, meta);
});

const getOne = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  sendResponse(res, 200, "Cliente.", await getAdminCustomerById(req.params.id));
});

// `validate(topCustomersQuerySchema)` ya rechazó cualquier valor fuera de
// los enums; aquí solo se aplican los defaults (ver el validador).
const top = asyncHandler(async (req: Request, res: Response) => {
  const period = (req.query.period as TopCustomersPeriod | undefined) ?? TopCustomersPeriod.MONTH;
  const sortBy = (req.query.sortBy as TopCustomersSort | undefined) ?? TopCustomersSort.SPENT;
  sendResponse(res, 200, "Mejores clientes.", await getTopCustomers({ period, sortBy }));
});

export { list, getOne, top };
