import type { CSSProperties } from "react";

type SkeletonTone = "plain" | "blush";

/**
 * Bloque base de todo skeleton de la tienda: un rectángulo con un brillo que lo
 * cruza (ver `storefront-states.css`). Es decorativo: `aria-hidden`.
 */
function SkeletonBlock({ className = "", tone = "plain" }: { className?: string; tone?: SkeletonTone }) {
  return <div aria-hidden="true" data-tone={tone === "blush" ? "blush" : undefined} className={`sk ${className}`} />;
}

/** Posición de una sección en el barrido: la que va más abajo arranca más tarde. */
function sweepStep(index: number): CSSProperties {
  return { "--sk-i": index } as CSSProperties;
}

export type { SkeletonTone };
export { SkeletonBlock, sweepStep };
