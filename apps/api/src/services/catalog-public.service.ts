import type { ListQuery, PaginationMeta, PublicCategory, PublicCategoryNode, PublicProduct } from "@esencia-glow/shared";
import { Product } from "../models/product.model.js";
import { Category } from "../models/category.model.js";
import { AppError } from "../utils/app-error.js";
import { buildMeta } from "../utils/parse-list-query.js";
import { resolveSort } from "../utils/resolve-sort.js";
import { buildProductFilter } from "../utils/build-product-filter.js";
import { resolveCategoryIds } from "./product.service.js";
import {
  buildPublicProduct,
  buildPublicCategory,
  buildCategoryTree,
  type LeanCategory,
  type LeanProduct,
} from "./catalog-dto.js";

const PUBLIC_PRODUCT_SORT_FIELDS = ["createdAt", "name", "minPrice"] as const;

interface ListPublicProductsInput extends ListQuery {
  categorySlug?: string;
  minPrice?: number;
  maxPrice?: number;
}

async function resolveCategoryRef(categoryId: string): Promise<{ id: string; name: string; slug: string }> {
  const category = await Category.findById(categoryId).select("name slug").lean();
  // No debería faltar (deleteCategory bloquea si hay productos referenciándola),
  // pero si pasa, es mejor un 404 explícito que exponer un producto roto.
  if (!category) throw new AppError("Producto no encontrado", 404);
  return { id: category._id.toString(), name: category.name, slug: category.slug };
}

async function listPublicProducts(
  input: ListPublicProductsInput,
): Promise<{ products: PublicProduct[]; meta: PaginationMeta }> {
  let categoryIds;
  if (input.categorySlug) {
    const category = await Category.findOne({ slug: input.categorySlug }).select("_id").lean();
    // Un slug de categoría desconocido no es un error: simplemente no hay
    // productos que mostrar (evita filtrar existencia de categorías por timing).
    categoryIds = category ? await resolveCategoryIds(category._id.toString()) : [];
  }

  const filter = buildProductFilter({
    search: input.search,
    categoryIds,
    publicOnly: true,
    minPrice: input.minPrice,
    maxPrice: input.maxPrice,
  });
  const sort = resolveSort(input.sort, PUBLIC_PRODUCT_SORT_FIELDS, "createdAt");

  const [documents, total] = await Promise.all([
    Product.find(filter)
      .sort(sort)
      .skip((input.page - 1) * input.limit)
      .limit(input.limit)
      .lean<LeanProduct[]>(),
    Product.countDocuments(filter),
  ]);

  const uniqueCategoryIds = [...new Set(documents.map((product) => product.categoryId.toString()))];
  const resolvedRefs = await Promise.all(uniqueCategoryIds.map((id) => resolveCategoryRef(id)));
  const categoryRefs = new Map(uniqueCategoryIds.map((id, index) => [id, resolvedRefs[index]!]));

  return {
    products: documents.map((product) =>
      buildPublicProduct(product, categoryRefs.get(product.categoryId.toString())!),
    ),
    meta: buildMeta(total, input),
  };
}

async function getPublicProductBySlug(slug: string): Promise<PublicProduct> {
  const product = await Product.findOne({
    slug,
    status: "active",
    variants: { $elemMatch: { isActive: true } },
  }).lean<LeanProduct>();
  if (!product) throw new AppError("Producto no encontrado", 404);

  const category = await resolveCategoryRef(product.categoryId.toString());
  return buildPublicProduct(product, category);
}

async function getPublicCategoryTree(): Promise<PublicCategoryNode[]> {
  const categories = await Category.find({ isActive: true })
    .sort({ parentId: 1, sortOrder: 1, name: 1 })
    .lean<LeanCategory[]>();
  return buildCategoryTree(categories);
}

async function getPublicCategoryBySlug(slug: string): Promise<PublicCategory> {
  const category = await Category.findOne({ slug, isActive: true }).lean<LeanCategory>();
  if (!category) throw new AppError("Categoría no encontrada", 404);
  return buildPublicCategory(category);
}

export { listPublicProducts, getPublicProductBySlug, getPublicCategoryTree, getPublicCategoryBySlug };
export type { ListPublicProductsInput };
