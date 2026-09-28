import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { parseListQuery } from "../utils/parse-list-query.js";
import { getAdminCustomerById, listAdminCustomers } from "../services/customer-admin.service.js";

const list = asyncHandler(async (req: Request, res: Response) => {
  const query = parseListQuery(req.query);
  const { rows, meta } = await listAdminCustomers(query);
  sendResponse(res, 200, "Clientes.", rows, meta);
});

const getOne = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  sendResponse(res, 200, "Cliente.", await getAdminCustomerById(req.params.id));
});

export { list, getOne };
