import { Types } from "mongoose";
import type { ListQuery, PaginationMeta, ProductStatus } from "@esencia-glow/shared";
import { Product, type ProductDocument } from "../models/product.model.js";
import { Category } from "../models/category.model.js";
import { Inventory } from "../models/inventory.model.js";
import type { DimensionsCmAttrs, VariantAttributesAttrs } from "../models/product-variant.schema.js";
import { AppError } from "../utils/app-error.js";
import { slugify } from "../utils/slugify.js";
import { buildMeta } from "../utils/parse-list-query.js";
import { resolveSort } from "../utils/resolve-sort.js";
import { buildProductFilter } from "../utils/build-product-filter.js";
import { withTransaction } from "../utils/with-transaction.js";
import { buildAdminProduct, type AdminProduct, type LeanProduct } from "./catalog-dto.js";

const PRODUCT_SORT_FIELDS = ["createdAt", "updatedAt", "name", "minPrice", "status"] as const;

interface ProductVariantInput {
  sku: string;
  name: string;
  attributes?: VariantAttributesAttrs;
  price: number;
  weightGrams: number;
  dimensionsCm: DimensionsCmAttrs;
  isActive?: boolean;
}

interface CreateProductInput {
  name: string;
  description: string;
  shortDescription?: string;
  categoryId: string;
  variants: ProductVariantInput[];
}

interface UpdateProductInput {
  name?: string;
  description?: string;
  shortDescription?: string;
  categoryId?: string;
  status?: ProductStatus;
}

interface ListProductsInput extends ListQuery {
  categoryId?: string;
  status?: ProductStatus;
  minPrice?: number;
  maxPrice?: number;
}

async function assertCategoryExists(categoryId: string): Promise<void> {
  const exists = await Category.exists({ _id: categoryId });
  if (!exists) throw new AppError("La categoría no existe", 400);
}

/**
 * Resuelve una categoría a sí misma + sus subcategorías (si es raíz). Filtrar
 * por una categoría raíz debe incluir lo que hay en sus hijas — el catálogo
 * público y el admin comparten esta resolución.
 */
async function resolveCategoryIds(categoryId: string): Promise<Types.ObjectId[]> {
  const id = new Types.ObjectId(categoryId);
  const children = await Category.find({ parentId: id }).select("_id").lean();
  return [id, ...children.map((child) => child._id)];
}

/**
 * Crea el producto y la fila de inventario (0/0) de cada una de sus variantes
 * en la misma transacción: si `Inventory.insertMany` fallara después de
 * `product.save()` (por ejemplo, un SKU ya usado por una fila de inventario
 * huérfana), el producto tampoco debe quedar creado — de lo contrario
 * quedarían variantes que nunca podrán venderse, sin que nada lo señale.
 */
async function createProduct(input: CreateProductInput): Promise<ProductDocument> {
  await assertCategoryExists(input.categoryId);

  return withTransaction(async (session) => {
    const product = new Product({
      name: input.name,
      slug: slugify(input.name),
      description: input.description,
      shortDescription: input.shortDescription,
      categoryId: input.categoryId,
      variants: input.variants,
    });
    await product.save({ session });

    if (product.variants.length > 0) {
      await Inventory.insertMany(
        product.variants.map((variant) => ({
          productId: product._id,
          variantId: variant._id,
          sku: variant.sku,
          onHand: 0,
          reserved: 0,
        })),
        { session, ordered: true },
      );
    }

    return product;
  });
}

async function getProductDocument(id: string): Promise<ProductDocument> {
  const product = await Product.findById(id);
  if (!product) throw new AppError("Producto no encontrado", 404);
  return product;
}

async function updateProduct(id: string, input: UpdateProductInput): Promise<ProductDocument> {
  const product = await getProductDocument(id);

  if (input.categoryId !== undefined) {
    await assertCategoryExists(input.categoryId);
    product.categoryId = input.categoryId as unknown as ProductDocument["categoryId"];
  }
  if (input.name !== undefined) {
    product.name = input.name;
    product.slug = slugify(input.name);
  }
  if (input.description !== undefined) product.description = input.description;
  if (input.shortDescription !== undefined) product.shortDescription = input.shortDescription;
  if (input.status !== undefined) product.status = input.status;

  await product.save();
  return product;
}

/** "Eliminar" un producto archiva, nunca borra: las órdenes ya lo referencian. */
async function archiveProduct(id: string): Promise<void> {
  const product = await getProductDocument(id);
  product.status = "archived" as ProductStatus;
  await product.save();
}

async function listProducts(
  input: ListProductsInput,
): Promise<{ products: AdminProduct[]; meta: PaginationMeta }> {
  const categoryIds = input.categoryId ? await resolveCategoryIds(input.categoryId) : undefined;
  const filter = buildProductFilter({
    search: input.search,
    categoryIds,
    status: input.status,
    minPrice: input.minPrice,
    maxPrice: input.maxPrice,
  });
  const sort = resolveSort(input.sort, PRODUCT_SORT_FIELDS, "createdAt");

  const [documents, total] = await Promise.all([
    Product.find(filter)
      .sort(sort)
      .skip((input.page - 1) * input.limit)
      .limit(input.limit)
      .lean<LeanProduct[]>(),
    Product.countDocuments(filter),
  ]);

  return { products: documents.map(buildAdminProduct), meta: buildMeta(total, input) };
}

async function getProductById(id: string): Promise<AdminProduct> {
  const product = await Product.findById(id).lean<LeanProduct>();
  if (!product) throw new AppError("Producto no encontrado", 404);
  return buildAdminProduct(product);
}

export {
  createProduct,
  updateProduct,
  archiveProduct,
  listProducts,
  getProductById,
  getProductDocument,
  resolveCategoryIds,
};
export type { CreateProductInput, UpdateProductInput, ListProductsInput, ProductVariantInput };
