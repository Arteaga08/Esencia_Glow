import type { ShelfItem } from "@/lib/storefront/shelf-item";
import { AddChip } from "./add-chip";

// Hasta tres fichas en una fila, cada una con el mismo ancho; más de tres bajan de renglón.
const MAX_COLUMNS = 3;

/**
 * Panel que sube sobre la parte baja de la foto, con las presentaciones como
 * fichas: cada ficha agrega esa variante. Un producto de una sola variante, o
 * un kit, lleva una única ficha "Agregar". Mismo esmerilado del header
 * (`blush` al 70 % + blur + saturación). Con cursor aparece al pasar o enfocar
 * la tarjeta; en táctil lo abre el "+" (`open`). Solo mueve `transform` y `opacity`.
 */
function QuickAddPanel({ item, open }: { item: ShelfItem; open: boolean }) {
  const options =
    item.variants.length > 0
      ? item.variants.map((variant) => ({
          id: variant.id,
          label: variant.label,
          priceCents: variant.priceCents,
          ariaLabel: `Agregar ${item.name}, ${variant.label}`,
        }))
      : [
          {
            id: item.id,
            label: item.kind === "kit" ? "Agregar kit" : "Agregar",
            priceCents: item.priceCents,
            ariaLabel: `Agregar ${item.name}`,
          },
        ];

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
