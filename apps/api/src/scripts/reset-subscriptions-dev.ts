import { pathToFileURL } from "node:url";
import mongoose from "mongoose";
import { ProductChannel } from "@esencia-glow/shared";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { logger } from "../config/logger.js";
import { Inventory } from "../models/inventory.model.js";
import { Product } from "../models/product.model.js";
import { SubscriptionAccount } from "../models/subscription-account.model.js";
import { SubscriptionEdition } from "../models/subscription-edition.model.js";
import { SubscriptionInvoice } from "../models/subscription-invoice.model.js";
import { SubscriptionPlan } from "../models/subscription-plan.model.js";
import { SubscriptionShipment } from "../models/subscription-shipment.model.js";

/**
 * Limpia TODO lo de suscripción de la base de DESARROLLO (Milestone 3.1.7b)
 * para volver a sembrar una caja nueva: planes, ediciones, cuentas, facturas
 * de suscripción, cajas (envíos) y los productos canal `subscription` del seed
 * con su inventario.
 *
 * NO toca: usuarias/clientas demo, catálogo de tienda (canal `store`/`both`),
 * `Settings` ni `AuditLog` (histórico append-only). Los Products/Prices que
 * las pruebas dejaron en Stripe (modo test) quedan huérfanos, inofensivos.
 *
 * Seguridad: se niega a correr fuera de `NODE_ENV=development` o sobre una
 * base cuyo nombre no termine en `_dev`, y por default
 * solo IMPRIME conteos (dry-run); borra únicamente con `--confirm`.
 *
 * Antes de borrar las cajas libera de `Inventory.reserved` lo que cada una
 * apartó y aún no salió (sin `stockCommittedAt` ni `canceledAt`), salvo en el
 * inventario que se borra junto con su producto: así ningún producto de
 * tienda queda con stock apartado por una caja que ya no existe.
 *
 * Uso: `pnpm reset:subscriptions` (dry-run) · `pnpm reset:subscriptions --confirm`.
 */

/** Slugs de los productos del seed (`seed-subscriptions-demo.ts`). */
const SEED_PRODUCT_SLUG_PREFIX = "demo-sub-";

interface ResetCounts {
  plans: number;
  editions: number;
  accounts: number;
  invoices: number;
  shipments: number;
  products: number;
  inventories: number;
}

async function findSeedProductIds(): Promise<string[]> {
  const products = await Product.find({
    channel: ProductChannel.SUBSCRIPTION,
    slug: { $regex: `^${SEED_PRODUCT_SLUG_PREFIX}` },
  })
    .select("_id")
    .lean();
  return products.map((product) => product._id.toString());
}

async function countTargets(productIds: string[]): Promise<ResetCounts> {
  const [plans, editions, accounts, invoices, shipments, inventories] = await Promise.all([
    SubscriptionPlan.countDocuments({}),
    SubscriptionEdition.countDocuments({}),
    SubscriptionAccount.countDocuments({}),
    SubscriptionInvoice.countDocuments({}),
    SubscriptionShipment.countDocuments({}),
    Inventory.countDocuments({ productId: { $in: productIds } }),
  ]);
  return { plans, editions, accounts, invoices, shipments, products: productIds.length, inventories };
}

/** Devuelve a `Inventory.reserved` lo apartado por cajas que no han salido,
 * excepto en el inventario de los productos que se van a borrar. */
async function releaseOutstandingReservations(productIds: string[]): Promise<number> {
  const outstanding = await SubscriptionShipment.find({
    reservedItems: { $exists: true, $ne: [] },
    stockCommittedAt: { $exists: false },
    canceledAt: { $exists: false },
  })
    .select("reservedItems")
    .lean();

  let released = 0;
  for (const shipment of outstanding) {
    for (const item of shipment.reservedItems) {
      const result = await Inventory.updateOne(
        { variantId: item.variantId, productId: { $nin: productIds }, reserved: { $gte: item.quantity } },
        { $inc: { reserved: -item.quantity } },
      );
      released += result.modifiedCount;
    }
  }
  return released;
}

async function resetSubscriptionsDev(confirm: boolean): Promise<ResetCounts> {
  const productIds = await findSeedProductIds();
  const counts = await countTargets(productIds);
  logger.info(counts, confirm ? "Se borrará:" : "Dry-run — esto se borraría con --confirm:");
  if (!confirm) return counts;

  const released = await releaseOutstandingReservations(productIds);
  await SubscriptionShipment.deleteMany({});
  await SubscriptionInvoice.deleteMany({});
  await SubscriptionAccount.deleteMany({});
  await SubscriptionEdition.deleteMany({});
  await SubscriptionPlan.deleteMany({});
  await Inventory.deleteMany({ productId: { $in: productIds } });
  await Product.deleteMany({ _id: { $in: productIds } });

  logger.info({ ...counts, reservationsReleased: released }, "Suscripciones de desarrollo borradas");
  return counts;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("reset:subscriptions solo corre con NODE_ENV=development.");
  }
  await connectDatabase();
  try {
    // Segunda barrera tras `NODE_ENV`: aunque un `.env` apunte por error al
    // clúster compartido, el borrado solo corre sobre una base `*_dev`.
    const databaseName = mongoose.connection.name;
    if (!databaseName.endsWith("_dev")) {
      throw new Error(`reset:subscriptions se niega a correr sobre la base "${databaseName}" (debe terminar en _dev).`);
    }
    await resetSubscriptionsDev(process.argv.includes("--confirm"));
  } finally {
    await disconnectDatabase();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    logger.error({ err: error }, "reset:subscriptions falló");
    process.exitCode = 1;
  });
}

export { resetSubscriptionsDev };
export type { ResetCounts };
