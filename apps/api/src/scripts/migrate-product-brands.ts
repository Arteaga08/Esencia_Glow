import { pathToFileURL } from "node:url";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { logger } from "../config/logger.js";
import { Brand } from "../models/brand.model.js";
import { Product } from "../models/product.model.js";

/**
 * Migra la marca de texto libre (`Product.brand`) al catálogo de marcas:
 * crea una `Brand` por cada nombre distinto (sin distinguir mayúsculas ni
 * acentos) y enlaza el producto con `brandId`. Idempotente: solo toca
 * productos con `brand` y sin `brandId`. Conserva el texto original del
 * producto como nombre de la marca la primera vez que aparece.
 */
async function migrateProductBrands(): Promise<{ linked: number; created: number }> {
  const products = await Product.find({
    brand: { $exists: true, $ne: "" },
    $or: [{ brandId: null }, { brandId: { $exists: false } }],
  }).select("brand");

  let linked = 0;
  let created = 0;
  for (const product of products) {
    const name = product.brand!.trim();
    let brand = await Brand.findOne({ name }).collation({ locale: "es", strength: 1 });
    if (!brand) {
      brand = await Brand.create({ name });
      created += 1;
    }
    await Product.updateOne({ _id: product._id }, { $set: { brandId: brand._id, brand: brand.name } });
    linked += 1;
  }
  return { linked, created };
}

const isMainModule =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  connectDatabase()
    .then(migrateProductBrands)
    .then(async ({ linked, created }) => {
      logger.info({ linked, created }, "Marcas de producto migradas");
      await disconnectDatabase();
      process.exit(0);
    })
    .catch(async (error) => {
      logger.error({ err: error }, "Falló la migración de marcas");
      await disconnectDatabase().catch(() => undefined);
      process.exit(1);
    });
}

export { migrateProductBrands };
