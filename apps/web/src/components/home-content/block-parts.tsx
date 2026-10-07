"use client";

import { useCallback, useState } from "react";
import { Image as ImageIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import type { HomeBlockId, HomeBlockSummary } from "./home-blocks";

type DirtyMap = Partial<Record<HomeBlockId, boolean>>;

/** Quién tiene cambios sin guardar, para mostrarlo aunque su editor esté cerrado u oculto. */
function useDirtyBlocks() {
  const [dirty, setDirty] = useState<DirtyMap>({});
  const report = useCallback((id: HomeBlockId, value: boolean) => {
    setDirty((current) => (current[id] === value ? current : { ...current, [id]: value }));
  }, []);
  return { dirty, report };
}

/** Estado del bloque en la tienda + aviso de borrador. "No se publica" = activo pero incompleto. */
function BlockStatusBadges({ block, dirty }: { block: HomeBlockSummary; dirty: boolean }) {
  return (
    <>
      {dirty ? <Badge color="warning">Cambios sin guardar</Badge> : null}
      {!block.isActive ? (
        <Badge color="neutral">Oculto</Badge>
      ) : block.issue ? (
        <Badge color="warning">No se publica</Badge>
      ) : (
        <Badge color="success">Visible</Badge>
      )}
    </>
  );
}

/** Miniatura de la foto de escritorio del bloque; sin foto, un hueco neutro que lo dice. */
function BlockThumb({ url, className }: { url: string | null; className: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- miniatura de Cloudinary en el panel, igual que hero-image-slot
  if (url) return <img src={url} alt="" className={"object-cover " + className} />;
  return (
    <div className={"flex items-center justify-center bg-muted text-muted-foreground " + className}>
      <ImageIcon size={20} aria-hidden="true" />
    </div>
  );
}

export type { DirtyMap };
export { BlockStatusBadges, BlockThumb, useDirtyBlocks };
