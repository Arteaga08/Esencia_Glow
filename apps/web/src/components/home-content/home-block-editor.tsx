"use client";

import { useCallback } from "react";
import type { AdminHomeContent } from "@esencia-glow/shared";
import { AdviceEditor } from "./advice-editor";
import { AnnouncementEditor } from "./announcement-editor";
import { HeroEditor } from "./hero-editor";
import type { HomeBlockId } from "./home-blocks";
import { PageCoversEditor } from "./page-covers-editor";
import { SpotlightEditor } from "./spotlight-editor";
import { KITS_META, NEW_ARRIVALS_META } from "./spotlight-form-value";
import type { useHomeContent } from "./use-home-content";

interface HomeBlockEditorProps {
  id: HomeBlockId;
  content: AdminHomeContent;
  applySection: ReturnType<typeof useHomeContent>["applySection"];
  onDirtyChange: (id: HomeBlockId, dirty: boolean) => void;
}

/**
 * El editor de un bloque, embebido (sin Card ni encabezado propios: los pone
 * el contenedor). Reporta si tiene cambios sin guardar con el id del bloque,
 * para que el contenedor lo muestre aunque el editor esté cerrado u oculto.
 */
function HomeBlockEditor({ id, content, applySection, onDirtyChange }: HomeBlockEditorProps) {
  const handleDirty = useCallback((dirty: boolean) => onDirtyChange(id, dirty), [id, onDirtyChange]);

  switch (id) {
    case "announcement":
      return (
        <AnnouncementEditor
          section={content.announcement}
          onSaved={(section) => applySection("announcement", section)}
          embedded
          onDirtyChange={handleDirty}
        />
      );
    case "hero":
      return (
        <HeroEditor
          hero={content.hero}
          onSaved={(hero) => applySection("hero", hero)}
          embedded
          onDirtyChange={handleDirty}
        />
      );
    case "newArrivals":
      return (
        <SpotlightEditor
          meta={NEW_ARRIVALS_META}
          section={content.newArrivals}
          onSaved={(section) => applySection("newArrivals", section)}
          embedded
          onDirtyChange={handleDirty}
        />
      );
    case "kits":
      return (
        <SpotlightEditor
          meta={KITS_META}
          section={content.kits}
          onSaved={(section) => applySection("kits", section)}
          embedded
          onDirtyChange={handleDirty}
        />
      );
    case "advice":
      return (
        <AdviceEditor
          section={content.advice}
          onSaved={(section) => applySection("advice", section)}
          embedded
          onDirtyChange={handleDirty}
        />
      );
    case "pageCovers":
      return (
        <PageCoversEditor
          section={content.pageCovers}
          onSaved={(section) => applySection("pageCovers", section)}
          offerBanner={content.offerBanner}
          onOfferBannerSaved={(section) => applySection("offerBanner", section)}
          embedded
          onDirtyChange={handleDirty}
        />
      );
  }
}

export { HomeBlockEditor };
