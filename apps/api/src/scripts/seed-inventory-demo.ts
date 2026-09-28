import { pathToFileURL } from "node:url";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { Inventory } from "../models/inventory.model.js";
import { StockReservation } from "../models/stock-reservation.model.js";
import { adjustStock, updateLowStockThreshold } from "../services/inventory.service.js";
import { commitReservation, releaseReservation, reserveStock } from "../services/stock-reservation.service.js";

const FORCE_FLAG = "--force";
const CART_REF_PREFIX = "seed-inv-";
/** Tres días: suficiente para probar la liberación forzada sin que el cron
 * de vencidas se adelante. */
const ACTIVE_TTL_MINUTES = 3 * 24 * 60;

/**
 * Seed de estados límite de inventario (Milestone 2.5), encima de
 * `seed:catalog`. El catálogo deja todo entre 18 y 40 unidades y sin
 * reservas; esto lleva algunas variantes a agotado y a stock bajo, y crea
 * apartados en los tres estados para la pestaña Apartados.
 *
 * "Sin registro" ya lo deja `seed:catalog` (`CON-REF-015` y `MAN-REP-075`
 * nacen con `initialStock: 0`, sin fila de `Inventory`), así que aquí no se
 * borra ninguna fila.
 *
 * Todo pasa por los servicios (`adjustStock`, `reserveStock`,
 * `commitReservation`, `releaseReservation`), nunca por escrituras directas:
 * así `Inventory.reserved` cuadra con las reservas `active` por
 * construcción, no porque el seed calcule bien la suma.
 *
 * Idempotente: si ya existe alguna reserva con `cartRef` que empiece por
 * `seed-inv-`, asume que ya corrió y no toca nada.
 */

/** Recuentos absolutos. Umbral global = 5 salvo override por SKU. */
const STOCK_COUNTS: { sku: string; onHand: number; lowStockThreshold?: number }[] = [
  { sku: "SER-CENT-030", onHand: 0 },
  { sku: "SPF-POL-008", onHand: 0 },
  { sku: "EXF-AVE-100", onHand: 3 },
  // 6 en mano - 2 apartados (reserva activa de abajo) = 4 disponibles: bajo.
  { sku: "LIMP-GEL-150", onHand: 6 },
  // Bajo por el override por SKU (12 <= 15), no por el umbral global.
  { sku: "CORP-SEC-100", onHand: 12, lowStockThreshold: 15 },
];

type ReservationOutcome = "active" | "committed" | "released";

const RESERVATIONS: { cartRef: string; outcome: ReservationOutcome; lines: { sku: string; quantity: number }[] }[] = [
  {
    cartRef: `${CART_REF_PREFIX}active-1`,
    outcome: "active",
    lines: [
      { sku: "LIMP-GEL-150", quantity: 2 },
      { sku: "SER-VITC-030", quantity: 1 },
    ],
  },
  { cartRef: `${CART_REF_PREFIX}active-2`, outcome: "active", lines: [{ sku: "CRE-NOCT-050", quantity: 1 }] },
  { cartRef: `${CART_REF_PREFIX}committed-1`, outcome: "committed", lines: [{ sku: "SER-VITC-030", quantity: 2 }] },
  { cartRef: `${CART_REF_PREFIX}released-1`, outcome: "released", lines: [{ sku: "BRU-HID-100", quantity: 1 }] },
];

interface SeedInventoryResult {
  outcome: "seeded" | "skipped";
  stockAdjusted: number;
  reservations: number;
}

async function resolveVariantId(sku: string): Promise<string> {
  const row = await Inventory.findOne({ sku }).select("variantId").lean();
  if (!row) {
    throw new Error(`No existe inventario para ${sku}. Corre primero seed:catalog.`);
  }
  return row.variantId.toString();
}

async function seedInventoryDemo(): Promise<SeedInventoryResult> {
  const alreadySeeded = await StockReservation.exists({ cartRef: { $regex: `^${CART_REF_PREFIX}` } });
  if (alreadySeeded) return { outcome: "skipped", stockAdjusted: 0, reservations: 0 };

  for (const count of STOCK_COUNTS) {
    const variantId = await resolveVariantId(count.sku);
    await adjustStock({ variantId, onHand: count.onHand });
    if (count.lowStockThreshold !== undefined) {
      await updateLowStockThreshold(variantId, count.lowStockThreshold);
    }
  }

  for (const reservation of RESERVATIONS) {
    const lines = await Promise.all(
      reservation.lines.map(async (line) => ({ variantId: await resolveVariantId(line.sku), quantity: line.quantity })),
    );
    const doc = await reserveStock({ cartRef: reservation.cartRef, lines, ttlMinutes: ACTIVE_TTL_MINUTES });
    if (reservation.outcome === "committed") await commitReservation(doc._id.toString());
    if (reservation.outcome === "released") await releaseReservation(doc._id.toString());
  }

  return { outcome: "seeded", stockAdjusted: STOCK_COUNTS.length, reservations: RESERVATIONS.length };
}

/** Entrypoint de CLI: `pnpm --filter api seed:inventory [--force en producción]`. */
async function main(): Promise<void> {
  if (env.isProduction && !process.argv.includes(FORCE_FLAG)) {
    throw new Error(`Seed rehusado en producción. Pasa ${FORCE_FLAG} si de verdad quieres correrlo aquí.`);
  }

  await connectDatabase();
  try {
    const result = await seedInventoryDemo();
    if (result.outcome === "skipped") {
      logger.info("Seed de inventario de demo: ya existía, no se tocó nada.");
    } else {
      logger.info(result, "Seed de inventario de demo completado");
    }
  } finally {
    await disconnectDatabase();
  }
}

const isMainModule =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      logger.error({ err: error }, "Fallo el seed de inventario de demo");
      process.exit(1);
    });
}

export { seedInventoryDemo };
