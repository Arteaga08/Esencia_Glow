import Image from "next/image";
import type { PreviewLine } from "./preview-types";

/**
 * Fondo de la vista del panel: la foto de un producto a pantalla completa,
 * como si el panel se hubiera abierto sobre su página. Solo existe para que el
 * panel no se vea flotando sobre un lienzo vacío.
 */
function DrawerBackdrop({ line }: { line?: PreviewLine }) {
  return (
    <div aria-hidden="true" className="relative min-h-[100dvh] bg-muted">
      {line?.image ? <Image src={line.image.url} alt="" fill priority sizes="100vw" className="object-cover" /> : null}
    </div>
  );
}

export { DrawerBackdrop };
