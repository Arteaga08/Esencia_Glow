import type { ClientSession } from "mongoose";
import { Product, type ProductDocument } from "../models/product.model.js";
import { Inventory } from "../models/inventory.model.js";
import { Bundle } from "../models/bundle.model.js";
import type { ProductVariantAttrs } from "../models/product-variant.schema.js";
import { AppError } from "../utils/app-error.js";
import { withTransaction } from "../utils/with-transaction.js";
import { ensureInventoryRow, removeInventoryRow } from "./inventory.service.js";
import type { ProductVariantInput } from "./product.service.js";

/**
 * El índice único sobre "variants.sku" (product.model.ts) solo protege ENTRE
 * documentos: dos variantes del mismo producto con el mismo SKU no lo violan.
 * Esta comparación intra-documento es la defensa real para ese caso.
 */
function assertNoDuplicateSkuInDocument(
  product: ProductDocument,
  sku: string,
  excludeVariantId?: string,
): void {
  const collides = product.variants.some(
    (variant) => variant.sku === sku && variant.id !== excludeVariantId,
  );
  if (collides) {
    throw new AppError("Ya existe una variante con ese SKU en este producto", 409);
  }
}

async function getProductOrThrow(productId: string, session?: ClientSession): Promise<ProductDocument> {
  const query = Product.findById(productId);
  if (session) query.session(session);
  const product = await query;
  if (!product) throw new AppError("Producto no encontrado", 404);
  return product;
}

function applyVariantFields(variant: ProductVariantAttrs, input: Partial<ProductVariantInput>): void {
  if (input.sku !== undefined) variant.sku = input.sku;
  if (input.name !== undefined) variant.name = input.name;
  if (input.attributes !== undefined) {
    variant.attributes = { ...variant.attributes, ...input.attributes };
  }
  if (input.price !== undefined) variant.price = input.price;
  if (input.weightGrams !== undefined) variant.weightGrams = input.weightGrams;
  if (input.dimensionsCm !== undefined) variant.dimensionsCm = input.dimensionsCm;
  if (input.isActive !== undefined) variant.isActive = input.isActive;
}

/** Crea la variante y su fila de inventario (0/0) en una sola transacción. */
async function addVariant(
  productId: string,
  input: ProductVariantInput,
): Promise<ProductDocument> {
  return withTransaction(async (session) => {
    const product = await getProductOrThrow(productId, session);
    assertNoDuplicateSkuInDocument(product, input.sku);

    product.variants.push(input);
    await product.save({ session });

    const newVariant = product.variants[product.variants.length - 1]!;
    await ensureInventoryRow(
      { productId: product._id, variantId: newVariant._id, sku: newVariant.sku },
      session,
    );

    return product;
  });
}

/**
 * Solo abre una transacción cuando el SKU cambia: es el único caso que toca
 * `Inventory` (el sku ahí es una réplica del multikey único de
 * `products.variants.sku`, y hay que propagarlo). El 95% de los `PATCH` no
 * tocan el sku — encarecerlos con una transacción sería puro overhead.
 */
async function updateVariant(
  productId: string,
  variantId: string,
  input: Partial<ProductVariantInput>,
): Promise<ProductDocument> {
  if (input.sku === undefined) {
    const product = await getProductOrThrow(productId);
    const variant = product.variants.id(variantId);
    if (!variant) throw new AppError("Variante no encontrada", 404);

    applyVariantFields(variant, input);
    await product.save();
    return product;
  }

  return withTransaction(async (session) => {
    const product = await getProductOrThrow(productId, session);
    const variant = product.variants.id(variantId);
    if (!variant) throw new AppError("Variante no encontrada", 404);

    assertNoDuplicateSkuInDocument(product, input.sku!, variantId);
    applyVariantFields(variant, input);
    await product.save({ session });

    await Inventory.updateOne({ variantId }, { $set: { sku: variant.sku } }, { session });

    return product;
  });
}

/**
 * Siempre en una sola transacción: el chequeo de `reserved > 0` tiene que
 * correr en el mismo snapshot que el borrado, o una reserva concurrente
 * podría colarse entre el check y la escritura. No es el hot path de compra
 * (es una acción rara de admin), así que pagar la transacción siempre —en
 * vez de solo cuando hace falta— es correcto aquí.
 *
 * También bloquea si algún `Bundle` (1.4.1) referencia esta variante: a
 * diferencia de archivar un producto o desactivar una variante (que un
 * bundle absorbe mostrándose sin disponibilidad), un hard delete dejaría el
 * `items` del bundle apuntando a un `variantId` que ya no existe en ningún
 * lado, para siempre — no hay `stockCache` que recalcular ahí.
 */
async function removeVariant(productId: string, variantId: string): Promise<ProductDocument> {
  return withTransaction(async (session) => {
    const product = await getProductOrThrow(productId, session);
    const variant = product.variants.id(variantId);
    if (!variant) throw new AppError("Variante no encontrada", 404);

    const row = await Inventory.findOne({ variantId }).session(session);
    if (row && row.reserved > 0) {
      throw new AppError("No puedes eliminar una variante con unidades apartadas", 409);
    }

    const referencedByBundle = await Bundle.exists({ "items.variantId": variantId }).session(session);
    if (referencedByBundle) {
      throw new AppError("No puedes eliminar una variante usada en un paquete", 409);
    }

    variant.deleteOne();
    await product.save({ session });
    await removeInventoryRow(variantId, session);

    return product;
  });
}

export { addVariant, updateVariant, removeVariant };
