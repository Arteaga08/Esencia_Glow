import {
  MAX_PARCEL_WEIGHT_GRAMS,
  MIN_BOX_CM,
  PACKAGING_TARE_GRAMS,
  PACKING_EFFICIENCY,
} from "@esencia-glow/shared";
import { AppError } from "../utils/app-error.js";

/**
 * Arma el paquete a cotizar desde las líneas del carrito — puro, sin I/O.
 * Aproximación DELIBERADA, documentada así porque 1.9 la puede refinar sin
 * tocar órdenes: la orden guarda el `parcel` que se usó, así que las
 * órdenes viejas siguen siendo auditables aunque cambie esta heurística.
 *
 * Peso: suma exacta + una tara fija de empaque (evita subcotizar
 * sistemáticamente). Dimensiones: se modela el volumen total como un cubo
 * (con un factor de relleno/huecos) y se acota por el artículo individual
 * más grande en cada eje — apilar alturas sobreestimaría brutal para
 * muchas unidades pequeñas, y usar solo el ítem más grande subestimaría; el
 * `max` contra cada dimensión garantiza que el artículo más grande SIEMPRE
 * quepa, que es la falla que más caro sale. Un solo paquete en 1.5; el
 * split multi-paquete es 1.9 (`MAX_PARCEL_WEIGHT_GRAMS` ya lo anticipa).
 */

interface ParcelDimensionsCmInput {
  length: number;
  width: number;
  height: number;
}

interface ParcelItemInput {
  weightGrams: number;
  dimensionsCm: ParcelDimensionsCmInput;
  quantity: number;
}

interface Parcel {
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  volumetricWeightGrams: number;
}

function buildParcel(items: readonly ParcelItemInput[]): Parcel {
  if (items.length === 0) {
    throw new AppError("No se puede armar un paquete sin artículos.", 400);
  }

  let weightGrams = PACKAGING_TARE_GRAMS;
  let volumeCm3 = 0;
  let maxItemLength = 0;
  let maxItemWidth = 0;
  let maxItemHeight = 0;

  for (const item of items) {
    weightGrams += item.weightGrams * item.quantity;
    volumeCm3 +=
      item.dimensionsCm.length * item.dimensionsCm.width * item.dimensionsCm.height * item.quantity;
    maxItemLength = Math.max(maxItemLength, item.dimensionsCm.length);
    maxItemWidth = Math.max(maxItemWidth, item.dimensionsCm.width);
    maxItemHeight = Math.max(maxItemHeight, item.dimensionsCm.height);
  }

  const side = Math.cbrt(volumeCm3 * PACKING_EFFICIENCY);

  const lengthCm = Math.max(Math.ceil(Math.max(side, maxItemLength)), MIN_BOX_CM.length);
  const widthCm = Math.max(Math.ceil(Math.max(side, maxItemWidth)), MIN_BOX_CM.width);
  const heightCm = Math.max(Math.ceil(Math.max(side, maxItemHeight)), MIN_BOX_CM.height);

  const volumetricWeightGrams = Math.ceil((lengthCm * widthCm * heightCm) / 5000) * 1000;

  if (weightGrams > MAX_PARCEL_WEIGHT_GRAMS) {
    // TODO(1.9): split en varios paquetes en vez de rechazar. Por ahora,
    // un carrito que exceda el techo de un solo paquete se rechaza
    // explícito en vez de cotizar un envío que Skydropx real no aceptaría.
    throw new AppError("Tu carrito excede el peso máximo por paquete.", 400);
  }

  return { weightGrams, lengthCm, widthCm, heightCm, volumetricWeightGrams };
}

export { buildParcel };
export type { ParcelItemInput, ParcelDimensionsCmInput, Parcel };
