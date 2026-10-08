"use client";

import type { ProductViewSection } from "@/lib/storefront/product-view";
import { AccordionRows } from "./accordion-rows";
import { CONTENT_ICONS } from "./content-icons";
import { ContentItems } from "./content-items";

/**
 * Acordeón de la banda "Información del producto" (propuesta A). El primer
 * renglón arranca abierto para que la banda no se vea vacía.
 */
function ContentAccordion({ sections }: { sections: ProductViewSection[] }) {
  return (
    <AccordionRows
      defaultOpenKey={sections[0]?.key}
      rows={sections.map((section) => ({
        key: section.key,
        label: section.label,
        icon: CONTENT_ICONS[section.key],
        content: <ContentItems items={section.items} />,
      }))}
    />
  );
}

export { ContentAccordion };
