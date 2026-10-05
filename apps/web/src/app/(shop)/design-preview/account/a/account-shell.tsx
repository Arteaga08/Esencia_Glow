import Link from "next/link";
import type { ReactNode } from "react";
import { CaretLeft, SignOut, SquaresFour } from "@phosphor-icons/react/ssr";
import type { AccountData } from "../_kit/fixture";
import { ACCOUNT_NAV } from "../_kit/nav";
import { previewHref } from "../_kit/preview-state";
import { FOCUS, LABEL, TEXT_LINK } from "../_kit/styles";
import type { AccountView } from "../_kit/types";

interface AccountShellAProps {
  view: AccountView;
  base: string;
  data: AccountData;
  children: ReactNode;
}

const NAV_ITEM = `flex min-h-11 items-center gap-3 rounded-sm px-3 text-body transition-colors duration-[var(--duration-fast)] ${FOCUS}`;

/**
 * Propuesta A, Mi cuenta: barra lateral fija en escritorio (la sección activa
 * en rosa, como en el panel), y en móvil la raíz es una rejilla de accesos y
 * cada sección lleva su enlace de regreso. Un solo arreglo (`ACCOUNT_NAV`)
 * alimenta la barra y la rejilla.
 */
function AccountShellA({ view, base, data, children }: AccountShellAProps) {
  const current = ACCOUNT_NAV.find((item) => item.view === view);
  const home = previewHref(base, "inicio");

  return (
    <main className="pt-16 pb-40 xl:pt-20">
      <div className="mx-auto grid max-w-shell gap-8 px-4 py-10 md:px-8 md:py-14 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16 xl:px-12">
        <nav aria-label="Mi cuenta" className="hidden flex-col gap-1 lg:sticky lg:top-28 lg:flex lg:self-start">
          <p className={`${LABEL} px-3`}>Mi cuenta</p>
          <p className="mb-4 truncate px-3 text-subtitle text-foreground">{data.user.firstName}</p>
          <Link href={home} aria-current={view === "inicio" ? "page" : undefined} className={`${NAV_ITEM} ${view === "inicio" ? "bg-primary text-foreground" : "text-muted-foreground-strong hover:bg-muted hover:text-foreground"}`}>
            <SquaresFour size={20} aria-hidden="true" />
            Resumen
          </Link>
          {ACCOUNT_NAV.map((item) => {
            const active = item.view === view;
            return (
              <Link key={item.view} href={previewHref(base, item.view)} aria-current={active ? "page" : undefined} className={`${NAV_ITEM} ${active ? "bg-primary text-foreground" : "text-muted-foreground-strong hover:bg-muted hover:text-foreground"}`}>
                <item.icon size={20} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
          <Link href={previewHref(base, "ingresar")} className={`${NAV_ITEM} mt-3 border-t border-border pt-3 text-muted-foreground-strong hover:text-foreground`}>
            <SignOut size={20} aria-hidden="true" />
            Cerrar sesión
          </Link>
        </nav>

        <div className="min-w-0">
          {view === "inicio" ? (
            children
          ) : (
            <>
              <Link href={home} className={`${TEXT_LINK} -ml-1 gap-1 lg:hidden`}>
                <CaretLeft size={16} aria-hidden="true" />
                Mi cuenta
              </Link>
              <h1 className="mt-2 mb-8 text-page-title text-foreground md:text-display lg:mt-0">{current?.title}</h1>
              {children}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export { AccountShellA };
