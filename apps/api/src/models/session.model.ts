import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";

/**
 * Refresh tokens: opacos, guardados hasheados (nunca el valor crudo), con
 * rotación atómica y detección de reuso vía `familyId`
 * (BACKEND_SECURITY_GUIDELINES.md §11). Cada rotación exitosa marca la
 * sesión vieja como `revokedAt` y crea una nueva con el mismo `familyId`; si
 * llega un refresh ya revocado, toda la familia se considera comprometida y
 * se revoca completa (ver services/session.service.ts).
 *
 * Índice TTL sobre `expiresAt`: Mongo limpia sesiones vencidas sin cron.
 */

interface SessionAttrs {
  userId: Types.ObjectId;
  tokenHash: string;
  familyId: string;
  userAgent?: string;
  ipHash?: string;
  expiresAt: Date;
  revokedAt?: Date;
  rotatedAt?: Date;
}

type SessionDocument = HydratedDocument<SessionAttrs>;
type SessionModel = Model<SessionAttrs>;

const sessionSchema = new Schema<SessionAttrs, SessionModel>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    familyId: { type: String, required: true, index: true },
    userAgent: { type: String },
    ipHash: { type: String },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    rotatedAt: { type: Date },
  },
  { timestamps: true },
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Session = model<SessionAttrs, SessionModel>("Session", sessionSchema);

export { Session };
export type { SessionDocument, SessionAttrs };
