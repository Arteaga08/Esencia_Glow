import { Types } from "mongoose";
import { EditionStatus, type ListQuery, type PaginationMeta } from "@esencia-glow/shared";
import { Product } from "../models/product.model.js";
import {
  SubscriptionEdition,
  type SubscriptionEditionDocument,
} from "../models/subscription-edition.model.js";
import { AppError } from "../utils/app-error.js";
import { buildMeta } from "../utils/parse-list-query.js";
import { resolveSort } from "../utils/resolve-sort.js";
import {
  buildAdminSubscriptionEdition,
  type AdminSubscriptionEdition,
  type LeanSubscriptionEdition,
} from "./subscription-dto.js";

const EDITION_SORT_FIELDS = ["cycleYear", "cycleMonth", "createdAt", "title"] as const;

interface EditionItemInput {
  productId: string;
  variantId: string;
  quantity: number;
}

interface CreateSubscriptionEditionInput {
  planId: string;
  cycleYear: number;
  cycleMonth: number;
  title: string;
  description?: string;
}

/** `planId`/`cycleYear`/`cycleMonth` nunca aparecen aquí: son inmutables
 * siempre, publicada o no — corregir el ciclo es borrar y crear de nuevo. */
interface UpdateSubscriptionEditionInput {
  title?: string;
  description?: string;
  items?: EditionItemInput[];
}

interface ListSubscriptionEditionsInput extends ListQuery {
  planId?: string;
  cycleYear?: number;
  cycleMonth?: number;
  status?: EditionStatus;
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
}

/**
 * Validación referencial mínima (existe + la variante pertenece a ese
 * producto) — calco de `assertItemsValid` en bundle.service.ts. Las reglas
 * de negocio para PUBLICAR (canal, estado activo) viven aparte, en
 * subscription-edition-publish.service.ts: curar en `DRAFT` no debe fallar
 * porque un producto todavía esté en borrador.
 */
async function assertItemsReferential(items: EditionItemInput[]): Promise<void> {
  const productIds = [...new Set(items.map((item) => item.productId))];
  const products = await Product.find({ _id: { $in: productIds } }).select("variants").lean();
  const productById = new Map(products.map((product) => [product._id.toString(), product]));

  for (const item of items) {
    const product = productById.get(item.productId);
    if (!product) throw new AppError(`El producto ${item.productId} no existe`, 400);

    const belongsToProduct = product.variants.some((variant) => variant._id.toString() === item.variantId);
    if (!belongsToProduct) {
      throw new AppError(`La variante ${item.variantId} no pertenece al producto ${item.productId}`, 400);
    }
  }
}

async function createEdition(input: CreateSubscriptionEditionInput): Promise<SubscriptionEditionDocument> {
  const edition = new SubscriptionEdition({
    planId: input.planId,
    cycleYear: input.cycleYear,
    cycleMonth: input.cycleMonth,
    title: input.title,
    description: input.description,
  });
  try {
    await edition.save();
    return edition;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError("Ya existe una edición de este plan para este ciclo.", 409);
    }
    throw error;
  }
}

async function getEditionDocument(id: string): Promise<SubscriptionEditionDocument> {
  const edition = await SubscriptionEdition.findById(id);
  if (!edition) throw new AppError("Edición de suscripción no encontrada", 404);
  return edition;
}

async function updateEdition(
  id: string,
  input: UpdateSubscriptionEditionInput,
): Promise<SubscriptionEditionDocument> {
  const edition = await getEditionDocument(id);

  if (input.items !== undefined) {
    if (edition.status === EditionStatus.PUBLISHED) {
      throw new AppError("No puedes cambiar los productos de una edición ya publicada.", 409);
    }
    await assertItemsReferential(input.items);
    edition.items = input.items.map((item) => ({
      productId: new Types.ObjectId(item.productId),
      variantId: new Types.ObjectId(item.variantId),
      quantity: item.quantity,
    }));
  }
  if (input.title !== undefined) edition.title = input.title;
  if (input.description !== undefined) edition.description = input.description;

  await edition.save();
  return edition;
}

/** Hard delete solo en `DRAFT`: una vez publicada, la edición puede tener
 * (o llegar a tener) un cobro real contra ella — borrarla dejaría un
 * `SubscriptionShipment.editionId` apuntando a nada. */
async function deleteEdition(id: string): Promise<void> {
  const edition = await getEditionDocument(id);
  if (edition.status === EditionStatus.PUBLISHED) {
    throw new AppError("No puedes eliminar una edición publicada.", 409);
  }
  await SubscriptionEdition.deleteOne({ _id: id });
}

async function listEditions(
  input: ListSubscriptionEditionsInput,
): Promise<{ editions: AdminSubscriptionEdition[]; meta: PaginationMeta }> {
  const filter: Record<string, unknown> = {};
  if (input.planId) filter.planId = input.planId;
  if (input.cycleYear !== undefined) filter.cycleYear = input.cycleYear;
  if (input.cycleMonth !== undefined) filter.cycleMonth = input.cycleMonth;
  if (input.status) filter.status = input.status;

  const sort = resolveSort(input.sort, EDITION_SORT_FIELDS, "cycleYear");

  const [documents, total] = await Promise.all([
    SubscriptionEdition.find(filter)
      .sort(sort)
      .skip((input.page - 1) * input.limit)
      .limit(input.limit)
      .lean<LeanSubscriptionEdition[]>(),
    SubscriptionEdition.countDocuments(filter),
  ]);

  return { editions: documents.map(buildAdminSubscriptionEdition), meta: buildMeta(total, input) };
}

async function getEditionById(id: string): Promise<AdminSubscriptionEdition> {
  const edition = await SubscriptionEdition.findById(id).lean<LeanSubscriptionEdition>();
  if (!edition) throw new AppError("Edición de suscripción no encontrada", 404);
  return buildAdminSubscriptionEdition(edition);
}

export {
  createEdition,
  updateEdition,
  deleteEdition,
  listEditions,
  getEditionById,
  getEditionDocument,
  assertItemsReferential,
};
export type {
  CreateSubscriptionEditionInput,
  UpdateSubscriptionEditionInput,
  ListSubscriptionEditionsInput,
  EditionItemInput,
};
