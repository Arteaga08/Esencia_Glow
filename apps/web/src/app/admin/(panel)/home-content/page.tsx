"use client";

import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { HeroEditor } from "@/components/home-content/hero-editor";
import { SpotlightEditor } from "@/components/home-content/spotlight-editor";
import { KITS_META, NEW_ARRIVALS_META } from "@/components/home-content/spotlight-form-value";
import { useHomeContent } from "@/components/home-content/use-home-content";

/**
 * Contenido del home (Milestone 3.1). Lista de tarjetas de sección, una por
 * bloque del storefront; hoy el hero (3.1.2) y las portadas de Novedades y Kits (3.1.5). Sumar un bloque = un
 * componente nuevo que reciba su sección de `content` + una línea en la lista,
 * reportando su guardado con `applySection`. Cada sección tiene su `version`
 * (control optimista, 1.8).
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
    <div className="flex max-w-6xl flex-col gap-6">
      <HeroEditor hero={content.hero} onSaved={(hero) => applySection("hero", hero)} />
      <SpotlightEditor
        meta={NEW_ARRIVALS_META}
        section={content.newArrivals}
        onSaved={(section) => applySection("newArrivals", section)}
      />
      <SpotlightEditor
        meta={KITS_META}
        section={content.kits}
        onSaved={(section) => applySection("kits", section)}
      />
    </div>
  );
}
