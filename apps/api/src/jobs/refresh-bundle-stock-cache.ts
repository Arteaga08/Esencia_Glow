import { BundleStatus } from "@esencia-glow/shared";
import { Bundle } from "../models/bundle.model.js";
import { computeBundleAvailability } from "../services/bundle-availability.service.js";
import { logger } from "../config/logger.js";

const DEFAULT_BATCH_SIZE = 100;

interface RefreshSummary {
  scanned: number;
  updated: number;
  failed: number;
}

/**
 * Función pura, invocable directo desde tests o desde `jobs/index.ts` (mismo
 * tick que `releaseExpiredReservations` — no es un cron nuevo, ver
 * esencia-glow-decisiones.md). `stockCache` es puramente informativo: un
 * bundle archivado no se refresca (nadie lo compra ya), y un fallo por
 * bundle nunca detiene el barrido de los demás.
 */
async function refreshBundleStockCaches(batchSize: number = DEFAULT_BATCH_SIZE): Promise<RefreshSummary> {
  const bundles = await Bundle.find({ status: { $ne: BundleStatus.ARCHIVED } })
    .select("items stockCache")
    .limit(batchSize)
    .lean();

  let updated = 0;
  let failed = 0;

  for (const bundle of bundles) {
    try {
      const stockCache = await computeBundleAvailability(bundle.items);
      if (stockCache !== bundle.stockCache) {
        await Bundle.updateOne({ _id: bundle._id }, { $set: { stockCache } });
        updated += 1;
      }
    } catch (error) {
      failed += 1;
      logger.error({ err: error, bundleId: bundle._id.toString() }, "Fallo al refrescar stockCache de bundle");
    }
  }

  return { scanned: bundles.length, updated, failed };
}

export { refreshBundleStockCaches };
export type { RefreshSummary };
