import type { ProductContentItem } from "@esencia-glow/shared";

/** Elementos de un bloque de contenido: título en negrita y su texto debajo. */
function ContentItems({ items }: { items: ProductContentItem[] }) {
  return (
    <ul className="flex max-w-[65ch] flex-col gap-4">
      {items.map((item) => (
        <li key={item.title} className="text-body text-foreground/80">
          <strong className="block font-semibold text-foreground">{item.title}</strong>
          {item.text}
        </li>
      ))}
    </ul>
  );
}

export { ContentItems };
