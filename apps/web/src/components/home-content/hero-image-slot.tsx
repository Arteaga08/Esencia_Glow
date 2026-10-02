"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Image as ImageIcon, Trash } from "@phosphor-icons/react";
import { FieldError } from "@/components/ui/field-error";
import type { HeroImageDraft } from "./hero-form-value";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface HeroImageSlotProps {
  label: string;
  /** Medida exacta que pide el hero en la tienda, p. ej. "1920 × 1080 px · horizontal". */
  dimensions: string;
  /** Proporción de la vista previa, la misma que tendrá en la tienda. */
  aspectClassName: string;
  draft: HeroImageDraft;
  onChange: (draft: HeroImageDraft) => void;
}

/**
 * Una de las dos fotos del slide (escritorio o móvil). No sube nada: junta el
 * archivo en el navegador y el guardado del hero lo envía. Mismos límites que
 * multer del servidor (5 MB, JPG/PNG/WEBP).
 */
function HeroImageSlot({ label, dimensions, aspectClassName, draft, onChange }: HeroImageSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rejected, setRejected] = useState<string | null>(null);

  const previewUrl = useMemo(
    () => (draft.file ? URL.createObjectURL(draft.file) : null),
    [draft.file],
  );
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const shownUrl = previewUrl ?? (draft.removed ? null : (draft.existing?.url ?? null));

  function handleFile(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) return setRejected("Usa una imagen JPG, PNG o WEBP.");
    if (file.size > MAX_FILE_SIZE_BYTES)
      return setRejected("La imagen pesa más de 5 MB. Comprímela e inténtalo de nuevo.");
    setRejected(null);
    onChange({ ...draft, file, removed: false });
  }

  function handleRemove() {
    setRejected(null);
    onChange({ existing: draft.existing, removed: Boolean(draft.existing) });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">
        {label}
      </p>
      <p className="-mt-1 text-body-sm text-foreground">
        Medida: <span className="font-medium">{dimensions}</span>
      </p>
      <div
        className={`relative overflow-hidden rounded-md border border-border bg-muted/30 ${aspectClassName}`}
      >
        {shownUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:) o de Cloudinary
          <img src={shownUrl} alt="" className="size-full object-cover" />
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex size-full cursor-pointer flex-col items-center justify-center gap-2 px-3 text-center hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          >
            <ImageIcon size={28} className="text-muted-foreground-strong" aria-hidden="true" />
            <span className="text-body-sm text-foreground">Elegir imagen</span>
            <span className="text-body-sm text-muted-foreground">JPG, PNG o WEBP · máx. 5 MB</span>
          </button>
        )}
      </div>
      {shownUrl ? (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="cursor-pointer text-body-sm text-foreground underline underline-offset-2 hover:text-primary-action"
          >
            Cambiar
          </button>
          <button
            type="button"
            onClick={handleRemove}
            className="inline-flex cursor-pointer items-center gap-1 text-body-sm text-destructive-action hover:underline"
          >
            <Trash size={14} aria-hidden="true" />
            Quitar
          </button>
        </div>
      ) : null}
      {rejected ? <FieldError message={rejected} /> : null}
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        hidden
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
    </div>
  );
}

export { HeroImageSlot };
