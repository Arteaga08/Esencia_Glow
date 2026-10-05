import type { ProductViewSection } from "@/lib/storefront/product-view";

/** Los títulos de los beneficios como etiquetas cortas, bajo el nombre (como AEVI). */
function BenefitTags({ section }: { section: ProductViewSection | undefined }) {
  if (!section) return null;
  return (
    <ul aria-label="Beneficios" className="flex flex-wrap gap-2">
      {section.items.map((item) => (
        <li key={item.title} className="rounded-md bg-blush px-3 py-1.5 font-mono text-label uppercase text-foreground">
          {item.title}
        </li>
      ))}
    </ul>
  );
}

export { BenefitTags };
