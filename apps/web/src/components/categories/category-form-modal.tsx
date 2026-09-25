"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Image as ImageIcon, Trash } from "@phosphor-icons/react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, ApiRequestError } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import type { AdminCategory } from "@/lib/types/admin-catalog";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

type CategoryFormTarget =
  | { mode: "create"; parentId: string | null }
  | { mode: "edit"; category: AdminCategory };

interface CategoryFormModalProps {
  target: CategoryFormTarget | null;
  onClose: () => void;
  onSaved: (category: AdminCategory) => void;
}

/**
 * Alta y edición de categoría/subcategoría en un solo modal — cabe inline
 * (DESIGN.md:545), a diferencia del editor de Producto (página completa: ahí
 * sí hay variantes, existencias y contenido editorial). Solo tres campos:
 * nombre, descripción, una imagen. La imagen se sube contra
 * `PUT /:id/image` (reemplazo idempotente, una sola foto), así que en alta
 * primero se crea la categoría y, si ya hay una foto elegida, se sube justo
 * después con el id real — mismo criterio que las fotos de producto en
 * 2.2.1, a escala de un modal en vez de una página.
 */
function CategoryFormModal({ target, onClose, onSaved }: CategoryFormModalProps) {
  if (!target) return null;
  const key = target.mode === "edit" ? `edit-${target.category.id}` : `create-${target.parentId ?? "root"}`;
  return <CategoryFormModalBody key={key} target={target} onClose={onClose} onSaved={onSaved} />;
}

function CategoryFormModalBody({
  target,
  onClose,
  onSaved,
}: {
  target: CategoryFormTarget;
  onClose: () => void;
  onSaved: (category: AdminCategory) => void;
}) {
  const { toast } = useToast();
  const existing = target.mode === "edit" ? target.category : null;
  const isSubcategory = target.mode === "edit" ? existing!.parentId !== null : target.parentId !== null;

  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  // Mismo patrón que PendingImagePicker: useMemo crea la URL de objeto, el
  // único efecto SOLO limpia — nunca setState síncrono en su cuerpo
  // (react-hooks/set-state-in-effect).
  const preview = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : null), [imageFile]);
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function handleFileSelected(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({ variant: "error", title: "Formato no soportado", description: "Usa JPG, PNG o WEBP." });
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast({ variant: "error", title: "La imagen pesa más de 5 MB" });
      return;
    }
    setImageFile(file);
    setRemoveImage(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    try {
      let category: AdminCategory;
      if (target.mode === "create") {
        const response = await apiRequest<AdminCategory>("/api/v1/admin/categories", {
          method: "POST",
          authenticated: true,
          body: { name, description: description || undefined, parentId: target.parentId },
        });
        category = response.data;
      } else {
        const response = await apiRequest<AdminCategory>(`/api/v1/admin/categories/${target.category.id}`, {
          method: "PATCH",
          authenticated: true,
          body: { name, description },
        });
        category = response.data;
      }

      if (imageFile) {
        const formData = new FormData();
        formData.append("image", imageFile);
        const response = await apiRequest<AdminCategory>(`/api/v1/admin/categories/${category.id}/image`, {
          method: "PUT",
          authenticated: true,
          body: formData,
        });
        category = response.data;
      } else if (removeImage && existing?.image) {
        const response = await apiRequest<AdminCategory>(`/api/v1/admin/categories/${category.id}/image`, {
          method: "DELETE",
          authenticated: true,
        });
        category = response.data;
      }

      toast({
        variant: "success",
        title:
          target.mode === "create"
            ? isSubcategory
              ? "Subcategoría creada"
              : "Categoría creada"
            : "Cambios guardados",
        description: category.name,
      });
      onSaved(category);
    } catch (error) {
      if (error instanceof ApiRequestError && error.fieldErrors) {
        setFieldErrors(error.fieldErrors);
      } else {
        toast({
          variant: "error",
          title: "No se pudo guardar",
          description: error instanceof ApiRequestError ? error.message : "Intenta de nuevo.",
        });
      }
    } finally {
      setSaving(false);
    }
  }

  const title =
    target.mode === "create"
      ? isSubcategory
        ? "Nueva subcategoría"
        : "Nueva categoría"
      : isSubcategory
        ? "Editar subcategoría"
        : "Editar categoría";

  const currentImageUrl = !removeImage ? existing?.image?.url : undefined;

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="category-form" loading={saving}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nombre"
          placeholder={isSubcategory ? "Pan dulce" : "Panadería Tradicional"}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fieldErrors.name}
          required
        />
        <Textarea
          label="Descripción"
          placeholder="Describe brevemente qué productos agrupa esta categoría…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={fieldErrors.description}
        />

        <div>
          <p className="mb-2 font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">
            Imagen
          </p>
          {preview || currentImageUrl ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview ?? currentImageUrl} alt="" className="h-20 w-20 rounded-md object-cover" />
              <div className="flex flex-col items-start gap-1.5">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="text-body-sm text-primary-action hover:underline"
                >
                  Reemplazar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    setRemoveImage(true);
                  }}
                  className="flex items-center gap-1 text-body-sm text-destructive-action hover:underline"
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
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                handleFileSelected(e.dataTransfer.files);
              }}
              className={
                "flex min-h-28 w-full flex-col items-center justify-center gap-1.5 rounded-md border-2 " +
                "border-dashed text-center transition-colors duration-[var(--duration-fast)] " +
                (dragging
                  ? "border-primary-action bg-muted/60"
                  : "border-border-strong bg-muted/30 hover:bg-muted/50")
              }
            >
              <ImageIcon size={24} weight="regular" className="text-muted-foreground-strong" aria-hidden="true" />
              <p className="text-body-sm text-foreground">Arrastra una imagen o haz clic</p>
              <p className="text-body-sm text-muted-foreground">JPG, PNG o WEBP, hasta 5 MB</p>
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => handleFileSelected(e.target.files)}
          />
        </div>
      </form>
    </Modal>
  );
}

export type { CategoryFormTarget };
export { CategoryFormModal };
