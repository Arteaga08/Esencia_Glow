"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem as NavItemConfig } from "./nav-config";
import { useMobileNav } from "./mobile-nav-context";

/**
 * Ítem activo: fondo `primary` suave + texto `foreground` — nunca una franja
 * lateral de color (DESIGN.md §5, Shell y Don't explícito).
 */
function NavItem({ label, href, icon: IconComponent, collapsed = false }: NavItemConfig & { collapsed?: boolean }) {
  const pathname = usePathname();
  const { closeNav } = useMobileNav();
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={closeNav}
      aria-current={isActive ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={
        "flex items-center gap-3 rounded-sm px-3 py-2 text-body transition-colors " +
        "duration-[var(--duration-fast)] ease-out-quart " +
        (isActive
          ? "bg-primary text-foreground"
          : "text-muted-foreground-strong hover:bg-muted hover:text-foreground")
      }
    >
      <IconComponent size={16} weight="regular" aria-hidden="true" className="shrink-0" />
      {collapsed ? <span className="sr-only">{label}</span> : <span className="truncate">{label}</span>}
    </Link>
  );
}

export { NavItem };
