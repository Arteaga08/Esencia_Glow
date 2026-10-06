import bcrypt from "bcrypt";
import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";
import { CFDI_USES, FISCAL_REGIMES, RFC_PATTERN, UserRole } from "@esencia-glow/shared";
import { savedAddressSchema, type SavedAddressAttrs } from "./saved-address.schema.js";

/**
 * Identidad + auth + flag de staff + perfil de "Mi Cuenta" (3.5b). Las
 * colecciones chicas y acotadas por clienta (libreta de direcciones, máx. 5;
 * guardados, máx. 50) van embebidas con su tope; las órdenes y la suscripción
 * siguen siendo documentos propios ligados por `userId` — no crecen este modelo.
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

interface BillingInfoAttrs {
  rfc: string;
  legalName: string;
  cfdiUse?: string;
  fiscalRegime?: string;
  postalCode: string;
}

interface WishlistEntryAttrs {
  itemType: "product";
  itemId: Types.ObjectId;
  addedAt: Date;
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
  phone?: string;
  birthDate?: Date;
  city?: string;
  addresses: SavedAddressAttrs[];
  billingInfo?: BillingInfoAttrs;
  wishlist: WishlistEntryAttrs[];
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

// Todo opcional de punta a punta: se captura para no pedirlo de nuevo, hoy no se
// timbra ninguna factura con estos datos.
const billingInfoSchema = new Schema<BillingInfoAttrs>(
  {
    rfc: { type: String, required: true, trim: true, uppercase: true, match: RFC_PATTERN },
    legalName: { type: String, required: true, trim: true, maxlength: 200 },
    cfdiUse: { type: String, enum: CFDI_USES.map((option) => option.value) },
    fiscalRegime: { type: String, enum: FISCAL_REGIMES.map((option) => option.value) },
    postalCode: { type: String, required: true, trim: true, match: /^\d{5}$/ },
  },
  { _id: false },
);

const wishlistEntrySchema = new Schema<WishlistEntryAttrs>(
  {
    itemType: { type: String, enum: ["product"], required: true },
    itemId: { type: Schema.Types.ObjectId, required: true },
    addedAt: { type: Date, default: Date.now },
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
    phone: { type: String, trim: true, match: /^\d{10}$/ },
    birthDate: { type: Date },
    city: { type: String, trim: true, maxlength: 120 },
    addresses: { type: [savedAddressSchema], default: [] },
    billingInfo: { type: billingInfoSchema },
    wishlist: { type: [wishlistEntrySchema], default: [] },
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

// Milestone 2.6: el listado admin de Clientes filtra por `{role: customer}`
// y ordena por `createdAt` default — sin este índice, ese filtro+sort
// escanearía la colección completa a medida que crezca.
userSchema.index({ role: 1, createdAt: -1 });

const User = model<UserAttrs, UserModel>("User", userSchema);

export { User, SALT_ROUNDS };
export type { UserDocument, UserAttrs, TwoFactorSubdocument, BillingInfoAttrs, WishlistEntryAttrs };
