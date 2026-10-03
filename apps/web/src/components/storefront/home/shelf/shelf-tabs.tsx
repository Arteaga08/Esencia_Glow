"use client";

import { useRef } from "react";

interface ShelfTab {
  id: string;
  label: string;
}

interface ShelfTabsProps {
  tabs: ShelfTab[];
  active: string;
  onChange: (id: string) => void;
}

/** Pestañas con el patrón WAI-ARIA: flechas mueven y activan, Inicio/Fin saltan. */
function ShelfTabs({ tabs, active, onChange }: ShelfTabsProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function handleKeyDown(event: React.KeyboardEvent, index: number) {
    const last = tabs.length - 1;
    const target =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (target === null) return;
    event.preventDefault();
    const next = tabs[target]!;
    onChange(next.id);
    refs.current[next.id]?.focus();
  }

  return (
    <div role="tablist" aria-label="Más vendidos y kits" className="flex items-baseline gap-8">
      {tabs.map((tab, index) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              refs.current[tab.id] = node;
            }}
            id={`shelf-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls="shelf-panel"
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`transition-colors duration-[var(--duration-base)] ease-out-quart focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring ${
              `type-shop-section ${selected ? "text-foreground" : "text-muted-foreground-strong hover:text-foreground"}`
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export type { ShelfTab };
export { ShelfTabs };
