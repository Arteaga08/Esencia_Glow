import type { Types } from "mongoose";
import type { AccountDto, BillingInfo, SavedAddress } from "@esencia-glow/shared";
import type { MexicanState } from "@esencia-glow/shared";
import type { BillingInfoAttrs } from "../models/user.model.js";
import type { SavedAddressAttrs } from "../models/saved-address.schema.js";

/**
 * Único lugar que decide qué campos de `User` cruzan en `GET /account`. Recibe
 * una forma estructural (compatible con `.lean()`), nunca un documento
 * hidratado: un campo sensible (`password`, `twoFactor`, `sessionVersion`) no
 * tiene por dónde colarse.
 */
interface LeanAccountUser {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  birthDate?: Date;
  city?: string;
  addresses?: Array<SavedAddressAttrs & { _id: Types.ObjectId }>;
  billingInfo?: BillingInfoAttrs;
  wishlist?: Array<{ itemId: Types.ObjectId }>;
}

function buildSavedAddress(address: SavedAddressAttrs & { _id: Types.ObjectId }): SavedAddress {
  return {
    id: address._id.toString(),
    label: address.label,
    isDefault: address.isDefault,
    fullName: address.fullName,
    ...(address.firstName ? { firstName: address.firstName } : {}),
    ...(address.lastName ? { lastName: address.lastName } : {}),
    phone: address.phone,
    street: address.street,
    exteriorNumber: address.exteriorNumber,
    ...(address.interiorNumber ? { interiorNumber: address.interiorNumber } : {}),
    neighborhood: address.neighborhood,
    city: address.city,
    state: address.state as MexicanState,
    postalCode: address.postalCode,
    ...(address.references ? { references: address.references } : {}),
  };
}

function buildBillingInfo(info: BillingInfoAttrs | undefined): BillingInfo | null {
  if (!info) return null;
  return {
    rfc: info.rfc,
    legalName: info.legalName,
    cfdiUse: info.cfdiUse ?? null,
    fiscalRegime: info.fiscalRegime ?? null,
    postalCode: info.postalCode,
  };
}

function buildAccountDto(user: LeanAccountUser, wishlistCount: number): AccountDto {
  return {
    profile: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone ?? null,
      birthDate: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
      city: user.city ?? null,
    },
    addresses: (user.addresses ?? []).map(buildSavedAddress),
    billingInfo: buildBillingInfo(user.billingInfo),
    wishlistCount,
  };
}

const ACCOUNT_SELECT = "email firstName lastName phone birthDate city addresses billingInfo wishlist";

export { buildAccountDto, buildSavedAddress, buildBillingInfo, ACCOUNT_SELECT };
export type { LeanAccountUser };
