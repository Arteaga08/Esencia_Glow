import type { Types } from "mongoose";
import type {
  ListQuery,
  PaginationMeta,
  PublicCategory,
  PublicCategoryNode,
  PublicProduct,
  PublicProductFacets,
  PublicVariantAvailability,
} from "@esencia-glow/shared";
import { Product } from "../models/product.model.js";
import { Category } from "../models/category.model.js";
import { Badge } from "../models/badge.model.js";
import { Inventory } from "../models/inventory.model.js";
import { AppError } from "../utils/app-error.js";
import { buildMeta } from "../utils/parse-list-query.js";
import { resolveSort } from "../utils/resolve-sort.js";
import { buildProductFilter, buildPublicProductMatch } from "../utils/build-product-filter.js";
import { buildSearchPattern } from "../utils/build-search-pattern.js";
import { resolveCategoryIds } from "./product.service.js";
import {
  buildPublicProduct,
  buildPublicCategory,
  buildCategoryTree,
  type LeanBadge,
  type LeanCategory,
  type LeanProduct,
} from "./catalog-dto.js";

const PUBLIC_PRODUCT_SORT_FIELDS = ["createdAt", "name", "minPrice"] as const;

interface ListPublicProductsInput extends ListQuery {
  categorySlug?: string;
  brands?: string[];
  minPrice?: number;
  maxPrice?: number;
  bestseller?: boolean;
  newArrival?: boolean;
  onSale?: boolean;
}

/** Alcance de las facetas: el mismo recorte que usa la página que las pide. */
interface PublicProductFacetsScope {
  categorySlug?: string;
  bestseller?: boolean;
  onSale?: boolean;
}

async function resolveCategoryRef(categoryId: string): Promise<{ id: string; name: string; slug: string }> {
  const category = await Category.findById(categoryId).select("name slug").lean();
  // No debería faltar (deleteCategory bloquea si hay productos referenciándola),
  // pero si pasa, es mejor un 404 explícito que exponer un producto roto.
  if (!category) throw new AppError("Producto no encontrado", 404);
  return { id: category._id.toString(), name: category.name, slug: category.slug };
}

/** Batch por `Set` de ids (incluye `null` filtrado): una sola query, nunca N+1. */
async function resolveBadgeRefs(badgeIds: (Types.ObjectId | null)[]): Promise<Map<string, LeanBadge>> {
  const uniqueIds = [...new Set(badgeIds.filter((id): id is Types.ObjectId => id !== null).map((id) => id.toString()))];
  if (uniqueIds.length === 0) return new Map();

  const badges = await Badge.find({ _id: { $in: uniqueIds } }).lean<LeanBadge[]>();
  return new Map(badges.map((badge) => [badge._id.toString(), badge]));
}

/**
 * Documentos de producto -> `PublicProduct[]` con categoría y badge ya
 * resueltas (una query por lote, nunca N+1). Compartido por el listado del
 * catálogo y por el home (productos destacados). Conserva el orden recibido.
 */
async function buildPublicProductsWithRefs(documents: LeanProduct[]): Promise<PublicProduct[]> {
  const uniqueCategoryIds = [...new Set(documents.map((product) => product.categoryId.toString()))];
  const resolvedRefs = await Promise.all(uniqueCategoryIds.map((id) => resolveCategoryRef(id)));
  const categoryRefs = new Map(uniqueCategoryIds.map((id, index) => [id, resolvedRefs[index]!]));
  const badgeRefs = await resolveBadgeRefs(documents.map((product) => product.badgeId));

  return documents.map((product) =>
    buildPublicProduct(
      product,
      categoryRefs.get(product.categoryId.toString())!,
      product.badgeId ? badgeRefs.get(product.badgeId.toString()) : undefined,
    ),
  );
}

/**
 * Slug de categoría -> ids (la raíz incluye sus subcategorías). Un slug
 * desconocido no es un error: devuelve `[]` y no hay productos que mostrar
 * (evita filtrar existencia de categorías por timing). Sin slug -> `undefined`.
 */
async function resolveCategoryIdsBySlug(slug?: string): Promise<Types.ObjectId[] | undefined> {
  if (!slug) return undefined;
  const category = await Category.findOne({ slug }).select("_id").lean();
  return category ? resolveCategoryIds(category._id.toString()) : [];
}

/**
 * Categorías activas cuyo nombre coincide con lo buscado, más sus
 * subcategorías: buscar "skincare" trae también lo que cuelga de ella.
 */
async function resolveSearchCategoryIds(search?: string): Promise<Types.ObjectId[] | undefined> {
  if (!search) return undefined;
  const matches = await Category.find({ isActive: true, name: buildSearchPattern(search) }).select("_id").lean();
  if (matches.length === 0) return [];
  const matchIds = matches.map((category) => category._id);
  const children = await Category.find({ parentId: { $in: matchIds } }).select("_id").lean();
  return [...matchIds, ...children.map((child) => child._id)];
}

async function listPublicProducts(
  input: ListPublicProductsInput,
): Promise<{ products: PublicProduct[]; meta: PaginationMeta }> {
  const [categoryIds, searchCategoryIds] = await Promise.all([
    resolveCategoryIdsBySlug(input.categorySlug),
    resolveSearchCategoryIds(input.search),
  ]);

  const filter = buildProductFilter({
    search: input.search,
    searchCategoryIds,
    categoryIds,
    publicOnly: true,
    brands: input.brands,
    minPrice: input.minPrice,
    maxPrice: input.maxPrice,
    isBestseller: input.bestseller,
    isNewArrival: input.newArrival,
    onSale: input.onSale,
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

  return {
    products: await buildPublicProductsWithRefs(documents),
    meta: buildMeta(total, input),
  };
}

/**
 * Marcas distintas y rango de precio de la categoría (la raíz incluye sus
 * subcategorías) para armar los filtros del catálogo. Mismo match público que
 * el listado: borradores, canal de suscripción y productos sin variante activa
 * no aportan marcas ni precios. Categoría desconocida -> facetas vacías.
 */
async function getPublicProductFacets(scope: PublicProductFacetsScope = {}): Promise<PublicProductFacets> {
  const categoryIds = await resolveCategoryIdsBySlug(scope.categorySlug);
  const filter = buildProductFilter({
    categoryIds,
    publicOnly: true,
    isBestseller: scope.bestseller,
    onSale: scope.onSale,
  });

  const [summary] = await Product.aggregate<{ brands: string[]; minPrice: number | null; maxPrice: number | null }>([
    { $match: filter },
    {
      $group: {
        _id: null,
        brands: { $addToSet: "$brand" },
        minPrice: { $min: "$minPrice" },
        maxPrice: { $max: "$minPrice" },
      },
    },
  ]);

  if (!summary) return { brands: [], minPrice: null, maxPrice: null };
  const brands = summary.brands
    .filter((brand): brand is string => typeof brand === "string" && brand.length > 0)
    .sort((a, b) => a.localeCompare(b, "es"));
  return { brands, minPrice: summary.minPrice ?? null, maxPrice: summary.maxPrice ?? null };
}

async function getPublicProductBySlug(slug: string): Promise<PublicProduct> {
  const product = await Product.findOne(buildPublicProductMatch({ slug })).lean<LeanProduct>();
  if (!product) throw new AppError("Producto no encontrado", 404);

  const category = await resolveCategoryRef(product.categoryId.toString());
  const badge = product.badgeId
    ? await Badge.findById(product.badgeId).lean<LeanBadge>()
    : null;
  return buildPublicProduct(product, category, badge ?? undefined);
}

/**
 * Señal booleana por variante activa — nunca el número (`onHand`/`reserved`
 * es información de negocio, ver §"Disponibilidad pública" de
 * ECOMMERCE_ARCHITECTURE_GUIDELINES.md). Mismo criterio de existencia que el
 * PDP: 404 si el producto no está activo o no tiene ninguna variante activa.
 */
async function getPublicVariantAvailability(slug: string): Promise<PublicVariantAvailability[]> {
  const product = await Product.findOne(buildPublicProductMatch({ slug }))
    .select("variants")
    .lean<LeanProduct>();
  if (!product) throw new AppError("Producto no encontrado", 404);

  const activeVariants = product.variants.filter((variant) => variant.isActive);
  const rows = await Inventory.find({ variantId: { $in: activeVariants.map((v) => v._id) } })
    .select("variantId onHand reserved")
    .lean();
  const rowByVariant = new Map(rows.map((row) => [row.variantId.toString(), row]));

  return activeVariants.map((variant) => {
    const row = rowByVariant.get(variant._id.toString());
    return {
      variantId: variant._id.toString(),
      sku: variant.sku,
      isAvailable: row !== undefined && row.onHand - row.reserved > 0,
    };
  });
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

export {
  buildPublicProductsWithRefs,
  resolveBadgeRefs,
  listPublicProducts,
  getPublicProductFacets,
  getPublicProductBySlug,
  getPublicVariantAvailability,
  getPublicCategoryTree,
  getPublicCategoryBySlug,
};
export type { ListPublicProductsInput, PublicProductFacetsScope };
