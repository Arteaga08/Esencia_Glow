import Link from "next/link";
import { FOCUS } from "./styles";

interface LinkTab {
  href: string;
  label: string;
  active: boolean;
}

/**
 * Pestañas que son enlaces (cambian de pantalla, no de panel). Mismo acabado
 * que `Tabs` del sistema: borde inferior de 2px en `primary-action` para la
 * activa, texto mono en mayúsculas, sin pastilla. Se desplazan en horizontal
 * cuando no caben.
 */
function LinkTabs({ items, ariaLabel }: { items: LinkTab[]; ariaLabel: string }) {
  return (
    <nav aria-label={ariaLabel} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex gap-6 border-b border-border">
        {items.map((item) => (
          <li key={item.label} className="shrink-0">
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={`-mb-px inline-flex min-h-11 items-center border-b-2 font-mono text-label uppercase tracking-[0.06em] transition-colors duration-[var(--duration-fast)] ${FOCUS} ${
                item.active ? "border-primary-action text-foreground" : "border-transparent text-muted-foreground-strong hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export { LinkTabs };
export type { LinkTab };
