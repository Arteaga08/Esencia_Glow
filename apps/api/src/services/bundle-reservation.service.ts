import { BundleStatus } from "@esencia-glow/shared";
import { Bundle, type BundleAttrs } from "../models/bundle.model.js";
import { AppError } from "../utils/app-error.js";
import { reserveStock, type ReserveStockLineInput } from "./stock-reservation.service.js";
import type { StockReservationDocument } from "../models/stock-reservation.model.js";

interface ReserveBundleStockInput {
  bundleId: string;
  quantity: number;
  cartRef: string;
  userId?: string;
  ttlMinutes: number;
}

/**
 * Expande `quantity` unidades de un bundle a líneas de reserva por variante
 * (`item.quantity × quantity`). No es el punto que decide disponibilidad —
 * eso sigue siendo el `$expr` atómico de `reserveStock`, línea por línea; ver
 * bundle-availability.service.ts para el cálculo de solo-lectura que sí
 * alimenta `stockCache`.
 */
function buildBundleReservationLines(
  items: BundleAttrs["items"],
  quantity: number,
): ReserveStockLineInput[] {
  return items.map((item) => ({
    variantId: item.variantId.toString(),
    quantity: item.quantity * quantity,
  }));
}

/**
 * Único punto que conecta un bundle al motor de reservas de 1.4:
 * `reserveStock` ya deduplica por variante y revierte todo si un componente
 * no alcanza (garantía probada en 1.4, no se repite aquí). `sourceBundles` es
 * el gancho de trazabilidad dejado en `StockReservation` — nunca alimenta un
 * `$inc`, solo describe de dónde vino la línea. Sin superficie HTTP todavía:
 * no hay carrito ni webhook de pago que la dispare (1.5 la conecta), mismo
 * criterio que `reserveStock`/`commitReservation` en 1.4.
 */
async function reserveBundleStock(
  input: ReserveBundleStockInput,
): Promise<StockReservationDocument> {
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new AppError("La cantidad de paquetes debe ser un entero mayor a 0", 400);
  }

  const bundle = await Bundle.findOne({ _id: input.bundleId, status: BundleStatus.ACTIVE });
  if (!bundle) throw new AppError("Paquete no disponible", 404);

  return reserveStock({
    cartRef: input.cartRef,
    userId: input.userId,
    lines: buildBundleReservationLines(bundle.items, input.quantity),
    ttlMinutes: input.ttlMinutes,
    sourceBundles: [{ bundleId: bundle.id, quantity: input.quantity }],
  });
}

export { reserveBundleStock, buildBundleReservationLines };
export type { ReserveBundleStockInput };
