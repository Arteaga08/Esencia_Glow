import type { BadgeColor, ListQuery, PaginationMeta } from "@esencia-glow/shared";
import { Badge, type BadgeDocument } from "../models/badge.model.js";
import { Product } from "../models/product.model.js";
import { AppError } from "../utils/app-error.js";
import { escapeRegex, buildMeta } from "../utils/parse-list-query.js";
import { resolveSort } from "../utils/resolve-sort.js";
import { buildAdminBadge, type AdminBadge, type LeanBadge } from "./catalog-dto.js";

const BADGE_SORT_FIELDS = ["text", "createdAt"] as const;

interface BadgeInput {
  text?: string;
  color?: BadgeColor;
}

interface ListBadgesInput extends ListQuery {
  color?: BadgeColor;
}

async function createBadge(input: BadgeInput): Promise<BadgeDocument> {
  const badge = new Badge({ text: input.text, color: input.color });
  await badge.save();
  return badge;
}

async function getBadgeDocument(id: string): Promise<BadgeDocument> {
  const badge = await Badge.findById(id);
  if (!badge) throw new AppError("Badge no encontrada", 404);
  return badge;
}

async function updateBadge(id: string, input: BadgeInput): Promise<BadgeDocument> {
  const badge = await getBadgeDocument(id);

  if (input.text !== undefined) badge.text = input.text;
  if (input.color !== undefined) badge.color = input.color;

  await badge.save();
  return badge;
}

async function deleteBadge(id: string): Promise<void> {
  const hasProducts = await Product.exists({ badgeId: id });
  if (hasProducts) {
    throw new AppError("No se puede eliminar: hay productos usando esta badge", 409);
  }

  // Borrado duro, igual que Category: sin productos referenciándola no hay
  // historial que preservar (a diferencia de Product/Bundle, que archivan).
  await Badge.findByIdAndDelete(id);
}

async function listBadges(
  query: ListBadgesInput,
): Promise<{ badges: AdminBadge[]; meta: PaginationMeta }> {
  const filter: Record<string, unknown> = {};
  if (query.color !== undefined) filter.color = query.color;
  if (query.search) filter.text = new RegExp(escapeRegex(query.search), "i");

  const sort = resolveSort(query.sort, BADGE_SORT_FIELDS, "text");

  const [documents, total] = await Promise.all([
    Badge.find(filter)
      .sort(sort)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean<LeanBadge[]>(),
    Badge.countDocuments(filter),
  ]);

  return { badges: documents.map(buildAdminBadge), meta: buildMeta(total, query) };
}

async function getBadgeById(id: string): Promise<AdminBadge> {
  const badge = await Badge.findById(id).lean<LeanBadge>();
  if (!badge) throw new AppError("Badge no encontrada", 404);
  return buildAdminBadge(badge);
}

export { createBadge, updateBadge, deleteBadge, listBadges, getBadgeById, getBadgeDocument };
export type { BadgeInput, ListBadgesInput };
