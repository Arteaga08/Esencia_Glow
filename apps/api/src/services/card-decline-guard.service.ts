import type { Types } from "mongoose";
import { ACCOUNT_CARD_DECLINE_WINDOW_HOURS, AuthAction, ErrorCode, MAX_ACCOUNT_CARD_DECLINES } from "@esencia-glow/shared";
import { User } from "../models/user.model.js";
import { AppError } from "../utils/app-error.js";
import { recordAudit } from "./audit.service.js";

/**
 * Tope anti card-testing POR CUENTA (auditoría run-2, hallazgos 7 y 8). El tope
 * de 5 por pedido se reinicia con cada pedido nuevo, así que sin esto una sola
 * cuenta podía probar tarjetas robadas sin límite cerrando y abriendo pedidos
 * (o altas de suscripción). Cada rechazo de tarjeta ya contado (pedido o factura
 * de alta) suma aquí; quien llama solo lo suma una vez por evento, porque su
 * propio dedupe por `eventId` ya decidió que el rechazo es nuevo.
 *
 * Ventana fija, calco del bloqueo TOTP (`two-factor.service.ts`): arranca con el
 * primer rechazo y dura `ACCOUNT_CARD_DECLINE_WINDOW_HOURS`; al vencer, el
 * siguiente rechazo abre una ventana nueva desde 1.
 */
const WINDOW_MS = ACCOUNT_CARD_DECLINE_WINDOW_HOURS * 60 * 60 * 1000;

const LOCKED_MESSAGE =
  "Por seguridad pausamos los pagos con tarjeta de tu cuenta por unas horas. Si necesitas ayuda, escríbenos por WhatsApp.";

/** Suma un rechazo a la ventana de la cuenta, en una sola escritura atómica
 * (dos webhooks concurrentes nunca pierden una suma). Audita una sola vez: el
 * rechazo que deja el conteo exactamente en el tope. */
async function recordAccountCardDecline(userId: Types.ObjectId | string, now: Date = new Date()): Promise<void> {
  const windowExpiredBefore = new Date(now.getTime() - WINDOW_MS);
  const windowIsStale = {
    $or: [
      { $eq: [{ $ifNull: ["$cardDeclineWindow.startedAt", null] }, null] },
      { $lte: ["$cardDeclineWindow.startedAt", windowExpiredBefore] },
    ],
  };

  const updated = await User.findOneAndUpdate(
    { _id: userId },
    [
      {
        $set: {
          cardDeclineWindow: {
            $cond: [
              windowIsStale,
              { count: 1, startedAt: now },
              {
                count: { $add: [{ $ifNull: ["$cardDeclineWindow.count", 0] }, 1] },
                startedAt: "$cardDeclineWindow.startedAt",
              },
            ],
          },
        },
      },
    ],
    { new: true, projection: { cardDeclineWindow: 1 } },
  ).lean();

  if (updated?.cardDeclineWindow?.count === MAX_ACCOUNT_CARD_DECLINES) {
    await recordAudit({
      action: AuthAction.CARD_PAYMENTS_LOCKED,
      targetId: userId,
      metadata: { declines: MAX_ACCOUNT_CARD_DECLINES },
    });
  }
}

/** 429 si la cuenta llegó al tope y su ventana sigue vigente. Va ANTES de
 * entregar cualquier `client_secret` (pedido nuevo, reanudar pago, alta). */
async function assertCardPaymentsAllowed(userId: Types.ObjectId | string, now: Date = new Date()): Promise<void> {
  const user = await User.findById(userId).select("+cardDeclineWindow").lean();
  const window = user?.cardDeclineWindow;
  if (!window) return;
  const isCurrent = window.startedAt.getTime() > now.getTime() - WINDOW_MS;
  if (isCurrent && window.count >= MAX_ACCOUNT_CARD_DECLINES) {
    throw new AppError(LOCKED_MESSAGE, 429, undefined, ErrorCode.CARD_PAYMENTS_LOCKED);
  }
}

export { recordAccountCardDecline, assertCardPaymentsAllowed };
