import type { FilterQuery, Types } from "mongoose";
import { ProductChannel, ProductStatus } from "@esencia-glow/shared";
import { escapeRegex } from "./parse-list-query.js";
import type { ProductAttrs } from "../models/product.model.js";

/**
 * Arma el filtro de un listado de productos clave por clave — nunca con un
 * spread de `req.query` — para que ningún operador Mongo llegue sin pasar por
 * aquí. `mongoSanitize` (global) ya quitó claves "$"/"." y Joi ya tipó cada
 * valor; esta es la tercera capa (BACKEND_SECURITY_GUIDELINES.md §5).
 */
interface ProductFilterInput {
  search?: string;
  categoryIds?: Types.ObjectId[];
  status?: ProductStatus;
  /** true en el catálogo público: fuerza status=active, alguna variante
   * activa y excluye el canal de suscripción (ver buildPublicProductMatch). */
  publicOnly?: boolean;
  /** Solo para el listado admin — el catálogo público nunca lo acepta. */
  channel?: ProductChannel;
  minPrice?: number;
  maxPrice?: number;
}

/**
 * Match del catálogo público, en un solo lugar (Milestone 1.7.1): además de
 * `getPublicProductBySlug`/`getPublicVariantAvailability`, evita que cada
 * consumidor futuro reescriba a mano la condición y se le olvide el canal.
 *
 * `channel: { $ne: SUBSCRIPTION }`, nunca `{ $eq: STORE }`: un producto
 * creado antes de este milestone no tiene el campo `channel` (el `default`
 * de Mongoose no aplica a un documento ya guardado ni a un `.lean()`), así
 * que exigir `STORE` explícito borraría el catálogo entero de un día para
 * otro. `$ne` lo incluye sin necesitar un backfill.
 */
function buildPublicProductMatch(extra: FilterQuery<ProductAttrs> = {}): FilterQuery<ProductAttrs> {
  return {
    status: ProductStatus.ACTIVE,
    variants: { $elemMatch: { isActive: true } },
    channel: { $ne: ProductChannel.SUBSCRIPTION },
    ...extra,
  };
}

function buildProductFilter(input: ProductFilterInput): FilterQuery<ProductAttrs> {
  let filter: FilterQuery<ProductAttrs> = {};

  if (input.publicOnly) {
    filter = buildPublicProductMatch();
  } else {
    if (input.status) filter.status = input.status;
    if (input.channel) filter.channel = input.channel;
  }

  if (input.categoryIds && input.categoryIds.length > 0) {
    filter.categoryId = { $in: input.categoryIds };
  }

  if (input.search) {
    const pattern = new RegExp(escapeRegex(input.search), "i");
    filter.$or = [{ name: pattern }, { slug: pattern }, { "variants.sku": pattern }];
  }

  if (input.minPrice !== undefined || input.maxPrice !== undefined) {
    filter.minPrice = {
      ...(input.minPrice !== undefined ? { $gte: input.minPrice } : {}),
      ...(input.maxPrice !== undefined ? { $lte: input.maxPrice } : {}),
    };
  }

  return filter;
}

export { buildProductFilter, buildPublicProductMatch };
export type { ProductFilterInput };
