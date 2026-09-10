/**
 * Cálculo puro de los totales de una orden — cero I/O, cero imports de
 * modelos, para poder fijar la aritmética en tests sin abrir Mongo ni una
 * llave de Stripe a la vista (ver ECOMMERCE_ARCHITECTURE_GUIDELINES.md
 * §"Módulo de Órdenes").
 *
 * El IVA se DESGLOSA del total, nunca se suma: los precios del catálogo ya
 * lo incluyen. Redondear el subtotal neto y derivar el impuesto por resta
 * garantiza, por construcción, que `subtotal + tax === total` — calcularlo
 * al revés (o por separado items/envío) produce hasta ±1 centavo de
 * diferencia contra el total realmente cobrado.
 *
 * `taxRateBps` en puntos base enteros (1600 = 16%), nunca un float: con
 * totales de hasta 10^8 centavos, `total * 10_000` queda muy por debajo de
 * 2^53, así que la división no arrastra error de punto flotante.
 */

interface ComputeOrderTotalsInput {
  /** `unitPriceCents * quantity` de cada línea, ya en centavos enteros
   * (IVA incluido). Las líneas de bundle aportan el precio del bundle, NO
   * la suma de sus componentes. */
  lineTotalsCents: readonly number[];
  /** Monto de la tarifa de envío que el cliente eligió, IVA incluido. */
  chosenRateAmountCents: number;
  /** Monto de la tarifa más barata de la cotización — congelado en la
   * `ShippingQuote` al cotizar, nunca recalculado aquí. */
  cheapestRateAmountCents: number;
  taxRateBps: number;
  /** `0` significa desactivado, explícitamente — con `>=` cualquier
   * carrito calificaría si el umbral no se tratara como apagado. */
  freeShippingThresholdCents: number;
}

interface OrderTotals {
  subtotalCents: number;
  /** Cupones fuera de alcance en 1.5: siempre 0, mantiene la identidad
   * `total = subtotal - discount + shipping` lista para cuando existan. */
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  taxCents: number;
  taxRateBps: number;
  freeShippingApplied: boolean;
}

function computeOrderTotals(input: ComputeOrderTotalsInput): OrderTotals {
  const subtotalCents = input.lineTotalsCents.reduce((sum, line) => sum + line, 0);
  const discountCents = 0;

  // El umbral se compara contra el subtotal BRUTO de líneas, nunca contra
  // un total que ya incluye el propio envío que se está decidiendo —
  // compararlo contra ese total sería circular.
  const freeShippingApplied =
    input.freeShippingThresholdCents > 0 && subtotalCents >= input.freeShippingThresholdCents;

  const shippingCents = freeShippingApplied
    ? Math.max(0, input.chosenRateAmountCents - input.cheapestRateAmountCents)
    : input.chosenRateAmountCents;

  const totalCents = subtotalCents - discountCents + shippingCents;

  // Redondea el neto y deriva el impuesto por resta — nunca al revés — para
  // que `subtotalNeto + taxCents === totalCents` se cumpla siempre, sin
  // depender de cómo cayeron los redondeos.
  const subtotalNetoCents = Math.round((totalCents * 10_000) / (10_000 + input.taxRateBps));
  const taxCents = totalCents - subtotalNetoCents;

  return {
    subtotalCents,
    discountCents,
    shippingCents,
    totalCents,
    taxCents,
    taxRateBps: input.taxRateBps,
    freeShippingApplied,
  };
}

export { computeOrderTotals };
export type { ComputeOrderTotalsInput, OrderTotals };
