"use client";

import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { HomeBlocksAccordion } from "@/components/home-content/home-blocks-accordion";
import { useHomeContent } from "@/components/home-content/use-home-content";

/**
 * Contenido del home (Milestone 3.1). Un acordeón con un renglón por bloque
 * del storefront, en el orden en que aparecen en la tienda; todos nacen
 * cerrados. Sumar un bloque = un caso nuevo en `home-block-editor.tsx` y una
 * entrada en `home-blocks.ts`. Cada sección tiene su `version` (control
 * optimista, 1.8) y reporta su guardado con `applySection`.
 */
export default function HomeContentPage() {
  const { content, loadError, refresh, applySection } = useHomeContent();

  if (loadError) return <ErrorState description={loadError} onRetry={refresh} />;

  if (!content) {
    return (
      <div className="flex max-w-6xl flex-col gap-6">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <HomeBlocksAccordion content={content} applySection={applySection} />
    </div>
  );
}
