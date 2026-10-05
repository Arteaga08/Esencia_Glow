import type { ProductViewVariant } from "@/lib/storefront/product-view";

interface VariantPickerProps {
  variants: ProductViewVariant[];
  selectedId: string;
  onSelect: (id: string) => void;
}

/**
 * Presentaciones como pastillas (radios nativos ocultos, la etiqueta es el
 * control visible). Una agotada queda deshabilitada y lo dice con texto, no
 * solo con color.
 */
function VariantPicker({ variants, selectedId, onSelect }: VariantPickerProps) {
  return (
    <fieldset>
      <legend className="mb-2 font-mono text-label uppercase text-muted-foreground-strong">Presentación</legend>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-2">
        {variants.map((variant) => {
          const selected = variant.id === selectedId;
          return (
            <label
              key={variant.id}
              className={`flex min-h-12 flex-col items-center justify-center rounded-md border px-3 py-2 text-center transition-colors duration-[var(--duration-base)] ease-out-quart has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring ${
                !variant.available
                  ? "cursor-not-allowed border-border bg-muted text-muted-foreground-strong"
                  : selected
                    ? "cursor-pointer border-primary-action bg-blush text-foreground"
                    : "cursor-pointer border-border-strong bg-surface text-foreground hover:bg-muted"
              }`}
            >
              <input
                type="radio"
                name="variant"
                value={variant.id}
                checked={selected}
                disabled={!variant.available}
                onChange={() => onSelect(variant.id)}
                className="sr-only"
              />
              <span className="type-shop-cta">{variant.label}</span>
              {!variant.available ? <span className="text-label text-muted-foreground-strong">Agotado</span> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export { VariantPicker };
