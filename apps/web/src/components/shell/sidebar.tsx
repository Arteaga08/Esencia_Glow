"use client";

import { CaretLineLeft, CaretLineRight, X } from "@phosphor-icons/react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useFocusTrap } from "../../lib/use-focus-trap";
import { Destello } from "./destello";
import { useMobileNav } from "./mobile-nav-context";
import { MANAGEMENT_GROUP, NAV_GROUPS } from "./nav-config";
import { NavItem } from "./nav-item";

const COLLAPSE_STORAGE_KEY = "eg-sidebar-collapsed";

/**
 * `localStorage` es un sistema externo de verdad (persiste fuera de React),
 * así que se sincroniza con `useSyncExternalStore` — no con un
 * `useEffect` + `setState` (anti-patrón que marca
 * `react-hooks/set-state-in-effect`). También evita el mismatch de
 * hidratación: el snapshot de servidor siempre es `false`.
 *
 * El evento nativo `storage` solo dispara en OTRAS pestañas; para que el
 * propio toggle re-renderice esta pestaña, `writeStoredCollapsed` notifica
 * también a este set de listeners en memoria.
 */
const localListeners = new Set<() => void>();

function subscribeToStorage(onChange: () => void): () => void {
  localListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    localListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readStoredCollapsed(): boolean {
  // Conveniencia por-viewer únicamente (recordar si prefiere el sidebar
  // colapsado); nunca estado que otro proceso necesite leer de vuelta.
  try {
    return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function useStoredCollapsed(): boolean {
  return useSyncExternalStore(subscribeToStorage, readStoredCollapsed, () => false);
}

function writeStoredCollapsed(value: boolean): void {
  try {
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Sin persistencia disponible (privado/bloqueado): el toggle sigue
    // funcionando para esta sesión, solo no se recuerda la próxima vez.
  }
  localListeners.forEach((listener) => listener());
}

function SidebarContent({ collapsed }: { collapsed: boolean }) {
  return (
    <nav className="flex flex-1 flex-col gap-8 overflow-y-auto px-3 py-4" aria-label="Navegación principal">
      <div className="flex flex-col gap-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            {!collapsed ? (
              <p className="px-3 pb-1 font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">
                {group.label}
              </p>
            ) : null}
            {group.items.map((item) => (
              <NavItem key={item.href} {...item} collapsed={collapsed} />
            ))}
          </div>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-1">
        {!collapsed ? (
          <p className="px-3 pb-1 font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">
            {MANAGEMENT_GROUP.label}
          </p>
        ) : null}
        {MANAGEMENT_GROUP.items.map((item) => (
          <NavItem key={item.href} {...item} collapsed={collapsed} />
        ))}
      </div>
    </nav>
  );
}

/** Sidebar de escritorio: 260px expandida / 72px colapsada, transición de `width`. */
function Sidebar() {
  const collapsed = useStoredCollapsed();

  function toggleCollapsed() {
    writeStoredCollapsed(!collapsed);
  }

  return (
    <aside
      className={
        "hidden shrink-0 flex-col border-r border-border bg-surface transition-[width] " +
        "duration-[var(--duration-base)] ease-out-quart md:flex " +
        (collapsed ? "w-18" : "w-65")
      }
      style={{ "--surface-bg": "var(--color-surface)" } as React.CSSProperties}
    >
      <div className="flex h-16 items-center gap-2 border-b border-border px-4">
        <Destello size={20} />
        {!collapsed ? <span className="text-subtitle text-foreground">Esencia Glow</span> : null}
      </div>
      <SidebarContent collapsed={collapsed} />
      <div className="border-t border-border p-3">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          className="flex w-full items-center justify-center rounded-sm p-2 text-muted-foreground-strong hover:bg-muted hover:text-foreground"
        >
          {collapsed ? (
            <CaretLineRight size={16} weight="regular" aria-hidden="true" />
          ) : (
            <CaretLineLeft size={16} weight="regular" aria-hidden="true" />
          )}
        </button>
      </div>
    </aside>
  );
}

/** Drawer móvil: overlay + focus trap, cierre con Escape o al cambiar de ruta. */
function MobileSidebarDrawer() {
  const { open, closeNav } = useMobileNav();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeNav();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, closeNav]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <button
        type="button"
        aria-label="Cerrar menú"
        onClick={closeNav}
        className="absolute inset-0 bg-foreground/40"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navegación principal"
        className="absolute inset-y-0 left-0 flex w-65 flex-col bg-surface shadow-modal"
        style={{ "--surface-bg": "var(--color-surface)" } as React.CSSProperties}
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b border-border px-4">
          <div className="flex items-center gap-2">
            <Destello size={20} />
            <span className="text-subtitle text-foreground">Esencia Glow</span>
          </div>
          <button
            type="button"
            onClick={closeNav}
            aria-label="Cerrar menú"
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={20} weight="regular" aria-hidden="true" />
          </button>
        </div>
        <SidebarContent collapsed={false} />
      </div>
    </div>
  );
}

export { Sidebar, MobileSidebarDrawer };
