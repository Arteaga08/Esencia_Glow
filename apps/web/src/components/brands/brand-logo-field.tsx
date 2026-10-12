"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Image as ImageIcon, Trash } from "@phosphor-icons/react";
import { useToast } from "@/components/ui/toast";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface BrandLogoFieldProps {
  /** Logo guardado de la marca; `undefined` si no tiene. */
  currentUrl?: string;
  file: File | null;
  removed: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
}

/**
 * Selector del logo de la marca: arrastrar o elegir un archivo, vista previa
 * sobre fondo beige (un PNG transparente con letras claras se vería vacío
 * sobre blanco), reemplazar y quitar. No sube nada: el modal entrega el
 * archivo y la página lo manda a `PUT /admin/brands/:id/logo` al guardar.
 */
function BrandLogoField({ currentUrl, file, removed, onPick, onRemove }: BrandLogoFieldProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // useMemo crea la URL de objeto y el efecto solo limpia: nunca setState
  // síncrono en un efecto (react-hooks/set-state-in-effect).
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function handleFiles(fileList: FileList | null) {
    const picked = fileList?.[0];
    if (!picked) return;
    if (!ALLOWED_TYPES.includes(picked.type)) {
      toast({ variant: "error", title: "Formato no soportado", description: "Usa JPG, PNG o WEBP." });
      return;
    }
    if (picked.size > MAX_FILE_SIZE_BYTES) {
      toast({ variant: "error", title: "La imagen pesa más de 5 MB" });
      return;
    }
    onPick(picked);
    if (inputRef.current) inputRef.current.value = "";
  }

  const shownUrl = preview ?? (removed ? undefined : currentUrl);

  return (
    <div>
      <p className="mb-2 font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">Logo</p>
      {shownUrl ? (
        <div className="flex items-center gap-3">
          <div className="flex h-20 w-40 items-center justify-center rounded-md bg-secondary p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shownUrl} alt="" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="flex flex-col items-start gap-1.5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="cursor-pointer text-body-sm text-primary-action hover:underline"
            >
              Reemplazar
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="flex cursor-pointer items-center gap-1 text-body-sm text-destructive-action hover:underline"
            >
              <Trash size={13} aria-hidden="true" />
              Quitar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            handleFiles(event.dataTransfer.files);
          }}
          className={
            "flex min-h-28 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border-2 " +
            "border-dashed text-center transition-colors duration-[var(--duration-fast)] " +
            (dragging ? "border-primary-action bg-muted/60" : "border-border-strong bg-muted/30 hover:bg-muted/50")
          }
        >
          <ImageIcon size={24} weight="regular" className="text-muted-foreground-strong" aria-hidden="true" />
          <p className="text-body-sm text-foreground">Arrastra el logo o haz clic</p>
          <p className="text-body-sm text-muted-foreground">JPG, PNG o WEBP, hasta 5 MB. Mejor con fondo transparente</p>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => handleFiles(event.target.files)}
      />
    </div>
  );
}

export { BrandLogoField };
