"use client";

import { useId, useState, type ReactNode } from "react";
import { CaretDown, type Icon } from "@phosphor-icons/react";
import { FOCUS } from "./product-styles";

interface AccordionRow {
  key: string;
  label: string;
  icon: Icon;
  content: ReactNode;
}

interface AccordionRowsProps {
  rows: AccordionRow[];
  /** Renglón que arranca abierto; sin él, todos arrancan cerrados. */
  defaultOpenKey?: string;
  /** Versión apretada para la columna de compra: título y aire más chicos. */
  compact?: boolean;
}

/**
 * Renglones de acordeón de la página de producto. Cada uno abre y cierra por su
 * cuenta. La altura se anima con `grid-template-rows` (0fr a 1fr), no con `height`.
 */
function AccordionRows({ rows, defaultOpenKey, compact = false }: AccordionRowsProps) {
  const baseId = useId();
  const [open, setOpen] = useState<Set<string>>(() => new Set(defaultOpenKey ? [defaultOpenKey] : []));

  function toggle(key: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const lineColor = compact ? "border-border" : "border-border-strong";

  return (
    <div className={`border-t ${lineColor}`}>
      {rows.map((row) => {
        const RowIcon = row.icon;
        const expanded = open.has(row.key);
        const buttonId = `${baseId}-${row.key}`;
        const panelId = `${baseId}-panel-${row.key}`;
        return (
          <div key={row.key} className={`border-b ${lineColor}`}>
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => toggle(row.key)}
                className={`flex w-full cursor-pointer items-center text-left text-foreground ${compact ? "gap-3 py-4 text-body" : "gap-4 py-5 text-subtitle"} ${FOCUS}`}
              >
                <RowIcon size={compact ? 20 : 22} aria-hidden="true" />
                <span className="flex-1">{row.label}</span>
                <CaretDown
                  size={compact ? 16 : 18}
                  aria-hidden="true"
                  className={`transition-transform duration-[var(--duration-base)] ease-out-quart motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
                />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className={`grid transition-[grid-template-rows] duration-[var(--duration-slow)] ease-out-quart motion-reduce:transition-none ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
              <div className="overflow-hidden">
                <div className={compact ? "pb-5 pl-8" : "pb-6 pl-10"}>{row.content}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { AccordionRows };
export type { AccordionRow };
