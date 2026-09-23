"use client";

import type { PublicUser } from "@esencia-glow/shared";
import { Bell, List, MagnifyingGlass } from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import { AccountMenu } from "./account-menu";
import { useMobileNav } from "./mobile-nav-context";
import { MANAGEMENT_GROUP, NAV_GROUPS } from "./nav-config";

interface TopBarProps {
  user: PublicUser;
}

const ALL_ITEMS = [...NAV_GROUPS.flatMap((group) => group.items), ...MANAGEMENT_GROUP.items];

/** Título de página derivado de la ruta actual — misma fuente que el sidebar. */
function pageTitleFor(pathname: string): string {
  const exact = ALL_ITEMS.find((item) => item.href === pathname);
  if (exact) return exact.label;
  const closest = ALL_ITEMS.find((item) => item.href !== "/" && pathname.startsWith(item.href));
  return closest?.label ?? "Panel";
}

/**
 * 64px, fondo `surface`, borde inferior `border` (DESIGN.md §5, Shell).
 *
 * Búsqueda y notificaciones están COLOCADAS pero deliberadamente inertes
 * (`disabled`, título "Próximamente") — decisión de esta sesión (2.1): se
 * quitó la paleta de comandos ⌘K del sistema de diseño original, y ningún
 * control se ofrece fingiendo que funciona (PRODUCT.md, principio 3: el
 * estado siempre es honesto).
 */
function TopBar({ user }: TopBarProps) {
  const { toggleNav } = useMobileNav();
  const pathname = usePathname();
  const title = pageTitleFor(pathname);

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-surface px-4 sm:px-6">
      <button
        type="button"
        onClick={toggleNav}
        aria-label="Abrir menú"
        className="text-muted-foreground-strong hover:text-foreground md:hidden"
      >
        <List size={20} weight="regular" aria-hidden="true" />
      </button>

      <h1 className="text-page-title text-foreground">{title}</h1>

      <div className="ml-auto flex items-center gap-3">
        <div
          title="Próximamente"
          className="hidden items-center gap-2 rounded-md border border-border bg-muted px-3 py-1.5 text-body-sm text-muted-foreground sm:flex"
        >
          <MagnifyingGlass size={16} weight="regular" aria-hidden="true" />
          <span
            aria-disabled="true"
            className="w-40 select-none text-muted-foreground"
          >
            Buscar (próximamente)
          </span>
        </div>
        <button
          type="button"
          disabled
          title="Próximamente"
          aria-disabled="true"
          className="cursor-not-allowed rounded-md p-2 text-muted-foreground"
        >
          <Bell size={20} weight="regular" aria-hidden="true" />
        </button>
        <AccountMenu user={user} />
      </div>
    </header>
  );
}

export { TopBar };
