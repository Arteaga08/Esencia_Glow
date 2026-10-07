"use client";

import type { PublicUser } from "@esencia-glow/shared";
import { List } from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import { ADMIN_HOME_PATH } from "../../lib/admin-routes";
import { AccountMenu } from "./account-menu";
import { AlertsBell } from "./alerts/alerts-bell";
import { useMobileNav } from "./mobile-nav-context";
import { MANAGEMENT_GROUP, NAV_GROUPS } from "./nav-config";
import { GlobalSearch } from "./search/global-search";

interface TopBarProps {
  user: PublicUser;
}

const ALL_ITEMS = [...NAV_GROUPS.flatMap((group) => group.items), ...MANAGEMENT_GROUP.items];

/** Título de página derivado de la ruta actual — misma fuente que el sidebar. */
function pageTitleFor(pathname: string): string {
  const exact = ALL_ITEMS.find((item) => item.href === pathname);
  if (exact) return exact.label;
  const closest = ALL_ITEMS.find((item) => item.href !== ADMIN_HOME_PATH && pathname.startsWith(item.href));
  return closest?.label ?? "Panel";
}

/**
 * 64px, fondo `surface`, borde inferior `border` (DESIGN.md §5, Shell).
 *
 * Buscador global (pedidos, clientes, productos) y campana de pendientes del
 * momento; ambos viven en su propia carpeta (`search/`, `alerts/`).
 */
function TopBar({ user }: TopBarProps) {
  const { toggleNav } = useMobileNav();
  const pathname = usePathname();
  const title = pageTitleFor(pathname);

  return (
    <header className="relative flex h-16 shrink-0 items-center gap-4 border-b border-border bg-surface px-4 sm:px-6">
      <button
        type="button"
        onClick={toggleNav}
        aria-label="Abrir menú"
        className="cursor-pointer text-muted-foreground-strong hover:text-foreground md:hidden"
      >
        <List size={20} weight="regular" aria-hidden="true" />
      </button>

      <h1 className="text-page-title text-foreground">{title}</h1>

      <div className="ml-auto flex items-center gap-3">
        <GlobalSearch />
        <AlertsBell />
        <AccountMenu user={user} />
      </div>
    </header>
  );
}

export { TopBar };
