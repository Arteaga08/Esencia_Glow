"use client";

import type { PublicCategoryNode } from "@esencia-glow/shared";
import { useCallback, useEffect, useId, useState } from "react";
import { SearchPanel } from "../../search/search-panel";
import { BrandLogo } from "./brand-logo";
import { HeaderActions } from "./header-actions";
import { MainNav } from "./main-nav";
import { MegaPanel } from "./mega-panel";
import { MenuToggle } from "./menu-toggle";
import { MobileMenu } from "./mobile-menu";
import { useScrolled } from "./use-scrolled";

/**
 * Estado y composición del header (como Etude). Tres estados:
 * - arriba de la página: transparente, sin borde ni desenfoque, sobre el hero;
 * - con scroll: rosa `blush` sólido con borde de 1px (plano, sin sombra),
 *   con un fundido lento (500 ms) para que el cambio no se sienta brusco;
 * - con panel o menú móvil abierto: rosa `blush` aunque no haya scroll, para
 *   que el texto del menú se lea sobre cualquier foto.
 * La lupa abre el buscador, que se monta encima de la barra.
 */
function HeaderShell({ categories }: { categories: PublicCategoryNode[] }) {
  const scrolled = useScrolled();
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  // Última categoría mostrada: su contenido se queda mientras el panel colapsa.
  const [shownSlug, setShownSlug] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const panelId = useId();
  const mobileId = useId();

  const closeAll = useCallback(() => {
    setActiveSlug(null);
    setMobileOpen(false);
    setSearchOpen(false);
  }, []);

  // El buscador cierra lo que el header tenga abierto (panel, menú móvil).
  const openSearch = useCallback(() => {
    closeAll();
    setSearchOpen(true);
  }, [closeAll]);

  const activate = useCallback((slug: string | null) => {
    setActiveSlug(slug);
    if (slug) setShownSlug(slug);
  }, []);

  const shownCategory = categories.find((category) => category.slug === shownSlug) ?? null;
  const panelOpen = activeSlug !== null;
  const menuOpen = panelOpen || mobileOpen;

  useEffect(() => {
    if (!panelOpen && !mobileOpen && !searchOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeAll();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [panelOpen, mobileOpen, searchOpen, closeAll]);

  // Con el menú móvil abierto la página de atrás no debe desplazarse.
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  return (
    <>
      <div
        aria-hidden="true"
        onClick={closeAll}
        className={`fixed inset-0 z-40 hidden bg-foreground/25 transition-opacity duration-[var(--duration-slow)] ease-out-quart motion-reduce:transition-none xl:block ${panelOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <header
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") setActiveSlug(null);
        }}
        className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color] duration-500 ease-out motion-reduce:transition-none ${scrolled || menuOpen ? "border-border bg-blush" : "border-transparent bg-transparent"}`}
      >
        <div className="mx-auto flex h-16 max-w-shell items-center justify-between gap-6 px-4 md:px-8 xl:h-20 xl:px-12">
          <div className="flex items-center gap-6 2xl:gap-10">
            <BrandLogo onNavigate={closeAll} />
            <MainNav
              categories={categories}
              activeSlug={activeSlug}
              panelId={panelId}
              onActivate={activate}
              onNavigate={closeAll}
            />
          </div>
          <div className="flex items-center gap-1">
            <HeaderActions onNavigate={closeAll} onSearch={openSearch} />
            <MenuToggle
              open={mobileOpen}
              controls={mobileId}
              onToggle={() => setMobileOpen((value) => !value)}
            />
          </div>
        </div>
        <MegaPanel id={panelId} category={shownCategory} open={panelOpen} onNavigate={closeAll} />
      </header>
      <MobileMenu id={mobileId} open={mobileOpen} categories={categories} onNavigate={closeAll} />
      {searchOpen ? <SearchPanel onClose={closeAll} /> : null}
    </>
  );
}

export { HeaderShell };
