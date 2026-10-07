import type { ListQuery, PaginationMeta } from "@esencia-glow/shared";
import { Brand, type BrandDocument } from "../models/brand.model.js";
import { Product } from "../models/product.model.js";
import { AppError } from "../utils/app-error.js";
import { escapeRegex, buildMeta } from "../utils/parse-list-query.js";
import { resolveSort } from "../utils/resolve-sort.js";
import { buildAdminBrand, type AdminBrand, type LeanBrand } from "./catalog-dto.js";

const BRAND_SORT_FIELDS = ["name", "createdAt"] as const;
const COLLATION = { locale: "es", strength: 1 } as const;

interface BrandInput {
  name?: string;
}

type ListBrandsInput = ListQuery;

/** El índice único ya lo garantiza; esto solo da un mensaje humano en vez del genérico del E11000. */
async function assertNameAvailable(name: string, excludeId?: string): Promise<void> {
  const clash = await Brand.findOne({ name }).collation(COLLATION).select("_id").lean();
  if (clash && clash._id.toString() !== excludeId) {
    throw new AppError("Ya existe una marca con ese nombre", 409, { name: "Ya existe una marca con ese nombre" });
  }
}

async function createBrand(input: BrandInput): Promise<BrandDocument> {
  await assertNameAvailable(input.name!);
  const brand = new Brand({ name: input.name });
  await brand.save();
  return brand;
}

async function getBrandDocument(id: string): Promise<BrandDocument> {
  const brand = await Brand.findById(id);
  if (!brand) throw new AppError("Marca no encontrada", 404);
  return brand;
}

async function updateBrand(id: string, input: BrandInput): Promise<BrandDocument> {
  const brand = await getBrandDocument(id);

  if (input.name !== undefined && input.name !== brand.name) {
    await assertNameAvailable(input.name, id);
    brand.name = input.name;
    await brand.save();
    // `Product.brand` es la copia denormalizada que lee el storefront: se
    // renombra junto con la marca para que filtros y tarjetas no queden con el
    // nombre viejo.
    await Product.updateMany({ brandId: brand._id }, { $set: { brand: brand.name } });
  }

  return brand;
}

async function deleteBrand(id: string): Promise<void> {
  const hasProducts = await Product.exists({ brandId: id });
  if (hasProducts) {
    throw new AppError("No se puede eliminar: hay productos usando esta marca", 409);
  }

  // Borrado duro, igual que Badge: sin productos referenciándola no hay historial que preservar.
  await Brand.findByIdAndDelete(id);
}

async function listBrands(query: ListBrandsInput): Promise<{ brands: AdminBrand[]; meta: PaginationMeta }> {
  const filter: Record<string, unknown> = {};
  if (query.search) filter.name = new RegExp(escapeRegex(query.search), "i");

  const sort = resolveSort(query.sort, BRAND_SORT_FIELDS, "name");

  const [documents, total] = await Promise.all([
    Brand.find(filter)
      .collation(COLLATION)
      .sort(sort)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean<LeanBrand[]>(),
    Brand.countDocuments(filter),
  ]);

  return { brands: documents.map(buildAdminBrand), meta: buildMeta(total, query) };
}

async function getBrandById(id: string): Promise<AdminBrand> {
  const brand = await Brand.findById(id).lean<LeanBrand>();
  if (!brand) throw new AppError("Marca no encontrada", 404);
  return buildAdminBrand(brand);
}

export { createBrand, updateBrand, deleteBrand, listBrands, getBrandById, getBrandDocument };
export type { BrandInput, ListBrandsInput };
