import type { PublicShippingAddress } from "./shipping.js";

/**
 * DTO de "Mi Cuenta" (`GET /account`). Un solo shape completo: a diferencia de
 * un perfil social, no hay versión pública del perfil de una clienta.
 */
interface AccountProfile {
  firstName: string;
  lastName: string;
  /** Solo lectura: cambiar el correo es otro flujo (no existe todavía). */
  email: string;
  phone: string | null;
  /** Fecha ISO `YYYY-MM-DD`. */
  birthDate: string | null;
  city: string | null;
}

/** Misma forma que la dirección de envío del checkout + etiqueta y principal. */
interface SavedAddress extends PublicShippingAddress {
  id: string;
  label: string;
  isDefault: boolean;
}

/** Capturados para el día que exista facturación; hoy no se timbra nada. */
interface BillingInfo {
  rfc: string;
  legalName: string;
  cfdiUse: string | null;
  fiscalRegime: string | null;
  /** CP fiscal: distinto del de envío. */
  postalCode: string;
}

interface AccountDto {
  profile: AccountProfile;
  addresses: SavedAddress[];
  billingInfo: BillingInfo | null;
  wishlistCount: number;
}

/** Un guardado ya hidratado contra el catálogo vivo. */
interface WishlistItem {
  itemType: "product";
  itemId: string;
  slug: string;
  name: string;
  brand?: string;
  image?: { url: string; alt?: string };
  /** Centavos del precio más bajo entre las variantes activas. */
  priceCents: number;
  listPriceCents?: number;
  /** Etiqueta de la variante más barata (p. ej. "30 ml"). */
  variantLabel?: string;
  available: boolean;
  addedAt: string;
}

/** Respuesta de `GET /account/wishlist?itemId=`: ¿está guardado este producto? */
interface WishlistMembership {
  saved: boolean;
}

export type { AccountProfile, SavedAddress, BillingInfo, AccountDto, WishlistItem, WishlistMembership };
