import type { Types } from "mongoose";
import type { ReservationStatus } from "@esencia-glow/shared";

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
}

interface AdminReservation {
  id: string;
  cartRef: string;
  userId?: string;
  lines: { variantId: string; sku: string; quantity: number }[];
  status: ReservationStatus;
  expiresAt: string;
  purgeAt?: string;
}

function buildAdminInventoryRow(row: LeanInventoryRow): AdminInventoryRow {
  return {
    id: row._id.toString(),
    productId: row.productId.toString(),
    variantId: row.variantId.toString(),
    sku: row.sku,
    onHand: row.onHand,
    reserved: row.reserved,
    available: row.onHand - row.reserved,
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
  };
}

export { buildAdminInventoryRow, buildAdminReservation };
export type { AdminInventoryRow, AdminReservation, LeanInventoryRow, LeanReservation };
