import Image from "next/image";
import type { PreviewLine } from "./preview-types";

interface LineThumbProps {
  line: PreviewLine;
  /** Tamaño y proporción, p. ej. "h-24 w-20". La foto llena el recuadro. */
  className: string;
  sizes: string;
}

/** Miniatura de una línea del carrito. Sin foto (respaldo sin API) cae a la inicial del producto. */
function LineThumb({ line, className, sizes }: LineThumbProps) {
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-md bg-muted ${line.available ? "" : "opacity-50"} ${className}`}>
      {line.image ? (
        <Image src={line.image.url} alt="" fill sizes={sizes} className="object-cover" />
      ) : (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center font-mono text-subtitle text-muted-foreground-strong">
          {line.name.charAt(0)}
        </span>
      )}
    </div>
  );
}

export { LineThumb };
