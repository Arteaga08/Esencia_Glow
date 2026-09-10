import { Types, type ClientSession, type FilterQuery } from "mongoose";
import type { ListQuery, PaginationMeta } from "@esencia-glow/shared";
import { Inventory, type InventoryAttrs, type InventoryDocument } from "../models/inventory.model.js";
import { AppError } from "../utils/app-error.js";
import { buildMeta, escapeRegex } from "../utils/parse-list-query.js";
import { resolveSort } from "../utils/resolve-sort.js";
import type { LeanInventoryRow } from "./inventory-dto.js";

const INVENTORY_SORT_FIELDS = ["updatedAt", "onHand", "reserved", "sku"] as const;

interface EnsureInventoryRowInput {
  productId: Types.ObjectId | string;
  variantId: Types.ObjectId | string;
  sku: string;
}

interface AdjustStockInput {
  variantId: string;
  delta: number;
  expectedOnHand?: number;
}

interface ListInventoryInput extends ListQuery {
  productId?: string;
  lowStock?: boolean;
}

/**
 * Crea la fila de inventario de una variante si no existe. Idempotente por
 * construcción (`upsert` + `$setOnInsert`): una segunda llamada con el mismo
 * `variantId` no crea una fila duplicada ni pisa `onHand`/`reserved` ya
 * existentes. Acepta `session` para participar en la transacción que crea el
 * producto/variante (ver product.service.ts / product-variant.service.ts).
 */
async function ensureInventoryRow(
  input: EnsureInventoryRowInput,
  session?: ClientSession,
): Promise<InventoryDocument> {
  const row = await Inventory.findOneAndUpdate(
    { variantId: input.variantId },
    {
      $setOnInsert: {
        productId: input.productId,
        variantId: input.variantId,
        sku: input.sku,
        onHand: 0,
        reserved: 0,
      },
    },
    { upsert: true, new: true, session },
  );
  // findOneAndUpdate con upsert:true siempre devuelve un documento.
  return row as InventoryDocument;
}

async function removeInventoryRow(
  variantId: Types.ObjectId | string,
  session?: ClientSession,
): Promise<void> {
  await Inventory.deleteOne({ variantId }, { session });
}

/**
 * Único punto de mutación manual de stock. La condición y el `$inc` viajan en
 * el mismo `findOneAndUpdate`: nunca se lee `onHand` para decidir en JS y
 * luego escribir aparte. `reserved <= onHand` se preserva porque la guarda
 * exige `onHand + delta >= reserved` (equivalente a onHand' >= reserved, y
 * como reserved >= 0 siempre, también onHand' >= 0).
 */
async function adjustStock(input: AdjustStockInput): Promise<InventoryDocument> {
  const filter: FilterQuery<InventoryAttrs> = {
    variantId: new Types.ObjectId(input.variantId),
    $expr: { $gte: [{ $add: ["$onHand", input.delta] }, "$reserved"] },
  };
  if (input.expectedOnHand !== undefined) {
    filter.onHand = input.expectedOnHand;
  }

  const updated = await Inventory.findOneAndUpdate(
    filter,
    { $inc: { onHand: input.delta } },
    { new: true },
  );
  if (updated) return updated;

  const exists = await Inventory.exists({ variantId: input.variantId });
  if (!exists) throw new AppError("Variante no encontrada en el inventario", 404);
  if (input.expectedOnHand !== undefined) {
    throw new AppError("El inventario cambió, recarga la vista.", 409);
  }
  throw new AppError("No puedes bajar el stock por debajo de lo ya apartado.", 409);
}

async function getByVariantId(variantId: string): Promise<InventoryDocument> {
  const row = await Inventory.findOne({ variantId });
  if (!row) throw new AppError("Variante no encontrada en el inventario", 404);
  return row;
}

/**
 * `lowStockThreshold` viene del caller (settings.service.ts) en vez de leerse
 * aquí: evita que este service dependa del singleton de Settings, y deja el
 * umbral fácil de testear con cualquier valor.
 */
async function listInventory(
  input: ListInventoryInput,
  lowStockThreshold: number,
): Promise<{ rows: LeanInventoryRow[]; meta: PaginationMeta }> {
  const filter: FilterQuery<InventoryAttrs> = {};
  if (input.productId) filter.productId = new Types.ObjectId(input.productId);
  if (input.search) filter.sku = new RegExp(escapeRegex(input.search), "i");
  if (input.lowStock) {
    filter.$expr = { $lte: [{ $subtract: ["$onHand", "$reserved"] }, lowStockThreshold] };
  }

  const sort = resolveSort(input.sort, INVENTORY_SORT_FIELDS, "updatedAt");

  const [rows, total] = await Promise.all([
    Inventory.find(filter)
      .sort(sort)
      .skip((input.page - 1) * input.limit)
      .limit(input.limit)
      .lean<LeanInventoryRow[]>(),
    Inventory.countDocuments(filter),
  ]);

  return { rows, meta: buildMeta(total, input) };
}

export { ensureInventoryRow, removeInventoryRow, adjustStock, getByVariantId, listInventory };
export type { EnsureInventoryRowInput, AdjustStockInput, ListInventoryInput };
