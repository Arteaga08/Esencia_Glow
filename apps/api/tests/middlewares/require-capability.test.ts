import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { SubscriptionStatus, UserRole } from "@esencia-glow/shared";
import { describe, expect, it, vi } from "vitest";
import { SubscriptionAccount } from "../../src/models/subscription-account.model.js";
import { requireCapability } from "../../src/middlewares/require-capability.js";

function buildReqRes(userId?: string) {
  const req = { user: userId ? { id: userId, role: UserRole.CUSTOMER } : undefined } as Request;
  const res = {} as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe("middlewares/require-capability", () => {
  it("sin req.user llama a next con 401", async () => {
    const { req, res, next } = buildReqRes();
    await requireCapability("subscriber")(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it("un usuario sin cuenta de suscripción llama a next con 403", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const { req, res, next } = buildReqRes(userId);
    await requireCapability("subscriber")(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it("una suscriptora ACTIVE llama a next() sin argumentos", async () => {
    const userId = new mongoose.Types.ObjectId();
    await SubscriptionAccount.create({
      userId,
      planId: new mongoose.Types.ObjectId(),
      status: SubscriptionStatus.ACTIVE,
      cancelAtPeriodEnd: false,
    });
    const { req, res, next } = buildReqRes(userId.toString());
    await requireCapability("subscriber")(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("memoiza en req.capabilities: una segunda invocación en la misma request no vuelve a consultar la DB", async () => {
    const userId = new mongoose.Types.ObjectId();
    await SubscriptionAccount.create({
      userId,
      planId: new mongoose.Types.ObjectId(),
      status: SubscriptionStatus.ACTIVE,
      cancelAtPeriodEnd: false,
    });
    const { req, res, next } = buildReqRes(userId.toString());
    await requireCapability("subscriber")(req, res, next);
    expect(req.capabilities).toBeDefined();

    // Cambia el estado en DB — si el middleware releyera, vería PAUSED y
    // rechazaría; como reusa `req.capabilities` ya calculado, sigue aceptando
    // dentro de la MISMA request.
    await SubscriptionAccount.updateOne({ userId }, { $set: { status: SubscriptionStatus.PAUSED } });
    const next2 = vi.fn() as NextFunction;
    await requireCapability("subscriber")(req, res, next2);
    expect(next2).toHaveBeenCalledWith();
  });
});
