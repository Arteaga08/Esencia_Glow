import { Types, type ClientSession, type FilterQuery } from "mongoose";
import { Inventory, type InventoryAttrs, type InventoryDocument } from "../models/inventory.model.js";
import { Product, type ProductDocument } from "../models/product.model.js";
import { AppError } from "../utils/app-error.js";

interface CreateInventoryItemInput {
  productId: string;
  variantId: string;
  onHand: number;
  lowStockThreshold?: number;
}

interface AdjustStockInput {
  variantId: string;
  /** Movimiento relativo (entrada/baja). Exclusivo con `onHand`. */
  delta?: number;
  /** Recuento físico absoluto. Exclusivo con `delta`. */
  onHand?: number;
  expectedOnHand?: number;
}

interface AdjustStockResult {
  row: InventoryDocument;
  before: number;
  after: number;
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
}

/**
 * Alta de stock desde el panel ("segunda puerta" — ver §"Alta de stock
 * híbrida" de ECOMMERCE_ARCHITECTURE_GUIDELINES.md): el SKU se resuelve
 * SIEMPRE desde el catálogo, nunca del body del cliente, porque `Inventory`
 * no admite que el sku de una fila diverja del de su variante.
 */
async function createInventoryItem(input: CreateInventoryItemInput): Promise<InventoryDocument> {
  const product = await Product.findById(input.productId).lean();
  if (!product) throw new AppError("Producto no encontrado", 404);

  const variant = product.variants.find((v) => v._id.toString() === input.variantId);
  if (!variant) throw new AppError("La variante no pertenece a este producto", 404);

  try {
    return await Inventory.create({
      productId: product._id,
      variantId: variant._id,
      sku: variant.sku,
      onHand: input.onHand,
      ...(input.lowStockThreshold !== undefined ? { lowStockThreshold: input.lowStockThreshold } : {}),
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError("Esta variante ya tiene una fila de inventario", 409);
    }
    throw error;
  }
}

/**
 * Siembra las filas de `initialStock` (write-only, ver product.validator.ts)
 * DENTRO de la misma transacción que crea el producto: o quedan producto y
 * stock, o no queda nada. Solo las variantes presentes en `stockBySku` con un
 * valor > 0 siembran fila — ausente o 0 no es error, simplemente no siembra
 * (ver §"Alta de stock híbrida").
 */
async function seedInitialStock(
  product: ProductDocument,
  stockBySku: ReadonlyMap<string, number>,
  session?: ClientSession,
): Promise<void> {
  const rows = product.variants
    .filter((variant) => (stockBySku.get(variant.sku) ?? 0) > 0)
    .map((variant) => ({
      productId: product._id,
      variantId: variant._id,
      sku: variant.sku,
      onHand: stockBySku.get(variant.sku)!,
      reserved: 0,
    }));

  if (rows.length > 0) {
    await Inventory.insertMany(rows, { session, ordered: true });
  }
}

async function removeInventoryRow(
  variantId: Types.ObjectId | string,
  session?: ClientSession,
): Promise<void> {
  await Inventory.deleteOne({ variantId }, { session });
}

/**
 * Único punto de mutación manual de stock, en sus dos modos legítimos (ver
 * §"Alta de stock híbrida"): `delta` (entrada/baja relativa) o `onHand`
 * (recuento físico absoluto) — nunca ambos. La condición y la escritura
 * viajan en el mismo `findOneAndUpdate`: nunca se lee `onHand` para decidir
 * en JS y luego escribir aparte. Solo un `delta > 0` mueve `lastRestockedAt`
 * (llegó mercancía); un recuento absoluto no lo toca, sea cual sea el signo
 * del cambio implícito.
 */
async function adjustStock(input: AdjustStockInput): Promise<AdjustStockResult> {
  const isDelta = input.delta !== undefined;
  const variantObjectId = new Types.ObjectId(input.variantId);

  const filter: FilterQuery<InventoryAttrs> = { variantId: variantObjectId };
  if (input.expectedOnHand !== undefined) {
    filter.onHand = input.expectedOnHand;
  }

  const now = new Date();
  let update: Record<string, unknown>;
  if (isDelta) {
    filter.$expr = { $gte: [{ $add: ["$onHand", input.delta] }, "$reserved"] };
    update = { $inc: { onHand: input.delta } };
    if (input.delta! > 0) {
      update = { ...update, $set: { lastRestockedAt: now } };
    }
  } else {
    filter.reserved = { $lte: input.onHand! };
    update = { $set: { onHand: input.onHand } };
  }

  // `new: false` devuelve el documento COMO ESTABA antes de esta escritura
  // atómica — el mismo comando que decide si aplica. La fila que se
  // devuelve se reconstruye en memoria a partir de ESE documento más la
  // mutación que este mismo comando ya aplicó (nunca con una segunda
  // lectura): una lectura aparte podría ver un estado más nuevo escrito por
  // otra llamada concurrente, o `null` si la fila se borró justo después
  // (ej. `removeVariant`), y el `!` resultante tiraría un 500 en vez de la
  // respuesta que ESTA llamada realmente produjo.
  const previous = await Inventory.findOneAndUpdate(filter, update, { new: false });
  if (previous) {
    const before = previous.onHand;
    const after = isDelta ? before + input.delta! : input.onHand!;
    previous.onHand = after;
    if (isDelta && input.delta! > 0) previous.lastRestockedAt = now;
    return { row: previous, before, after };
  }

  const exists = await Inventory.exists({ variantId: variantObjectId });
  if (!exists) throw new AppError("Variante no encontrada en el inventario", 404);
  if (input.expectedOnHand !== undefined) {
    throw new AppError("El inventario cambió, recarga la vista.", 409);
  }
  const current = await Inventory.findOne({ variantId: variantObjectId }).select("reserved");
  throw new AppError(
    `No puedes dejar el stock por debajo de lo apartado: hay ${current!.reserved} unidades apartadas.`,
    409,
  );
}

/** `threshold: null` hace `$unset` — la fila vuelve a usar el default global
 * de Settings (ver §"Umbral efectivo" de ECOMMERCE_ARCHITECTURE_GUIDELINES.md). */
async function updateLowStockThreshold(variantId: string, threshold: number | null): Promise<InventoryDocument> {
  const update = threshold === null ? { $unset: { lowStockThreshold: "" } } : { $set: { lowStockThreshold: threshold } };
  const row = await Inventory.findOneAndUpdate({ variantId }, update, { new: true });
  if (!row) throw new AppError("Variante no encontrada en el inventario", 404);
  return row;
}

async function getByVariantId(variantId: string): Promise<InventoryDocument> {
  const row = await Inventory.findOne({ variantId });
  if (!row) throw new AppError("Variante no encontrada en el inventario", 404);
  return row;
}

export {
  createInventoryItem,
  seedInitialStock,
  removeInventoryRow,
  adjustStock,
  updateLowStockThreshold,
  getByVariantId,
};
export type { CreateInventoryItemInput, AdjustStockInput, AdjustStockResult };
