import Link from "next/link";
import type { FooterColumn as FooterColumnData } from "@/lib/storefront/footer-links";

/**
 * Una columna de enlaces. Título en Schibsted, enlaces en la voz PT Mono del
 * storefront. `tone` ajusta el color para el footer oscuro.
 */
function FooterColumn({ column, tone = "light" }: { column: FooterColumnData; tone?: "light" | "dark" }) {
  const titleColor = tone === "dark" ? "text-background" : "text-foreground";
  const linkColor =
    tone === "dark" ? "text-background/80 hover:text-background" : "text-foreground/80 hover:text-foreground";

  return (
    <nav aria-label={column.title}>
      <h3 className={`text-section-title ${titleColor}`}>{column.title}</h3>
      <ul className="mt-4 flex flex-col">
        {column.links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className={`inline-flex min-h-9 items-center type-shop-cta underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none ${linkColor}`}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export { FooterColumn };
