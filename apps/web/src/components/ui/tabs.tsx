"use client";

import { useRef, type KeyboardEvent } from "react";

interface TabItem {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel: string;
}

/**
 * DESIGN.md §5: fila de Etiquetas sobre un borde inferior `border`; el tab
 * activo gana un borde inferior de 2px en `primary-action` y texto
 * `foreground`; los inactivos usan `muted-foreground-strong`. Sin fondo de
 * pastilla — el borde inferior es la única señal de estado.
 *
 * Renderiza SOLO la tira de tabs: el consumidor decide qué panel mostrar
 * (`{activeId === "log" ? <A/> : <B/>}`) — un compound `<Tabs.Panel>` es más
 * API de la que este primitivo necesita hoy.
 */
function Tabs({ items, activeId, onChange, ariaLabel }: TabsProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function focusTabAt(index: number) {
    const target = items[index];
    if (!target) return;
    tabRefs.current[index]?.focus();
    onChange(target.id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusTabAt((index + 1) % items.length);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusTabAt((index - 1 + items.length) % items.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusTabAt(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusTabAt(items.length - 1);
    }
  }

  return (
    <div role="tablist" aria-label={ariaLabel} className="flex gap-6 border-b border-border">
      {items.map((item, index) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={active}
            aria-controls={`tabpanel-${item.id}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={
              "cursor-pointer border-b-2 pb-2 font-mono text-label uppercase tracking-[0.06em] " +
              (active
                ? "border-primary-action text-foreground"
                : "border-transparent text-muted-foreground-strong hover:text-foreground")
            }
          >
            {item.label}
            {item.count !== undefined ? <span className="ml-1.5 tabular-nums">({item.count})</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export type { TabItem, TabsProps };
export { Tabs };
