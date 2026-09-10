import type { FilterQuery, Types } from "mongoose";
import { ProductStatus } from "@esencia-glow/shared";
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
  /** true en el catálogo público: fuerza status=active y alguna variante activa. */
  publicOnly?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

function buildProductFilter(input: ProductFilterInput): FilterQuery<ProductAttrs> {
  const filter: FilterQuery<ProductAttrs> = {};

  if (input.publicOnly) {
    filter.status = ProductStatus.ACTIVE;
    filter.variants = { $elemMatch: { isActive: true } };
  } else if (input.status) {
    filter.status = input.status;
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

export { buildProductFilter };
export type { ProductFilterInput };
