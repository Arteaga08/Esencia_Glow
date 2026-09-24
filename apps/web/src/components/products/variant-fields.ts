/**
 * Estado de UI de una variante en el formulario — todo como string porque
 * viene de inputs; se convierte a los tipos reales (centavos enteros, etc.)
 * justo antes de mandarlo a la API. `id` solo existe para una variante que
 * ya vive en el servidor; `tempId` es la key de React mientras no lo tiene.
 */
interface VariantDraft {
  id?: string;
  tempId: string;
  sku: string;
  /** Mientras es `false`, el SKU se regenera solo desde el nombre del
   * producto + el nombre de esta variante (ver `lib/sku-suggestion.ts`).
   * En cuanto el operador escribe en el campo SKU a mano, pasa a `true` y
   * deja de tocarse — mismo patrón que el `slug` del producto, pero
   * editable porque el SKU sí lo es. Una variante que ya vive en el
   * servidor (tiene `id`) siempre nace en `true`: nunca se le pisa un SKU
   * real con una sugerencia. */
  skuTouched: boolean;
  name: string;
  price: string;
  listPrice: string;
  weightGrams: string;
  length: string;
  width: string;
  height: string;
  size: string;
  shade: string;
  volume: string;
  isActive: boolean;
  initialStock: string;
}

function emptyVariantDraft(tempId: string): VariantDraft {
  return {
    tempId,
    sku: "",
    skuTouched: false,
    name: "",
    price: "",
    listPrice: "",
    weightGrams: "",
    length: "",
    width: "",
    height: "",
    size: "",
    shade: "",
    volume: "",
    isActive: true,
    initialStock: "",
  };
}

export type { VariantDraft };
export { emptyVariantDraft };
