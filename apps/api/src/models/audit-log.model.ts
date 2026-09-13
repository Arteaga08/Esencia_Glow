import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";
import { AuthAction, InventoryAction, OrderAction, SubscriptionAction } from "@esencia-glow/shared";

/**
 * Audit trail append-only de acciones sensibles (auth: login, cambio de
 * contraseña, 2FA, revocación de sesiones; inventario: ajustes manuales de
 * stock, ciclo de vida de reservas; órdenes: checkout, cancelación, cambios
 * de estatus/admin; suscripciones: planes, ediciones y el ciclo de vida de
 * la cuenta). Nunca guarda PII ni secretos: ni email en claro, ni tokens, ni
 * contraseñas — solo identificadores y metadata acotada. El registro es
 * best-effort (ver services/audit.service.ts): un fallo aquí nunca debe
 * tumbar la request que lo originó.
 *
 * `action` acepta la unión de `AuthAction`, `InventoryAction`, `OrderAction`
 * y `SubscriptionAction` — un solo trail para todo el backend en vez de una
 * colección por dominio. `targetId` ya no fija `ref: "User"`: en inventario
 * apunta a una reserva o una variante, en órdenes a una `Order`, en
 * suscripciones a un `Plan`/`Edition`/`SubscriptionAccount`, no
 * necesariamente a un usuario, y ningún código hace `populate()` sobre él.
 */
type AuditAction = AuthAction | InventoryAction | OrderAction | SubscriptionAction;

interface AuditLogAttrs {
  action: AuditAction;
  actorId?: Types.ObjectId;
  targetId?: Types.ObjectId;
  ipHash?: string;
  metadata?: Record<string, string | number | boolean>;
}

type AuditLogDocument = HydratedDocument<AuditLogAttrs>;
type AuditLogModel = Model<AuditLogAttrs>;

const AUDIT_ACTIONS = [
  ...Object.values(AuthAction),
  ...Object.values(InventoryAction),
  ...Object.values(OrderAction),
  ...Object.values(SubscriptionAction),
];

const auditLogSchema = new Schema<AuditLogAttrs, AuditLogModel>(
  {
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    targetId: { type: Schema.Types.ObjectId },
    ipHash: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const AuditLog = model<AuditLogAttrs, AuditLogModel>("AuditLog", auditLogSchema);

export { AuditLog };
export type { AuditLogDocument, AuditLogAttrs, AuditAction };
