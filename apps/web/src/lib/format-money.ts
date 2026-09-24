/**
 * Formatea centavos (la unidad en que la API guarda y devuelve precios,
 * ver product-variant.schema.ts) a un string en pesos mexicanos. Único
 * lugar del panel que hace esta conversión — nadie más divide entre 100 a
 * mano.
 */
function formatMoneyMXN(cents: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(cents / 100);
}

/** Centavos → string de pesos para un `<input type="number">` editable
 * (sin símbolo de moneda: eso lo pone el `Input` como contexto, no el valor). */
function centsToPesosInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}

/** String de pesos (lo que el operador tecleó) → centavos enteros para la
 * API. `Math.round` evita que el binario de punto flotante (349.1 * 100)
 * deje un `34909.999999` que Joi rechazaría por no-entero. */
function pesosInputToCents(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const pesos = Number(trimmed);
  if (Number.isNaN(pesos)) return null;
  return Math.round(pesos * 100);
}

export { formatMoneyMXN, centsToPesosInput, pesosInputToCents };
