"use client";

import { useState } from "react";
import { CaretDown, CaretRight } from "@phosphor-icons/react";
import type { AdminHomeContent } from "@esencia-glow/shared";
import { BlockStatusBadges, BlockThumb, useDirtyBlocks } from "./block-parts";
import { HomeBlockEditor } from "./home-block-editor";
import { describeHomeBlocks, type HomeBlockId } from "./home-blocks";
import type { useHomeContent } from "./use-home-content";

interface HomeBlocksAccordionProps {
  content: AdminHomeContent;
  applySection: ReturnType<typeof useHomeContent>["applySection"];
}

/**
 * Contenido del home como acordeón en orden de tienda (Propuesta A, elegida
 * por Manuel): un renglón cerrado por bloque, mismo lenguaje que las colas de
 * Pedidos y Envíos. Se pueden abrir varios; los editores cerrados siguen
 * montados (solo ocultos) para no perder un borrador al cerrar el renglón.
 * En móvil la miniatura se conserva y los badges bajan a una segunda línea.
 */
function HomeBlocksAccordion({ content, applySection }: HomeBlocksAccordionProps) {
  const blocks = describeHomeBlocks(content);
  const { dirty, report } = useDirtyBlocks();
  const [open, setOpen] = useState<ReadonlySet<HomeBlockId>>(new Set());

  function toggle(id: HomeBlockId) {
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block, index) => {
        const isOpen = open.has(block.id);
        const panelId = `home-block-${block.id}`;
        return (
          <section key={block.id} className="overflow-hidden rounded-lg border border-border">
            <button
              type="button"
              onClick={() => toggle(block.id)}
              aria-expanded={isOpen}
              aria-controls={panelId}
              className="flex w-full cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 bg-muted/40 px-4 py-3 text-left hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:flex-nowrap"
            >
              {isOpen ? (
                <CaretDown size={14} className="shrink-0 text-muted-foreground-strong" aria-hidden="true" />
              ) : (
                <CaretRight size={14} className="shrink-0 text-muted-foreground-strong" aria-hidden="true" />
              )}
              <span className="w-4 shrink-0 font-mono text-label tabular-nums text-muted-foreground-strong">
                {index + 1}
              </span>
              <BlockThumb url={block.thumbnailUrl} className="h-10 w-16 shrink-0 rounded-md" />
              <span className="min-w-0 flex-1">
                <span className="block text-subtitle font-medium text-foreground">{block.name}</span>
                <span className="block truncate text-body-sm text-muted-foreground">{block.summary}</span>
              </span>
              <span className="flex basis-full flex-wrap items-center gap-2 sm:basis-auto sm:shrink-0 sm:justify-end">
                <BlockStatusBadges block={block} dirty={dirty[block.id] === true} />
              </span>
            </button>
            <div id={panelId} hidden={!isOpen} className="border-t border-border p-5">
              <HomeBlockEditor id={block.id} content={content} applySection={applySection} onDirtyChange={report} />
            </div>
          </section>
        );
      })}
    </div>
  );
}

export { HomeBlocksAccordion };
