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
