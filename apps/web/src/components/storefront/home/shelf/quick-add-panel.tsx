import type { CartItemInput } from "@/lib/storefront/cart/cart-store";
import type { ShelfItem } from "@/lib/storefront/shelf-item";
import { AddChip } from "./add-chip";

// Hasta tres fichas en una fila, cada una con el mismo ancho; más de tres bajan de renglón.
const MAX_COLUMNS = 3;

interface QuickAddOption {
  id: string;
  label: string;
  priceCents: number;
  ariaLabel: string;
  line: CartItemInput;
}

/** Datos para pintar la línea al instante en el carrito, antes de que llegue el precio vivo. */
function snapshotOf(item: ShelfItem, variantLabel: string, priceCents: number): CartItemInput["snapshot"] {
  const image = item.images[0];
  return {
    name: item.name,
    ...(item.brand ? { brand: item.brand } : {}),
    variantLabel,
    priceCents,
    ...(item.listPriceCents ? { listPriceCents: item.listPriceCents } : {}),
    ...(image ? { image: { url: image.url, ...(image.alt ? { alt: image.alt } : {}) } } : {}),
  };
}

function buildOptions(item: ShelfItem): QuickAddOption[] {
  if (item.variants.length > 0) {
    return item.variants.map((variant) => ({
      id: variant.id,
      label: variant.label,
      priceCents: variant.priceCents,
      ariaLabel: `Agregar ${item.name}, ${variant.label}`,
      line: { itemType: "product", itemId: variant.id, snapshot: snapshotOf(item, variant.label, variant.priceCents) },
    }));
  }

  // Un kit agrega el paquete; un producto de una sola variante, su variante base.
  const itemId = item.kind === "kit" ? item.id : item.baseVariantId;
  if (!itemId) return [];

  return [
    {
      id: itemId,
      label: item.kind === "kit" ? "Agregar kit" : "Agregar",
      priceCents: item.priceCents,
      ariaLabel: `Agregar ${item.name}`,
      line: {
        itemType: item.kind === "kit" ? "bundle" : "product",
        itemId,
        snapshot: snapshotOf(item, item.quantityLabel, item.priceCents),
      },
    },
  ];
}

/**
 * Panel que sube sobre la parte baja de la foto, con las presentaciones como
 * fichas: cada ficha agrega esa variante. Un producto de una sola variante, o
 * un kit, lleva una única ficha "Agregar". Mismo esmerilado del header
 * (`blush` al 70 % + blur + saturación). Con cursor aparece al pasar o enfocar
 * la tarjeta; en táctil lo abre el "+" (`open`). Solo mueve `transform` y `opacity`.
 */
function QuickAddPanel({ item, open }: { item: ShelfItem; open: boolean }) {
  const options = buildOptions(item);
  if (options.length === 0) return null;

  return (
    <div
      style={{ gridTemplateColumns: `repeat(${Math.min(options.length, MAX_COLUMNS)}, minmax(0, 1fr))` }}
      className={`absolute inset-x-0 bottom-0 grid gap-2 border-t border-border bg-blush/70 p-2 backdrop-blur-xl backdrop-saturate-150 transition-[transform,opacity] duration-[var(--duration-slow)] ease-out-quart motion-reduce:translate-y-0 motion-reduce:transition-opacity group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100 ${
        open ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
      }`}
    >
      {options.map((option) => (
        <AddChip
          key={option.id}
          item={option.line}
          label={option.label}
          priceCents={option.priceCents}
          ariaLabel={option.ariaLabel}
          stacked={options.length > 1}
        />
      ))}
    </div>
  );
}

export { QuickAddPanel };
