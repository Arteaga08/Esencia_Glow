import { Minus, Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { FooterColumn } from "@/lib/storefront/footer-links";

/**
 * Columnas del footer en móvil como acordeón nativo (`<details>`): sin JS, con
 * teclado y lector de pantalla de serie. En escritorio se usan las columnas
 * abiertas de `FooterColumn`, por eso este bloque se oculta desde `lg`.
 */
function FooterAccordion({ columns }: { columns: FooterColumn[] }) {
  return (
    <div className="border-t border-background/30 lg:hidden">
      {columns.map((column) => (
        <details key={column.title} className="group border-b border-background/30">
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between px-4 text-section-title text-background focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
            {column.title}
            <Plus size={20} aria-hidden={true} className="group-open:hidden" />
            <Minus size={20} aria-hidden={true} className="hidden group-open:block" />
          </summary>
          <ul className="flex flex-col px-4 pb-4">
            {column.links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex min-h-11 items-center type-shop-cta text-background/80 underline-offset-4 hover:text-background hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

export { FooterAccordion };
