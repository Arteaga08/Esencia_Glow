import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";
import { AuthAction } from "@esencia-glow/shared";

/**
 * Audit trail append-only de acciones sensibles de auth (login, cambio de
 * contraseña, activar/desactivar 2FA, revocación de sesiones). Nunca guarda
 * PII ni secretos: ni email en claro, ni tokens, ni contraseñas — solo
 * identificadores y metadata acotada. El registro es best-effort (ver
 * services/audit.service.ts): un fallo aquí nunca debe tumbar la request que
 * lo originó.
 *
 * `AuthAction` vive en `@esencia-glow/shared` para que el dashboard admin
 * (Milestone 2) muestre el audit trail con el mismo vocabulario del backend.
 */

interface AuditLogAttrs {
  action: AuthAction;
  actorId?: Types.ObjectId;
  targetId?: Types.ObjectId;
  ipHash?: string;
  metadata?: Record<string, string | number | boolean>;
}

type AuditLogDocument = HydratedDocument<AuditLogAttrs>;
type AuditLogModel = Model<AuditLogAttrs>;

const auditLogSchema = new Schema<AuditLogAttrs, AuditLogModel>(
  {
    action: { type: String, enum: Object.values(AuthAction), required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    targetId: { type: Schema.Types.ObjectId, ref: "User" },
    ipHash: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const AuditLog = model<AuditLogAttrs, AuditLogModel>("AuditLog", auditLogSchema);

export { AuditLog };
export type { AuditLogDocument, AuditLogAttrs };
