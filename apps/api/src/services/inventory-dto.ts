import type { Types } from "mongoose";
import type { StockStatus} from "@esencia-glow/shared";
import { type ReservationStatus } from "@esencia-glow/shared";
import { resolveEffectiveThreshold, resolveStockStatus } from "./inventory-status.js";

/**
 * DTO de inventario/reservas para el dashboard admin. Igual que
 * catalog-dto.ts: recibe formas estructurales (lean o hidratadas — ambas
 * exponen los mismos campos de lectura), nunca decide nada de negocio.
 */
interface LeanInventoryRow {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  sku: string;
  onHand: number;
  reserved: number;
  lowStockThreshold?: number;
  lastRestockedAt?: Date;
}

interface AdminInventoryRow {
  id: string;
  productId: string;
  variantId: string;
  sku: string;
  onHand: number;
  reserved: number;
  /** onHand - reserved. Derivado siempre, nunca persistido. */
  available: number;
  /** Override por SKU, o `null` si no tiene (usa el default global). */
  lowStockThreshold: number | null;
  /** Override si existe, si no el default global de Settings — resuelto en el servidor. */
  effectiveLowStockThreshold: number;
  status: StockStatus;
  lastRestockedAt: string | null;
}

interface LeanReservationLine {
  variantId: Types.ObjectId;
  sku: string;
  quantity: number;
}

interface LeanReservation {
  _id: Types.ObjectId;
  cartRef: string;
  userId?: Types.ObjectId;
  lines: LeanReservationLine[];
  status: ReservationStatus;
  expiresAt: Date;
  purgeAt?: Date;
  committedAt?: Date;
  releasedAt?: Date;
}

interface AdminReservation {
  id: string;
  cartRef: string;
  userId?: string;
  lines: { variantId: string; sku: string; quantity: number }[];
  status: ReservationStatus;
  expiresAt: string;
  purgeAt?: string;
  committedAt?: string;
  releasedAt?: string;
}

/**
 * `globalLowStockThreshold` viene del caller (settings.service.ts) — este DTO
 * nunca lee Settings por su cuenta.
 */
function buildAdminInventoryRow(
  row: LeanInventoryRow,
  globalLowStockThreshold: number,
): AdminInventoryRow {
  const available = row.onHand - row.reserved;
  const effectiveLowStockThreshold = resolveEffectiveThreshold(
    row.lowStockThreshold,
    globalLowStockThreshold,
  );

  return {
    id: row._id.toString(),
    productId: row.productId.toString(),
    variantId: row.variantId.toString(),
    sku: row.sku,
    onHand: row.onHand,
    reserved: row.reserved,
    available,
    lowStockThreshold: row.lowStockThreshold ?? null,
    effectiveLowStockThreshold,
    status: resolveStockStatus(available, effectiveLowStockThreshold),
    lastRestockedAt: row.lastRestockedAt ? row.lastRestockedAt.toISOString() : null,
  };
}

function buildAdminReservation(reservation: LeanReservation): AdminReservation {
  return {
    id: reservation._id.toString(),
    cartRef: reservation.cartRef,
    ...(reservation.userId ? { userId: reservation.userId.toString() } : {}),
    lines: reservation.lines.map((line) => ({
      variantId: line.variantId.toString(),
      sku: line.sku,
      quantity: line.quantity,
    })),
    status: reservation.status,
    expiresAt: reservation.expiresAt.toISOString(),
    ...(reservation.purgeAt ? { purgeAt: reservation.purgeAt.toISOString() } : {}),
    ...(reservation.committedAt ? { committedAt: reservation.committedAt.toISOString() } : {}),
    ...(reservation.releasedAt ? { releasedAt: reservation.releasedAt.toISOString() } : {}),
  };
}

export { buildAdminInventoryRow, buildAdminReservation };
export type { AdminInventoryRow, AdminReservation, LeanInventoryRow, LeanReservation };
