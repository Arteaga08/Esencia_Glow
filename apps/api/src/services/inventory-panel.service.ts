import { Types } from "mongoose";
import { StockStatus, type ListQuery, type PaginationMeta } from "@esencia-glow/shared";
import { Product } from "../models/product.model.js";
import { Category } from "../models/category.model.js";
import { Inventory, type InventoryDocument } from "../models/inventory.model.js";
import { AppError } from "../utils/app-error.js";
import { buildMeta, escapeRegex } from "../utils/parse-list-query.js";
import { resolveEffectiveThreshold, resolveStockStatus, worstStatus } from "./inventory-status.js";

/**
 * Forma estructural mínima que este read model necesita de `Product` —
 * mismo precedente que `LeanProduct` en catalog-dto.ts: `updatedAt` no vive
 * en `ProductAttrs` (lo añade `{ timestamps: true }` a nivel de Mongoose, no
 * en la interfaz de TS), así que un `Pick<ProductDocument, "updatedAt">` no
 * tipa. Se declara aquí en vez de importar `LeanProduct` porque ese DTO es
 * para el catálogo público/admin, no para este read model de inventario.
 */
interface PanelVariantSource {
  _id: Types.ObjectId;
  sku: string;
  name: string;
}

interface PanelImageSource {
  url: string;
  alt?: string;
}

interface PanelProductSource {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  categoryId: Types.ObjectId;
  images: PanelImageSource[];
  variants: PanelVariantSource[];
  updatedAt: Date;
}

/**
 * Read model del panel de inventario: **una fila por producto**, nunca por
 * SKU (ver §"Read model del panel" de ECOMMERCE_ARCHITECTURE_GUIDELINES.md).
 * A diferencia de una agregación de Mongo con `$facet`, esto resuelve desde
 * `Product` + un solo `Inventory.find({productId: $in})` y compone el status
 * derivado en JS con las mismas funciones puras de `inventory-status.ts` que
 * usa el DTO de fila individual — deliberado: el catálogo de esta tienda son
 * cientos de productos, no millones (mismo criterio que "sin índice sobre
 * onHand/reserved sí es correcto aquí" en inventory.model.ts), así que
 * mantener una sola fuente de verdad para "qué es low/out/ok" en vez de
 * replicar la lógica en un pipeline de agregación es la relación
 * riesgo/beneficio correcta.
 */

interface PanelVariantRow {
  variantId: string;
  sku: string;
  name: string;
  inventoryItemId: string | null;
  onHand: number | null;
  reserved: number | null;
  available: number | null;
  lowStockThreshold: number | null;
  effectiveLowStockThreshold: number;
  status: StockStatus;
}

/**
 * Categoría directa del producto (normalmente una subcategoría). `parentId`
 * viaja para que el panel sepa bajo qué raíz cae sin otra petición.
 */
interface PanelCategoryRef {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

interface CategorySource {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  parentId: Types.ObjectId | null;
}

/** Primera foto del producto (la portada, por posición en `images`), para la
 * miniatura de la fila. `null` si el producto todavía no tiene fotos. */
interface PanelProductImage {
  url: string;
  alt: string | null;
}

interface PanelProductRow {
  productId: string;
  name: string;
  slug: string;
  image: PanelProductImage | null;
  /** `null` solo si la categoría referenciada ya no existe (borde defensivo:
   * `categoryId` es obligatorio en el modelo). */
  category: PanelCategoryRef | null;
  variantCount: number;
  untrackedVariantCount: number;
  totalOnHand: number;
  totalReserved: number;
  totalAvailable: number;
  status: StockStatus;
  updatedAt: string;
}

interface ProductInventoryDetail extends Omit<PanelProductRow, "status"> {
  status: StockStatus;
  variants: PanelVariantRow[];
}

interface ListInventoryPanelInput extends ListQuery {
  status?: StockStatus;
  /** Incluye a las subcategorías: pedir una raíz trae todo lo que cuelga de
   * ella, porque el panel agrupa por raíz (Milestone 2.5). */
  categoryId?: string;
}

const PANEL_SORT_FIELDS = ["name", "totalAvailable", "updatedAt"] as const;
type PanelSortField = (typeof PANEL_SORT_FIELDS)[number];

function buildVariantRow(
  variant: PanelVariantSource,
  row: InventoryDocument | undefined,
  globalThreshold: number,
): PanelVariantRow {
  if (!row) {
    return {
      variantId: variant._id.toString(),
      sku: variant.sku,
      name: variant.name,
      inventoryItemId: null,
      onHand: null,
      reserved: null,
      available: null,
      lowStockThreshold: null,
      effectiveLowStockThreshold: globalThreshold,
      status: StockStatus.UNTRACKED,
    };
  }

  const available = row.onHand - row.reserved;
  const effectiveLowStockThreshold = resolveEffectiveThreshold(row.lowStockThreshold, globalThreshold);
  return {
    variantId: variant._id.toString(),
    sku: variant.sku,
    name: variant.name,
    inventoryItemId: row._id.toString(),
    onHand: row.onHand,
    reserved: row.reserved,
    available,
    lowStockThreshold: row.lowStockThreshold ?? null,
    effectiveLowStockThreshold,
    status: resolveStockStatus(available, effectiveLowStockThreshold),
  };
}

function summarizeProduct(
  product: PanelProductSource,
  rowsByVariantId: Map<string, InventoryDocument>,
  categoriesById: Map<string, PanelCategoryRef>,
  globalThreshold: number,
): { row: PanelProductRow; variantRows: PanelVariantRow[] } {
  const variantRows = product.variants.map((variant) =>
    buildVariantRow(variant, rowsByVariantId.get(variant._id.toString()), globalThreshold),
  );

  const trackedRows = variantRows.filter((v) => v.inventoryItemId !== null);
  const totalOnHand = trackedRows.reduce((sum, v) => sum + v.onHand!, 0);
  const totalReserved = trackedRows.reduce((sum, v) => sum + v.reserved!, 0);
  const totalAvailable = trackedRows.reduce((sum, v) => sum + v.available!, 0);
  const untrackedVariantCount = variantRows.length - trackedRows.length;
  const status = worstStatus(trackedRows.map((v) => v.status));
  const cover = product.images[0];

  return {
    row: {
      productId: product._id.toString(),
      name: product.name,
      slug: product.slug,
      image: cover ? { url: cover.url, alt: cover.alt ?? null } : null,
      category: categoriesById.get(product.categoryId.toString()) ?? null,
      variantCount: product.variants.length,
      untrackedVariantCount,
      totalOnHand,
      totalReserved,
      totalAvailable,
      status,
      updatedAt: product.updatedAt.toISOString(),
    },
    variantRows,
  };
}

async function fetchInventoryRowsByVariant(
  variantIds: Types.ObjectId[],
): Promise<Map<string, InventoryDocument>> {
  if (variantIds.length === 0) return new Map();
  const rows = await Inventory.find({ variantId: { $in: variantIds } });
  return new Map(rows.map((row) => [row.variantId.toString(), row]));
}

/** Una sola consulta en lote para todas las categorías de la página, nunca una
 * por producto (mismo criterio que `countChildrenAndProducts` en catalog-dto.ts). */
async function fetchCategoriesById(categoryIds: Types.ObjectId[]): Promise<Map<string, PanelCategoryRef>> {
  if (categoryIds.length === 0) return new Map();
  const categories = await Category.find({ _id: { $in: categoryIds } })
    .select("name slug parentId")
    .lean<CategorySource[]>();
  return new Map(
    categories.map((category) => [
      category._id.toString(),
      {
        id: category._id.toString(),
        name: category.name,
        slug: category.slug,
        parentId: category.parentId ? category.parentId.toString() : null,
      },
    ]),
  );
}

/** La categoría pedida más sus hijas directas (la jerarquía es de dos niveles). */
async function resolveCategoryScope(categoryId: string): Promise<Types.ObjectId[]> {
  const children = await Category.find({ parentId: categoryId }).select("_id").lean<{ _id: Types.ObjectId }[]>();
  return [new Types.ObjectId(categoryId), ...children.map((child) => child._id)];
}

function sortPanelRows(rows: PanelProductRow[], field: string, direction: "asc" | "desc"): PanelProductRow[] {
  const sortField: PanelSortField = PANEL_SORT_FIELDS.includes(field as PanelSortField)
    ? (field as PanelSortField)
    : "name";
  const sign = direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const left = a[sortField];
    const right = b[sortField];
    if (left < right) return -1 * sign;
    if (left > right) return 1 * sign;
    return 0;
  });
}

async function listInventoryPanel(
  input: ListInventoryPanelInput,
  globalThreshold: number,
): Promise<{ items: PanelProductRow[]; statusCounts: Record<StockStatus, number>; meta: PaginationMeta }> {
  const filter: Record<string, unknown> = {};
  if (input.search) {
    filter.$or = [
      { name: new RegExp(escapeRegex(input.search), "i") },
      { "variants.sku": new RegExp(escapeRegex(input.search), "i") },
    ];
  }
  if (input.categoryId) {
    filter.categoryId = { $in: await resolveCategoryScope(input.categoryId) };
  }

  const products = await Product.find(filter).lean<PanelProductSource[]>();

  const allVariantIds = products.flatMap((product) => product.variants.map((v) => v._id));
  const [rowsByVariantId, categoriesById] = await Promise.all([
    fetchInventoryRowsByVariant(allVariantIds),
    fetchCategoriesById(products.map((product) => product.categoryId)),
  ]);

  const allRows = products.map(
    (product) => summarizeProduct(product, rowsByVariantId, categoriesById, globalThreshold).row,
  );

  const statusCounts: Record<StockStatus, number> = {
    [StockStatus.OUT]: 0,
    [StockStatus.LOW]: 0,
    [StockStatus.OK]: 0,
    [StockStatus.UNTRACKED]: 0,
  };
  for (const row of allRows) statusCounts[row.status] += 1;

  const filteredRows = input.status ? allRows.filter((row) => row.status === input.status) : allRows;
  const sortedRows = sortPanelRows(filteredRows, input.sort.field, input.sort.direction);

  const start = (input.page - 1) * input.limit;
  const items = sortedRows.slice(start, start + input.limit);

  return { items, statusCounts, meta: buildMeta(sortedRows.length, input) };
}

async function getProductInventoryDetail(
  productId: string,
  globalThreshold: number,
): Promise<ProductInventoryDetail> {
  const product = await Product.findById(productId).lean<PanelProductSource>();
  if (!product) throw new AppError("Producto no encontrado", 404);

  const [rowsByVariantId, categoriesById] = await Promise.all([
    fetchInventoryRowsByVariant(product.variants.map((v) => v._id)),
    fetchCategoriesById([product.categoryId]),
  ]);
  const { row, variantRows } = summarizeProduct(product, rowsByVariantId, categoriesById, globalThreshold);

  return { ...row, variants: variantRows };
}

export { listInventoryPanel, getProductInventoryDetail };
export type { PanelProductRow, PanelProductImage, PanelCategoryRef, PanelVariantRow, ProductInventoryDetail, ListInventoryPanelInput };
