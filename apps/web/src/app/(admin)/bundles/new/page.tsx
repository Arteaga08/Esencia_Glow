"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, ApiRequestError } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BundleBaseFields, type BundleBaseFieldsValue } from "@/components/bundles/bundle-base-fields";
import { BundleItemEditor } from "@/components/bundles/bundle-item-editor";
import { ContentBlockEditor, type ContentItem } from "@/components/products/content-block-editor";
import { PendingImagePicker } from "@/components/products/pending-image-picker";
import { pesosInputToCents } from "@/lib/format-money";
import { scopeErrors } from "@/lib/field-errors";
import type { AdminBundle, AdminBundleItem } from "@/lib/types/admin-catalog";

interface ContentState {
  ingredients: ContentItem[];
  routineSteps: ContentItem[];
  usage: ContentItem[];
  benefits: ContentItem[];
}

const EMPTY_CONTENT: ContentState = { ingredients: [], routineSteps: [], usage: [], benefits: [] };

/**
 * Alta de paquete (Milestone 2.2.3, Fase 3) — a diferencia de Producto, todo
 * viaja en un solo `POST` (nombre, precio, `listPrice`, `badgeId`, `content`,
 * `items`): el backend no divide bundle en subrutas por bloque, así que no
 * hace falta el patrón de "guardar cada pieza por su cuenta" de
 * `products/[id]/page.tsx`. Las fotos siguen el mismo criterio que
 * Producto: se ELIGEN aquí (`PendingImagePicker`) y se SUBEN justo después
 * de que el `POST` responde con un id real.
 */
export default function NewBundlePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [base, setBase] = useState<BundleBaseFieldsValue>({
    name: "",
    description: "",
    price: "",
    listPrice: "",
    badgeId: null,
  });
  const [items, setItems] = useState<AdminBundleItem[]>([]);
  const [componentsSum, setComponentsSum] = useState(0);
  const [content, setContent] = useState<ContentState>(EMPTY_CONTENT);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function handleBaseChange(patch: Partial<BundleBaseFieldsValue>) {
    setBase((current) => ({ ...current, ...patch }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) {
      setFieldErrors({ items: "El paquete necesita al menos un componente" });
      return;
    }
    setSubmitting(true);
    setFieldErrors({});
    try {
      const response = await apiRequest<AdminBundle>("/api/v1/admin/bundles", {
        method: "POST",
        authenticated: true,
        body: {
          name: base.name,
          description: base.description,
          price: pesosInputToCents(base.price) ?? 0,
          listPrice: pesosInputToCents(base.listPrice),
          badgeId: base.badgeId,
          content,
          items,
        },
      });
      toast({ variant: "success", title: "Paquete creado", description: response.data.name });

      if (pendingImages.length > 0) {
        try {
          const formData = new FormData();
          for (const file of pendingImages) formData.append("images", file);
          await apiRequest(`/api/v1/admin/bundles/${response.data.id}/images`, {
            method: "POST",
            authenticated: true,
            body: formData,
          });
        } catch (imageError) {
          toast({
            variant: "error",
            title: "El paquete se creó, pero las fotos no se pudieron subir",
            description:
              imageError instanceof ApiRequestError ? imageError.message : "Agrégalas desde la edición.",
          });
        }
      }

      router.push(`/bundles/${response.data.id}`);
    } catch (error) {
      if (error instanceof ApiRequestError && error.fieldErrors) {
        setFieldErrors(error.fieldErrors);
        toast({ variant: "error", title: "Revisa los campos marcados", description: error.message });
      } else {
        toast({
          variant: "error",
          title: "No se pudo crear el paquete",
          description: error instanceof ApiRequestError ? error.message : "Intenta de nuevo.",
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-6xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-body text-muted-foreground-strong">Nuevo paquete</p>
        <Button type="submit" variant="primary" loading={submitting}>
          Crear paquete
        </Button>
      </div>

      <Card>
        <BundleBaseFields
          value={base}
          onChange={handleBaseChange}
          componentsSum={componentsSum}
          errors={fieldErrors}
        />
      </Card>

      <BundleItemEditor items={items} onChange={setItems} onSumChange={setComponentsSum} error={fieldErrors.items} />

      <Card>
        <div className="flex flex-col gap-6">
          <ContentBlockEditor
            label="Beneficios"
            items={content.benefits}
            onChange={(next) => setContent((c) => ({ ...c, benefits: next }))}
            titlePlaceholder="Ahorro real"
            textPlaceholder="14% más barato que comprar los productos por separado."
            errors={scopeErrors(fieldErrors, "content.benefits.")}
          />
          <ContentBlockEditor
            label="Ingredientes"
            items={content.ingredients}
            onChange={(next) => setContent((c) => ({ ...c, ingredients: next }))}
            titlePlaceholder="Niacinamida al 10%"
            textPlaceholder="Regula la producción de sebo y afina la textura."
            errors={scopeErrors(fieldErrors, "content.ingredients.")}
          />
          <ContentBlockEditor
            label="Pasos de rutina"
            items={content.routineSteps}
            onChange={(next) => setContent((c) => ({ ...c, routineSteps: next }))}
            titlePlaceholder="Paso 2"
            textPlaceholder="Aplica sobre el rostro limpio y seco."
            errors={scopeErrors(fieldErrors, "content.routineSteps.")}
          />
          <ContentBlockEditor
            label="Modo de uso"
            items={content.usage}
            onChange={(next) => setContent((c) => ({ ...c, usage: next }))}
            titlePlaceholder="Por la noche"
            textPlaceholder="Úsalo después del tónico y antes de la crema hidratante."
            errors={scopeErrors(fieldErrors, "content.usage.")}
          />
        </div>
      </Card>

      <Card>
        <PendingImagePicker
          files={pendingImages}
          onChange={setPendingImages}
          onRejected={(message) => toast({ variant: "warning", title: "Foto no agregada", description: message })}
        />
      </Card>
    </form>
  );
}
