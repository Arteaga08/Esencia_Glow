import type { Request, Response } from "express";

function notFound(req: Request, res: Response): void {
  res.status(404).json({
    status: "fail",
    message: `No se encontró la ruta ${req.method} ${req.originalUrl}`,
  });
}

export { notFound };
