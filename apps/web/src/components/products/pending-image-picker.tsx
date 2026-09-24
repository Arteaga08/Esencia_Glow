"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Image as ImageIcon, Trash } from "@phosphor-icons/react";

const MAX_FILES = 8;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface PendingImagePickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  onRejected: (message: string) => void;
}

/**
 * Fotos elegidas ANTES de que el producto exista (Milestone 2.2.1: Manuel
 * pidió no partir el alta en dos pasos). No sube nada todavía — solo junta
 * archivos en el navegador; quien la usa (`products/new/page.tsx`) las sube
 * de verdad contra `POST /:id/images` justo después de crear el producto.
 * Mismos límites que multer del lado del servidor (8 archivos, 5 MB,
 * JPG/PNG/WEBP) para no dejar que el operador junte algo que el backend va
 * a rechazar de todas formas.
 */
function PendingImagePicker({ files, onChange, onRejected }: PendingImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  // `useMemo`, no `useEffect` + `setState` (react-hooks/set-state-in-effect
  // lo rechaza) y no un `ref` leído en render (react-hooks/refs también lo
  // rechaza) — las miniaturas se calculan durante el render a partir de
  // `files`, y el único efecto de abajo SOLO limpia, nunca asigna estado:
  // su cuerpo está vacío, es puro cleanup atado a esta misma versión del
  // mapa. Patrón estándar para URLs de objeto de una selección de archivos.
  const previews = useMemo(() => {
    const map = new Map<File, string>();
    for (const file of files) map.set(file, URL.createObjectURL(file));
    return map;
  }, [files]);

  useEffect(() => {
    return () => {
      for (const url of previews.values()) URL.revokeObjectURL(url);
    };
  }, [previews]);

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const incoming = Array.from(fileList);
    const accepted: File[] = [];

    for (const file of incoming) {
      if (files.length + accepted.length >= MAX_FILES) {
        onRejected(`Solo puedes agregar hasta ${MAX_FILES} fotos.`);
        break;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        onRejected(`${file.name}: formato no soportado. Usa JPG, PNG o WEBP.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        onRejected(`${file.name}: pesa más de 5 MB.`);
        continue;
      }
      accepted.push(file);
    }

    if (accepted.length > 0) onChange([...files, ...accepted]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeFile(file: File) {
    onChange(files.filter((f) => f !== file));
  }

  return (
    <div>
      <p className="mb-2 font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">
        Fotos
      </p>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFilesSelected(e.dataTransfer.files);
        }}
        disabled={files.length >= MAX_FILES}
        className={
          "flex min-h-44 w-full flex-col items-center justify-center gap-2 rounded-md border-2 " +
          "border-dashed text-center transition-colors duration-[var(--duration-fast)] " +
          (dragging
            ? "border-primary-action bg-muted/60"
            : "border-border-strong bg-muted/30 hover:bg-muted/50") +
          " disabled:cursor-not-allowed disabled:opacity-50"
        }
      >
        <ImageIcon size={32} weight="regular" className="text-muted-foreground-strong" aria-hidden="true" />
        <p className="text-body text-foreground">Arrastra imágenes o haz clic para agregar</p>
        <p className="text-body-sm text-muted-foreground">
          Hasta {MAX_FILES} fotos, JPG/PNG/WEBP, 5 MB cada una — se suben en cuanto creas el producto.
        </p>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => handleFilesSelected(e.target.files)}
      />

      {files.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className="overflow-hidden rounded-md border border-border bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previews.get(file)}
                alt=""
                className="aspect-square w-full object-cover"
              />
              <div className="flex items-center justify-between p-1.5">
                <p className="truncate text-body-sm text-muted-foreground-strong">{file.name}</p>
                <button
                  type="button"
                  onClick={() => removeFile(file)}
                  aria-label={`Quitar ${file.name}`}
                  className="shrink-0 rounded-sm p-1 text-destructive-action hover:bg-destructive/30"
                >
                  <Trash size={13} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export { PendingImagePicker };
