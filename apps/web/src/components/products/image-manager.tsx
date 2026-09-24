"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Image as ImageIcon, Trash } from "@phosphor-icons/react";
import { apiRequest, ApiRequestError } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import type { AdminProduct, AdminProductImage } from "@/lib/types/admin-catalog";

const MAX_IMAGES = 8;

interface ImageManagerProps {
  productId: string;
  images: AdminProductImage[];
  onChange: (images: AdminProductImage[]) => void;
}

/**
 * Solo existe en edición (`/products/[id]`): subir/reordenar/borrar viven en
 * subrutas del producto (`POST/PATCH/DELETE /:id/images...`), que necesitan
 * un `productId` real — en alta no hay dónde adjuntarlas todavía (ver la
 * nota en `products/new/page.tsx`). Máx 8 imágenes, 5 MB, JPG/PNG/WEBP
 * (mismos límites que multer, apps/api/src/middlewares/upload-image.ts).
 */
function ImageManager({ productId, images, onChange }: ImageManagerProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      for (const file of Array.from(fileList)) formData.append("images", file);
      const response = await apiRequest<AdminProduct>(`/api/v1/admin/products/${productId}/images`, {
        method: "POST",
        authenticated: true,
        body: formData,
      });
      onChange(response.data.images);
      toast({ variant: "success", title: "Imágenes subidas" });
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudieron subir las imágenes",
        description: error instanceof ApiRequestError ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function persistOrder(nextOrder: AdminProductImage[]) {
    const previous = images;
    onChange(nextOrder); // optimista: se revierte si la API rechaza
    try {
      const response = await apiRequest<AdminProduct>(`/api/v1/admin/products/${productId}/images/order`, {
        method: "PATCH",
        authenticated: true,
        body: { imageIds: nextOrder.map((img) => img.id) },
      });
      onChange(response.data.images);
    } catch (error) {
      onChange(previous);
      toast({
        variant: "error",
        title: "No se pudo reordenar",
        description: error instanceof ApiRequestError ? error.message : "Intenta de nuevo.",
      });
    }
  }

  function moveImage(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target]!, next[index]!];
    void persistOrder(next);
  }

  async function removeImage(imageId: string) {
    try {
      const response = await apiRequest<AdminProduct>(
        `/api/v1/admin/products/${productId}/images/${imageId}`,
        { method: "DELETE", authenticated: true },
      );
      onChange(response.data.images);
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo borrar la imagen",
        description: error instanceof ApiRequestError ? error.message : "Intenta de nuevo.",
      });
    }
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
        disabled={images.length >= MAX_IMAGES || uploading}
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
        <p className="text-body text-foreground">
          {uploading ? "Subiendo…" : "Arrastra imágenes o haz clic para agregar"}
        </p>
        <p className="text-body-sm text-muted-foreground">
          Hasta {MAX_IMAGES} fotos, JPG/PNG/WEBP, 5 MB cada una.
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

      {images.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((image, index) => (
            <div key={image.id} className="overflow-hidden rounded-md border border-border bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt={image.alt ?? ""} className="aspect-square w-full object-cover" />
              <div className="flex items-center justify-between p-1.5">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => moveImage(index, -1)}
                    disabled={index === 0}
                    aria-label="Mover antes"
                    className="rounded-sm p-1 text-muted-foreground-strong hover:bg-muted disabled:opacity-40"
                  >
                    <ArrowUp size={13} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveImage(index, 1)}
                    disabled={index === images.length - 1}
                    aria-label="Mover después"
                    className="rounded-sm p-1 text-muted-foreground-strong hover:bg-muted disabled:opacity-40"
                  >
                    <ArrowDown size={13} aria-hidden="true" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeImage(image.id)}
                  aria-label="Borrar imagen"
                  className="rounded-sm p-1 text-destructive-action hover:bg-destructive/30"
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

export { ImageManager };
