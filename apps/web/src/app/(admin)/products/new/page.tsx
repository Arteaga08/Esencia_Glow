"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "@phosphor-icons/react";
import { apiRequest, ApiRequestError } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProductBaseFields, type ProductBaseFieldsValue } from "@/components/products/product-base-fields";
import { VariantRow } from "@/components/products/variant-row";
import { emptyVariantDraft, type VariantDraft } from "@/components/products/variant-fields";
import { ContentBlockEditor, type ContentItem } from "@/components/products/content-block-editor";
import { PendingImagePicker } from "@/components/products/pending-image-picker";
import { pesosInputToCents } from "@/lib/format-money";
import { scopeErrors } from "@/lib/field-errors";
import { suggestSku } from "@/lib/sku-suggestion";
import type { AdminProduct } from "@/lib/types/admin-catalog";

interface ContentState {
  ingredients: ContentItem[];
  routineSteps: ContentItem[];
  usage: ContentItem[];
  benefits: ContentItem[];
}

/**
 * Alta de producto — el editor completo (Milestone 2.2.1, Fase 4): el
 * producto es un cascarón, las variantes llevan el precio/SKU/stock real.
 * Las fotos se ELIGEN aquí mismo (`PendingImagePicker`, solo en el
 * navegador) y se SUBEN de verdad justo después de que el POST de creación
 * responde con un `id` real — la subruta de imágenes no existe hasta
 * entonces. El ajuste fino de existencias sí queda para después de crear
 * (necesita el inventario, Milestone 1.4, que resuelve por variante ya
 * persistida); al guardar se cierra el alta y se vuelve al listado, desde
 * donde el operador reabre el producto si necesita ese ajuste.
 */
export default function NewProductPage() {
  const router = useRouter();
  const { toast } = useToast();
  const variantIdSeed = useId();

  const [base, setBase] = useState<ProductBaseFieldsValue>({
    name: "",
    description: "",
    shortDescription: "",
    categoryId: null,
    badgeId: null,
    channel: "store",
  });
  const [variants, setVariants] = useState<VariantDraft[]>([emptyVariantDraft(`${variantIdSeed}-0`)]);
  const [content, setContent] = useState<ContentState>({
    ingredients: [],
    routineSteps: [],
    usage: [],
    benefits: [],
  });
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function updateVariant(tempId: string, patch: Partial<VariantDraft>) {
    setVariants((current) =>
      current.map((v) => {
        if (v.tempId !== tempId) return v;
        const next = { ...v, ...patch };
        // El nombre de la variante cambió y nadie tocó el SKU a mano todavía:
        // se regenera la sugerencia contra el nombre del producto vigente.
        if (!next.skuTouched && patch.name !== undefined) {
          next.sku = suggestSku(base.name, next.name);
        }
        return next;
      }),
    );
  }

  /** El nombre del PRODUCTO cambió: recalcula el SKU sugerido de toda
   * variante que el operador todavía no haya tocado a mano. */
  function handleBaseChange(patch: Partial<ProductBaseFieldsValue>) {
    setBase((c) => ({ ...c, ...patch }));
    if (patch.name !== undefined) {
      const nextName = patch.name;
      setVariants((current) =>
        current.map((v) => (v.skuTouched ? v : { ...v, sku: suggestSku(nextName, v.name) })),
      );
    }
  }

  function removeVariant(tempId: string) {
    setVariants((current) => current.filter((v) => v.tempId !== tempId));
  }

  function addVariant() {
    setVariants((current) => [...current, emptyVariantDraft(`${variantIdSeed}-${current.length}`)]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!base.categoryId) {
      setFieldErrors({ categoryId: "Elige una categoría" });
      return;
    }
    setSubmitting(true);
    setFieldErrors({});
    try {
      const response = await apiRequest<AdminProduct>("/api/v1/admin/products", {
        method: "POST",
        authenticated: true,
        body: {
          name: base.name,
          description: base.description,
          shortDescription: base.shortDescription || undefined,
          categoryId: base.categoryId,
          badgeId: base.badgeId,
          channel: base.channel,
          content: {
            ingredients: content.ingredients,
            routineSteps: content.routineSteps,
            usage: content.usage,
            benefits: content.benefits,
          },
          variants: variants.map((draft) => ({
            sku: draft.sku.trim(),
            name: draft.name.trim(),
            attributes: {
              ...(draft.size ? { size: draft.size } : {}),
              ...(draft.shade ? { shade: draft.shade } : {}),
              ...(draft.volume ? { volume: draft.volume } : {}),
            },
            price: pesosInputToCents(draft.price) ?? 0,
            ...(pesosInputToCents(draft.listPrice) !== null
              ? { listPrice: pesosInputToCents(draft.listPrice) }
              : {}),
            weightGrams: Number(draft.weightGrams) || 0,
            dimensionsCm: {
              length: Number(draft.length) || 0,
              width: Number(draft.width) || 0,
              height: Number(draft.height) || 0,
            },
            isActive: draft.isActive,
            ...(draft.initialStock.trim() !== "" ? { initialStock: Number(draft.initialStock) } : {}),
          })),
        },
      });
      toast({ variant: "success", title: "Producto creado", description: response.data.name });

      // El producto ya tiene id: recién ahora existe la subruta de fotos.
      // Un fallo aquí no deshace la creación — el producto es válido sin
      // fotos, y el operador puede agregarlas en la edición.
      if (pendingImages.length > 0) {
        try {
          const formData = new FormData();
          for (const file of pendingImages) formData.append("images", file);
          await apiRequest(`/api/v1/admin/products/${response.data.id}/images`, {
            method: "POST",
            authenticated: true,
            body: formData,
          });
        } catch (imageError) {
          toast({
            variant: "error",
            title: "El producto se creó, pero las fotos no se pudieron subir",
            description:
              imageError instanceof ApiRequestError ? imageError.message : "Agrégalas desde la edición.",
          });
        }
      }

      router.push("/products");
    } catch (error) {
      if (error instanceof ApiRequestError && error.fieldErrors) {
        setFieldErrors(error.fieldErrors);
        toast({ variant: "error", title: "Revisa los campos marcados", description: error.message });
      } else {
        toast({
          variant: "error",
          title: "No se pudo crear el producto",
          description: error instanceof ApiRequestError ? error.message : "Intenta de nuevo.",
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-6xl flex-col gap-6">
      <p className="text-body text-muted-foreground-strong">Nuevo producto</p>

      <Card>
        <ProductBaseFields value={base} onChange={handleBaseChange} errors={fieldErrors} />
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">
            Variantes
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={addVariant}>
            <Plus size={14} weight="bold" aria-hidden="true" />
            Agregar variante
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          {variants.map((draft, index) => (
            <VariantRow
              key={draft.tempId}
              index={index}
              draft={draft}
              onChange={(patch) => updateVariant(draft.tempId, patch)}
              onRemove={() => removeVariant(draft.tempId)}
              showInitialStock
              errors={scopeErrors(fieldErrors, `variants.${index}.`)}
            />
          ))}
        </div>
        {fieldErrors.variants ? (
          <p className="mt-2 text-body-sm text-destructive-action">{fieldErrors.variants}</p>
        ) : null}
      </Card>

      <Card>
        <div className="flex flex-col gap-6">
          <ContentBlockEditor
            label="Ingredientes"
            items={content.ingredients}
            onChange={(items) => setContent((c) => ({ ...c, ingredients: items }))}
            titlePlaceholder="Niacinamida al 10%"
            textPlaceholder="Regula la producción de sebo y afina la textura."
            errors={scopeErrors(fieldErrors, "content.ingredients.")}
          />
          <ContentBlockEditor
            label="Pasos de rutina"
            items={content.routineSteps}
            onChange={(items) => setContent((c) => ({ ...c, routineSteps: items }))}
            titlePlaceholder="Paso 2"
            textPlaceholder="Aplica 3 gotas sobre el rostro limpio y seco."
            errors={scopeErrors(fieldErrors, "content.routineSteps.")}
          />
          <ContentBlockEditor
            label="Modo de uso"
            items={content.usage}
            onChange={(items) => setContent((c) => ({ ...c, usage: items }))}
            titlePlaceholder="Por la noche"
            textPlaceholder="Úsalo después del tónico y antes de la crema hidratante."
            errors={scopeErrors(fieldErrors, "content.usage.")}
          />
          <ContentBlockEditor
            label="Beneficios"
            items={content.benefits}
            onChange={(items) => setContent((c) => ({ ...c, benefits: items }))}
            titlePlaceholder="Hidratación profunda"
            textPlaceholder="Retiene humedad por hasta 24 horas."
            errors={scopeErrors(fieldErrors, "content.benefits.")}
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

      <div>
        <Button type="submit" variant="primary" loading={submitting}>
          Crear producto
        </Button>
      </div>
    </form>
  );
}
