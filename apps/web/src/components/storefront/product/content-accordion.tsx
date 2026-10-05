"use client";

import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import type { ProductViewSection } from "@/lib/storefront/product-view";
import { CONTENT_ICONS } from "./content-icons";
import { ContentItems } from "./content-items";
import { FOCUS } from "./product-styles";

/**
 * Acordeón de la banda "Información del producto" (propuesta A). Cada renglón
 * abre y cierra por su cuenta; el primero arranca abierto para que la banda no
 * se vea vacía. La altura se anima con `grid-template-rows` (0fr a 1fr), no con `height`.
 */
function ContentAccordion({ sections }: { sections: ProductViewSection[] }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(sections[0] ? [sections[0].key] : []));

  function toggle(key: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="border-t border-border-strong">
      {sections.map((section) => {
        const Icon = CONTENT_ICONS[section.key];
        const expanded = open.has(section.key);
        return (
          <div key={section.key} className="border-b border-border-strong">
            <h3>
              <button
                type="button"
                id={`accordion-${section.key}`}
                aria-expanded={expanded}
                aria-controls={`accordion-panel-${section.key}`}
                onClick={() => toggle(section.key)}
                className={`flex w-full cursor-pointer items-center gap-4 py-5 text-left text-subtitle text-foreground ${FOCUS}`}
              >
                <Icon size={22} aria-hidden="true" />
                <span className="flex-1">{section.label}</span>
                <CaretDown
                  size={18}
                  aria-hidden="true"
                  className={`transition-transform duration-[var(--duration-base)] ease-out-quart motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
                />
              </button>
            </h3>
            <div
              id={`accordion-panel-${section.key}`}
              role="region"
              aria-labelledby={`accordion-${section.key}`}
              className={`grid transition-[grid-template-rows] duration-[var(--duration-slow)] ease-out-quart motion-reduce:transition-none ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
              <div className="overflow-hidden">
                <div className="pb-6 pl-10">
                  <ContentItems items={section.items} />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { ContentAccordion };
