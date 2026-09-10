import type { ListQuery, PaginationMeta } from "@esencia-glow/shared";
import { Category, type CategoryDocument } from "../models/category.model.js";
import { Product } from "../models/product.model.js";
import { AppError } from "../utils/app-error.js";
import { slugify } from "../utils/slugify.js";
import { escapeRegex, buildMeta } from "../utils/parse-list-query.js";
import { resolveSort } from "../utils/resolve-sort.js";
import { buildAdminCategory, type AdminCategory, type LeanCategory } from "./catalog-dto.js";

const CATEGORY_SORT_FIELDS = ["sortOrder", "name", "createdAt"] as const;

interface CategoryInput {
  name?: string;
  description?: string;
  parentId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

interface ListCategoriesInput extends ListQuery {
  parentId?: string | null;
  isActive?: boolean;
}

/**
 * Máximo dos niveles: una categoría raíz (`parentId: null`) puede tener
 * subcategorías, pero una subcategoría no. Vive aquí (no en un hook) porque
 * requiere consultas — un `pre("save")` con `await` escondería la regla.
 */
async function assertDepthInvariant(
  input: { parentId?: string | null },
  currentId?: string,
): Promise<void> {
  if (input.parentId === undefined || input.parentId === null) return;

  if (currentId && input.parentId === currentId) {
    throw new AppError("Una categoría no puede ser su propio padre", 400);
  }

  const parent = await Category.findById(input.parentId).lean();
  if (!parent) {
    throw new AppError("La categoría padre no existe", 400);
  }
  if (parent.parentId !== null) {
    throw new AppError("Una subcategoría no puede tener subcategorías", 400);
  }

  if (currentId) {
    const hasChildren = await Category.exists({ parentId: currentId });
    if (hasChildren) {
      throw new AppError(
        "Esta categoría ya tiene subcategorías y no puede volverse subcategoría",
        400,
      );
    }
  }
}

async function createCategory(input: CategoryInput): Promise<CategoryDocument> {
  const name = input.name ?? "";
  await assertDepthInvariant({ parentId: input.parentId ?? null });

  const category = new Category({
    name,
    slug: slugify(name),
    description: input.description,
    parentId: input.parentId ?? null,
    sortOrder: input.sortOrder ?? 0,
    isActive: input.isActive ?? true,
  });
  await category.save();
  return category;
}

async function getCategoryDocument(id: string): Promise<CategoryDocument> {
  const category = await Category.findById(id);
  if (!category) throw new AppError("Categoría no encontrada", 404);
  return category;
}

async function updateCategory(id: string, input: CategoryInput): Promise<CategoryDocument> {
  const category = await getCategoryDocument(id);

  if (input.parentId !== undefined) {
    await assertDepthInvariant({ parentId: input.parentId }, id);
    category.parentId = input.parentId as unknown as CategoryDocument["parentId"];
  }
  if (input.name !== undefined) {
    category.name = input.name;
    category.slug = slugify(input.name);
  }
  if (input.description !== undefined) category.description = input.description;
  if (input.sortOrder !== undefined) category.sortOrder = input.sortOrder;
  if (input.isActive !== undefined) category.isActive = input.isActive;

  await category.save();
  return category;
}

async function deleteCategory(id: string): Promise<void> {
  const [hasChildren, hasProducts] = await Promise.all([
    Category.exists({ parentId: id }),
    Product.exists({ categoryId: id }),
  ]);

  if (hasChildren) {
    throw new AppError("No se puede eliminar: tiene subcategorías asociadas", 409);
  }
  if (hasProducts) {
    throw new AppError("No se puede eliminar: tiene productos asociados", 409);
  }

  // Se borra duro (a diferencia de producto, que archiva): sin hijos ni
  // productos referenciándola, no hay historial que preservar. La imagen
  // asociada, si existe, queda como asset huérfano en Cloudinary — riesgo
  // menor ya documentado (plan del milestone, R5).
  await Category.findByIdAndDelete(id);
}

async function listCategories(
  query: ListCategoriesInput,
): Promise<{ categories: AdminCategory[]; meta: PaginationMeta }> {
  const filter: Record<string, unknown> = {};
  if (query.parentId !== undefined) filter.parentId = query.parentId;
  if (query.isActive !== undefined) filter.isActive = query.isActive;
  if (query.search) filter.name = new RegExp(escapeRegex(query.search), "i");

  const sort = resolveSort(query.sort, CATEGORY_SORT_FIELDS, "sortOrder");

  const [documents, total] = await Promise.all([
    Category.find(filter)
      .sort(sort)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean<LeanCategory[]>(),
    Category.countDocuments(filter),
  ]);

  return {
    categories: documents.map(buildAdminCategory),
    meta: buildMeta(total, query),
  };
}

async function getCategoryById(id: string): Promise<AdminCategory> {
  const category = await Category.findById(id).lean<LeanCategory>();
  if (!category) throw new AppError("Categoría no encontrada", 404);
  return buildAdminCategory(category);
}

export {
  createCategory,
  updateCategory,
  deleteCategory,
  listCategories,
  getCategoryById,
  getCategoryDocument,
  assertDepthInvariant,
};
export type { CategoryInput, ListCategoriesInput };
