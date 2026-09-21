import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import * as homePublicService from "../services/home-public.service.js";

const get = asyncHandler(async (_req: Request, res: Response) => {
  const home = await homePublicService.getPublicHomeContent();
  sendResponse(res, 200, "Contenido del home obtenido.", home);
});

export { get };
