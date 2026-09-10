import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { logger } from "../config/logger.js";
import { Product } from "../models/product.model.js";
import { ensureInventoryRow } from "../services/inventory.service.js";

/**
 * Crea la fila de inventario (0/0) de cada variante que aún no tenga una —
 * productos sembrados antes de 1.4. Idempotente por construcción:
 * `ensureInventoryRow` hace upsert con `$setOnInsert`, así que correrlo dos
 * veces sobre el mismo catálogo no crea duplicados ni pisa `onHand`/`reserved`
 * ya existentes.
 */
async function backfillInventory(): Promise<{ productsScanned: number; rowsEnsured: number }> {
  const products = await Product.find().lean();
  let rowsEnsured = 0;

  for (const product of products) {
    for (const variant of product.variants) {
      await ensureInventoryRow({ productId: product._id, variantId: variant._id, sku: variant.sku });
      rowsEnsured += 1;
    }
  }

  return { productsScanned: products.length, rowsEnsured };
}

/**
 * Entrypoint de CLI separado de `backfillInventory()`: importar este módulo
 * desde un test no debe conectar a la base ni llamar `process.exit` — el
 * mismo problema que tendría reusar el patrón de `seed-admin.ts` tal cual.
 */
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  connectDatabase()
    .then(backfillInventory)
    .then(async (summary) => {
      logger.info(summary, "Backfill de inventario completado");
      await disconnectDatabase();
      process.exit(0);
    })
    .catch((error: unknown) => {
      logger.error({ err: error }, "Fallo el backfill de inventario");
      process.exit(1);
    });
}

export { backfillInventory };
