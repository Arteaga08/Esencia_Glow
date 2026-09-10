import { Types } from "mongoose";
import { ProductStatus } from "@esencia-glow/shared";
import { Inventory } from "../models/inventory.model.js";
import { Product } from "../models/product.model.js";

interface BundleAvailabilityItem {
  productId: Types.ObjectId | string;
  variantId: Types.ObjectId | string;
  quantity: number;
}

/**
 * Cuántos bundles se podrían armar HOY con el stock de sus componentes:
 * min sobre `floor(available_i / quantity_i)`, tratando un producto
 * archivado o una variante inactiva como disponibilidad 0 (igual que
 * `assertVariantsAvailable` en stock-reservation.service.ts, pero de solo
 * lectura — este resultado nunca decide una venta, solo alimenta
 * `Bundle.stockCache`, una caché de display). Un componente sin fila de
 * `Inventory` (no debería pasar para una variante existente) también cuenta
 * como 0 en vez de reventar el cálculo completo.
 */
async function computeBundleAvailability(items: BundleAvailabilityItem[]): Promise<number> {
  if (items.length === 0) return 0;

  const variantIds = items.map((item) => new Types.ObjectId(item.variantId));
  const productIds = [...new Set(items.map((item) => item.productId.toString()))].map(
    (id) => new Types.ObjectId(id),
  );

  const [inventoryRows, products] = await Promise.all([
    Inventory.find({ variantId: { $in: variantIds } })
      .select("variantId onHand reserved")
      .lean(),
    Product.find({ _id: { $in: productIds } })
      .select("status variants._id variants.isActive")
      .lean(),
  ]);

  const inventoryByVariant = new Map(
    inventoryRows.map((row) => [row.variantId.toString(), row]),
  );
  const productById = new Map(products.map((product) => [product._id.toString(), product]));

  let minPossible = Infinity;
  for (const item of items) {
    const product = productById.get(item.productId.toString());
    const variant = product?.variants.find((v) => v._id.toString() === item.variantId.toString());
    const isSellable = product?.status === ProductStatus.ACTIVE && variant?.isActive === true;

    const row = inventoryByVariant.get(item.variantId.toString());
    const available = isSellable && row ? Math.max(0, row.onHand - row.reserved) : 0;

    minPossible = Math.min(minPossible, Math.floor(available / item.quantity));
  }

  return Math.max(0, minPossible);
}

export { computeBundleAvailability };
export type { BundleAvailabilityItem };
