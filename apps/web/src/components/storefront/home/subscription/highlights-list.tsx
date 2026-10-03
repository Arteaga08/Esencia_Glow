import { Check } from "@phosphor-icons/react/dist/ssr";

/** Viñetas de "qué incluye" de la caja; salen del plan. */
function HighlightsList({ items, className = "" }: { items: string[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <ul className={`flex flex-col gap-2 ${className}`}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-body-sm text-foreground/90">
          <Check size={18} weight="bold" aria-hidden className="mt-0.5 shrink-0 text-primary-action" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export { HighlightsList };
