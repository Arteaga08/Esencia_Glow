import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";

/**
 * Tokens de un solo uso para verificación de email y reset de contraseña.
 * Un solo modelo con `type` discriminante en vez de dos colecciones: la
 * forma del documento es idéntica y el uso siempre es exclusivo por `type`.
 *
 * Igual que Session: se guarda el hash del token, nunca el valor crudo. El
 * uso único se garantiza con un `findOneAndUpdate` condicionado a
 * `usedAt: null` (ver services/account.service.ts) — nunca un
 * find-then-update en dos pasos.
 */

type VerificationTokenType = "email_verification" | "password_reset";

interface VerificationTokenAttrs {
  userId: Types.ObjectId;
  tokenHash: string;
  type: VerificationTokenType;
  expiresAt: Date;
  usedAt?: Date;
}

type VerificationTokenDocument = HydratedDocument<VerificationTokenAttrs>;
type VerificationTokenModel = Model<VerificationTokenAttrs>;

const verificationTokenSchema = new Schema<VerificationTokenAttrs, VerificationTokenModel>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    type: { type: String, enum: ["email_verification", "password_reset"], required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
  },
  { timestamps: true },
);

verificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const VerificationToken = model<VerificationTokenAttrs, VerificationTokenModel>(
  "VerificationToken",
  verificationTokenSchema,
);

export { VerificationToken };
export type { VerificationTokenDocument, VerificationTokenAttrs, VerificationTokenType };
