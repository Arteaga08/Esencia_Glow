import type { NextFunction, Request, Response } from "express";

type AsyncRequestHandler<TReq extends Request = Request> = (
  req: TReq,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

/**
 * Envuelve un controller async para que cualquier rechazo llegue al
 * errorHandler global, sin try/catch repetido en cada controller.
 */
function asyncHandler<TReq extends Request = Request>(handler: AsyncRequestHandler<TReq>) {
  return (req: TReq, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
}

export { asyncHandler };
