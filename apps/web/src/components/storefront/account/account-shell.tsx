"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CaretLeft, SquaresFour } from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";
import { ACCOUNT_HOME, ACCOUNT_NAV } from "./nav-items";
import { LogoutButton } from "./logout-button";
import { FOCUS, LABEL, TEXT_LINK } from "./shared/styles";

const NAV_ITEM = `flex min-h-11 items-center gap-3 rounded-sm px-3 text-body transition-colors duration-[var(--duration-fast)] ${FOCUS}`;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Marco de Mi cuenta: barra lateral fija en escritorio (la sección activa en
 * rosa, como en el panel) y, en móvil, la raíz es una rejilla de accesos y cada
 * sección lleva su enlace de regreso. El título de cada página lo pone la
 * propia página; aquí solo vive la navegación.
 */
function AccountShell({ firstName, children }: { firstName: string; children: ReactNode }) {
  const pathname = usePathname();
  const atHome = pathname === ACCOUNT_HOME;

  return (
    <main className="pt-16 pb-40 xl:pt-20">
      <div className="mx-auto grid max-w-shell gap-8 px-4 py-10 md:px-8 md:py-14 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16 xl:px-12">
        <nav aria-label="Mi cuenta" className="hidden flex-col gap-1 lg:sticky lg:top-28 lg:flex lg:self-start">
          <p className={`${LABEL} px-3`}>Mi cuenta</p>
          <p className="mb-4 truncate px-3 text-subtitle text-foreground">{firstName}</p>
          <Link
            href={ACCOUNT_HOME}
            aria-current={atHome ? "page" : undefined}
            className={`${NAV_ITEM} ${atHome ? "bg-primary text-foreground" : "text-muted-foreground-strong hover:bg-muted hover:text-foreground"}`}
          >
            <SquaresFour size={20} aria-hidden="true" />
            Resumen
          </Link>
          {ACCOUNT_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.slug}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`${NAV_ITEM} ${active ? "bg-primary text-foreground" : "text-muted-foreground-strong hover:bg-muted hover:text-foreground"}`}
              >
                <item.icon size={20} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
          <LogoutButton className={`${NAV_ITEM} mt-3 w-full cursor-pointer border-t border-border pt-3 text-muted-foreground-strong hover:text-foreground`} />
        </nav>

        <div className="min-w-0">
          {atHome ? null : (
            <Link href={ACCOUNT_HOME} className={`${TEXT_LINK} -ml-1 gap-1 lg:hidden`}>
              <CaretLeft size={16} aria-hidden="true" />
              Mi cuenta
            </Link>
          )}
          {children}
        </div>
      </div>
    </main>
  );
}

export { AccountShell };
