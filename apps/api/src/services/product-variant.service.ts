import { Product, type ProductDocument } from "../models/product.model.js";
import { AppError } from "../utils/app-error.js";
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

async function getProductOrThrow(productId: string): Promise<ProductDocument> {
  const product = await Product.findById(productId);
  if (!product) throw new AppError("Producto no encontrado", 404);
  return product;
}

async function addVariant(
  productId: string,
  input: ProductVariantInput,
): Promise<ProductDocument> {
  const product = await getProductOrThrow(productId);
  assertNoDuplicateSkuInDocument(product, input.sku);

  product.variants.push(input);
  await product.save();
  return product;
}

async function updateVariant(
  productId: string,
  variantId: string,
  input: Partial<ProductVariantInput>,
): Promise<ProductDocument> {
  const product = await getProductOrThrow(productId);
  const variant = product.variants.id(variantId);
  if (!variant) throw new AppError("Variante no encontrada", 404);

  if (input.sku !== undefined) {
    assertNoDuplicateSkuInDocument(product, input.sku, variantId);
    variant.sku = input.sku;
  }
  if (input.name !== undefined) variant.name = input.name;
  if (input.attributes !== undefined) {
    variant.attributes = { ...variant.attributes, ...input.attributes };
  }
  if (input.price !== undefined) variant.price = input.price;
  if (input.weightGrams !== undefined) variant.weightGrams = input.weightGrams;
  if (input.dimensionsCm !== undefined) variant.dimensionsCm = input.dimensionsCm;
  if (input.isActive !== undefined) variant.isActive = input.isActive;

  await product.save();
  return product;
}

async function removeVariant(productId: string, variantId: string): Promise<ProductDocument> {
  const product = await getProductOrThrow(productId);
  const variant = product.variants.id(variantId);
  if (!variant) throw new AppError("Variante no encontrada", 404);

  variant.deleteOne();
  await product.save();
  return product;
}

export { addVariant, updateVariant, removeVariant };
