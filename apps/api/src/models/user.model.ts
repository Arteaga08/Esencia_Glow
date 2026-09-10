import bcrypt from "bcrypt";
import { Schema, model, type HydratedDocument, type Model } from "mongoose";
import { UserRole } from "@esencia-glow/shared";

/**
 * Identidad + auth + flag de staff. Documento ligero: direcciones, orden de
 * compra y suscripción son documentos propios ligados por `userId` en
 * milestones posteriores — no crecen este modelo.
 *
 * `password` y `twoFactor.secret` van `select: false`
 * (BACKEND_SECURITY_GUIDELINES.md §1-2): se recuperan explícitamente con
 * `.select("+password")` / `.select("+twoFactor.secret")` solo donde se
 * necesitan. `sessionVersion` se incrementa para invalidar en masa todos los
 * access tokens ya emitidos (reset de contraseña, desactivar 2FA).
 */

const SALT_ROUNDS = 12;

interface TwoFactorSubdocument {
  secret?: string;
  enabled: boolean;
  pendingSince?: Date;
}

interface UserAttrs {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  emailVerified: boolean;
  sessionVersion: number;
  twoFactor: TwoFactorSubdocument;
  passwordChangedAt?: Date;
}

interface UserMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

type UserDocument = HydratedDocument<UserAttrs, UserMethods>;
type UserModel = Model<UserAttrs, object, UserMethods>;

const twoFactorSchema = new Schema<TwoFactorSubdocument>(
  {
    secret: { type: String, select: false },
    enabled: { type: Boolean, default: false },
    pendingSince: { type: Date },
  },
  { _id: false },
);

const userSchema = new Schema<UserAttrs, UserModel, UserMethods>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
      minlength: 10,
    },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.CUSTOMER,
    },
    emailVerified: { type: Boolean, default: false },
    sessionVersion: { type: Number, default: 0 },
    twoFactor: { type: twoFactorSchema, default: () => ({ enabled: false }) },
    passwordChangedAt: { type: Date },
  },
  { timestamps: true },
);

userSchema.pre("save", async function hashPasswordIfModified(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
  // Un access token emitido antes de este cambio deja de ser válido — ver
  // middlewares/protect.ts, que compara `passwordChangedAt` contra `iat`
  // (segundos, no ms). Se redondea al segundo para que un access token
  // reemitido inmediatamente después de este save (ver
  // services/account.service.ts changePassword) nunca caiga en el mismo
  // segundo por un lado de la comparación y el otro por el otro.
  if (!this.isNew) this.passwordChangedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

const User = model<UserAttrs, UserModel>("User", userSchema);

export { User, SALT_ROUNDS };
export type { UserDocument, UserAttrs, TwoFactorSubdocument };
