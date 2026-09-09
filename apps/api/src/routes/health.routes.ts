import { Router } from "express";
import { sendResponse } from "../utils/send-response.js";

const router = Router();

router.get("/health", (_req, res) => {
  sendResponse(res, 200, "OK", { uptime: process.uptime() });
});

export default router;
