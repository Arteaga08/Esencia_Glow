import { createHash } from "node:crypto";
import type { Types } from "mongoose";
import type { AuthAction, InventoryAction } from "@esencia-glow/shared";
import { AuditLog } from "../models/audit-log.model.js";
import { logger } from "../config/logger.js";

/**
 * Registro de auditoría best-effort: un fallo al escribir el log nunca debe
 * tumbar la request que lo originó (BACKEND_ARCHITECTURE_GUIDELINES.md §11 —
 * "nunca fallan en silencio", pero aquí el propio log es secundario al
 * efecto principal de la acción, así que se loguea el fallo y se continúa).
 *
 * `action` acepta `AuthAction | InventoryAction`: un solo trail para todo el
 * backend (ver audit-log.model.ts).
 */

interface RecordAuditInput {
  action: AuthAction | InventoryAction;
  actorId?: Types.ObjectId | string;
  targetId?: Types.ObjectId | string;
  ip?: string;
  metadata?: Record<string, string | number | boolean>;
}

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    await AuditLog.create({
      action: input.action,
      actorId: input.actorId,
      targetId: input.targetId,
      ipHash: input.ip ? hashIp(input.ip) : undefined,
      metadata: input.metadata,
    });
  } catch (error) {
    logger.error({ err: error, action: input.action }, "Fallo al registrar audit log");
  }
}

export { recordAudit };
