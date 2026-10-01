import { StarFour } from "@phosphor-icons/react/ssr";
import Link from "next/link";

/**
 * Wordmark + destello de marca (DESIGN.md §5). Es la única aparición del
 * destello en la barra: marca un momento, no decora.
 */
function BrandLogo({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/"
      onClick={onNavigate}
      aria-label="Esencia Glow, ir al inicio"
      className="inline-flex min-h-11 shrink-0 whitespace-nowrap items-center gap-1.5 rounded-sm text-section-title text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      Esencia Glow
      <StarFour
        weight="fill"
        size={14}
        aria-hidden="true"
        className="mb-2 text-accent-foreground-strong"
      />
    </Link>
  );
}

export { BrandLogo };
