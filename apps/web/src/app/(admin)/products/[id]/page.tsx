"use client";

import { useEffect, useId, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus } from "@phosphor-icons/react";
import { apiRequest, ApiRequestError } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { ProductBaseFields, type ProductBaseFieldsValue } from "@/components/products/product-base-fields";
import { VariantRow } from "@/components/products/variant-row";
import { emptyVariantDraft, type VariantDraft } from "@/components/products/variant-fields";
import { ContentBlockEditor, type ContentItem } from "@/components/products/content-block-editor";
import { ImageManager } from "@/components/products/image-manager";
import { InventoryPanel } from "@/components/products/inventory-panel";
import { centsToPesosInput, pesosInputToCents } from "@/lib/format-money";
import { scopeErrors } from "@/lib/field-errors";
import { suggestSku } from "@/lib/sku-suggestion";
import type { AdminProduct, AdminProductImage, AdminVariant } from "@/lib/types/admin-catalog";

interface ContentState {
  ingredients: ContentItem[];
  routineSteps: ContentItem[];
  usage: ContentItem[];
  benefits: ContentItem[];
}

function variantToDraft(variant: AdminVariant): VariantDraft {
  return {
    id: variant.id,
    tempId: variant.id,
    sku: variant.sku,
    // Ya vive en el servidor con un SKU real — nunca se le pisa con una
    // sugerencia, aunque el operador cambie el nombre de la variante.
    skuTouched: true,
    name: variant.name,
    price: centsToPesosInput(variant.price),
    listPrice: variant.listPrice ? centsToPesosInput(variant.listPrice) : "",
    weightGrams: String(variant.weightGrams),
    length: String(variant.dimensionsCm.length),
    width: String(variant.dimensionsCm.width),
    height: String(variant.dimensionsCm.height),
    size: variant.attributes.size ?? "",
    shade: variant.attributes.shade ?? "",
    volume: variant.attributes.volume ?? "",
    isActive: variant.isActive,
    initialStock: "",
  };
}

function draftToVariantPayload(draft: VariantDraft) {
  return {
    sku: draft.sku.trim(),
    name: draft.name.trim(),
    attributes: {
      ...(draft.size ? { size: draft.size } : {}),
      ...(draft.shade ? { shade: draft.shade } : {}),
      ...(draft.volume ? { volume: draft.volume } : {}),
    },
    price: pesosInputToCents(draft.price) ?? 0,
    listPrice: pesosInputToCents(draft.listPrice),
    weightGrams: Number(draft.weightGrams) || 0,
    dimensionsCm: {
      length: Number(draft.length) || 0,
      width: Number(draft.width) || 0,
      height: Number(draft.height) || 0,
    },
    isActive: draft.isActive,
  };
}

/**
 * Edición de producto — el mismo cascarón que la alta, pero cada pieza
 * persiste por su cuenta contra su propia subruta (así es como lo modela el
 * backend: el `PATCH` del producto no acepta `variants`, `slug` ni
 * `minPrice`). "Guardar cambios" (al fondo de la página, ligado al form vía
 * `form="edit-product-form"`) solo cubre los campos base + el contenido
 * editorial; variantes, fotos y existencias ya se guardaron en cuanto el
 * operador tocó su propio botón. Al guardar se cierra la edición y se
 * vuelve al listado.
 */
export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const newVariantSeed = useId();

  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [base, setBase] = useState<ProductBaseFieldsValue | null>(null);
  const [content, setContent] = useState<ContentState | null>(null);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [images, setImages] = useState<AdminProductImage[]>([]);

  const [baseErrors, setBaseErrors] = useState<Record<string, string>>({});
  const [savingBase, setSavingBase] = useState(false);
  const [savingVariantId, setSavingVariantId] = useState<string | null>(null);
  const [variantErrors, setVariantErrors] = useState<Record<string, Record<string, string>>>({});
  const [togglingPublish, setTogglingPublish] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiRequest<AdminProduct>(`/api/v1/admin/products/${params.id}`, { authenticated: true })
      .then((response) => {
        if (cancelled) return;
        const p = response.data;
        setProduct(p);
        setBase({
          name: p.name,
          description: p.description,
          shortDescription: p.shortDescription ?? "",
          categoryId: p.categoryId,
          badgeId: p.badgeId,
          channel: p.channel,
        });
        setContent({
          ingredients: p.content?.ingredients ?? [],
          routineSteps: p.content?.routineSteps ?? [],
          usage: p.content?.usage ?? [],
          benefits: p.content?.benefits ?? [],
        });
        setVariants(p.variants.map(variantToDraft));
        setImages(p.images);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof ApiRequestError ? error.message : "No pudimos cargar el producto.");
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  async function handleSaveBase(e: React.FormEvent) {
    e.preventDefault();
    if (!base || !content || !product) return;
    setSavingBase(true);
    setBaseErrors({});
    try {
      const response = await apiRequest<AdminProduct>(`/api/v1/admin/products/${product.id}`, {
        method: "PATCH",
        authenticated: true,
        body: {
          name: base.name,
          description: base.description,
          shortDescription: base.shortDescription || "",
          categoryId: base.categoryId,
          badgeId: base.badgeId,
          channel: base.channel,
          content,
        },
      });
      setProduct(response.data);
      toast({ variant: "success", title: "Cambios guardados" });
      router.push("/products");
    } catch (error) {
      if (error instanceof ApiRequestError && error.fieldErrors) {
        setBaseErrors(error.fieldErrors);
        toast({ variant: "error", title: "Revisa los campos marcados", description: error.message });
      } else {
        toast({
          variant: "error",
          title: "No se pudieron guardar los cambios",
          description: error instanceof ApiRequestError ? error.message : "Intenta de nuevo.",
        });
      }
    } finally {
      setSavingBase(false);
    }
  }

  function updateVariant(tempId: string, patch: Partial<VariantDraft>) {
    setVariants((current) =>
      current.map((v) => {
        if (v.tempId !== tempId) return v;
        const next = { ...v, ...patch };
        if (!next.skuTouched && patch.name !== undefined && base) {
          next.sku = suggestSku(base.name, next.name);
        }
        return next;
      }),
    );
  }

  /** Nombre del producto cambiado: recalcula el SKU sugerido de las
   * variantes nuevas (sin `id`) que el operador no haya tocado a mano —
   * las ya existentes siempre nacen con `skuTouched: true`, así que esto
   * nunca les pisa un SKU real. */
  function handleBaseChange(patch: Partial<ProductBaseFieldsValue>) {
    setBase((c) => c && { ...c, ...patch });
    if (patch.name !== undefined) {
      const nextName = patch.name;
      setVariants((current) =>
        current.map((v) => (v.skuTouched ? v : { ...v, sku: suggestSku(nextName, v.name) })),
      );
    }
  }

  function addVariant() {
    setVariants((current) => [...current, emptyVariantDraft(`${newVariantSeed}-${current.length}`)]);
  }

  async function saveVariant(draft: VariantDraft) {
    if (!product) return;
    setSavingVariantId(draft.tempId);
    setVariantErrors((current) => ({ ...current, [draft.tempId]: {} }));
    try {
      const payload = draftToVariantPayload(draft);
      const response = draft.id
        ? await apiRequest<AdminProduct>(`/api/v1/admin/products/${product.id}/variants/${draft.id}`, {
            method: "PATCH",
            authenticated: true,
            body: payload,
          })
        : await apiRequest<AdminProduct>(`/api/v1/admin/products/${product.id}/variants`, {
            method: "POST",
            authenticated: true,
            body: { ...payload, ...(draft.initialStock.trim() !== "" ? { initialStock: Number(draft.initialStock) } : {}) },
          });
      setProduct(response.data);
      setVariants(response.data.variants.map(variantToDraft));
      toast({ variant: "success", title: "Variante guardada", description: draft.sku });
    } catch (error) {
      if (error instanceof ApiRequestError && error.fieldErrors) {
        setVariantErrors((current) => ({ ...current, [draft.tempId]: error.fieldErrors! }));
      }
      toast({
        variant: "error",
        title: "No se pudo guardar la variante",
        description: error instanceof ApiRequestError ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setSavingVariantId(null);
    }
  }

  async function removeVariant(draft: VariantDraft) {
    if (!draft.id) {
      setVariants((current) => current.filter((v) => v.tempId !== draft.tempId));
      return;
    }
    if (!product) return;
    try {
      const response = await apiRequest<AdminProduct>(
        `/api/v1/admin/products/${product.id}/variants/${draft.id}`,
        { method: "DELETE", authenticated: true },
      );
      setProduct(response.data);
      setVariants(response.data.variants.map(variantToDraft));
      toast({ variant: "success", title: "Variante eliminada" });
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo eliminar la variante",
        description: error instanceof ApiRequestError ? error.message : "Intenta de nuevo.",
      });
    }
  }

  async function handleTogglePublish(nextActive: boolean) {
    if (!product) return;
    setTogglingPublish(true);
    try {
      const response = await apiRequest<AdminProduct>(`/api/v1/admin/products/${product.id}`, {
        method: "PATCH",
        authenticated: true,
        body: { status: nextActive ? "active" : "draft" },
      });
      setProduct(response.data);
      toast({ variant: "success", title: nextActive ? "Producto publicado" : "Producto despublicado" });
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo cambiar el estado",
        description: error instanceof ApiRequestError ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setTogglingPublish(false);
    }
  }

  if (loadError) {
    return <ErrorState description={loadError} />;
  }

  if (!product || !base || !content) {
    return (
      <div className="flex max-w-6xl flex-col gap-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <p className="text-body text-muted-foreground-strong">Editando: {product.name}</p>
        {product.status !== "archived" ? (
          <Switch
            checked={product.status === "active"}
            onChange={handleTogglePublish}
            label="Publicar producto"
            disabled={togglingPublish}
          />
        ) : null}
      </div>

      <form id="edit-product-form" onSubmit={handleSaveBase} className="flex flex-col gap-6">
        <Card>
          <ProductBaseFields value={base} onChange={handleBaseChange} errors={baseErrors} />
        </Card>

        <Card>
          <div className="flex flex-col gap-6">
            <ContentBlockEditor
              label="Ingredientes"
              items={content.ingredients}
              onChange={(items) => setContent((c) => c && { ...c, ingredients: items })}
              titlePlaceholder="Niacinamida al 10%"
              textPlaceholder="Regula la producción de sebo y afina la textura."
              errors={scopeErrors(baseErrors, "content.ingredients.")}
            />
            <ContentBlockEditor
              label="Pasos de rutina"
              items={content.routineSteps}
              onChange={(items) => setContent((c) => c && { ...c, routineSteps: items })}
              titlePlaceholder="Paso 2"
              textPlaceholder="Aplica 3 gotas sobre el rostro limpio y seco."
              errors={scopeErrors(baseErrors, "content.routineSteps.")}
            />
            <ContentBlockEditor
              label="Modo de uso"
              items={content.usage}
              onChange={(items) => setContent((c) => c && { ...c, usage: items })}
              titlePlaceholder="Por la noche"
              textPlaceholder="Úsalo después del tónico y antes de la crema hidratante."
              errors={scopeErrors(baseErrors, "content.usage.")}
            />
            <ContentBlockEditor
              label="Beneficios"
              items={content.benefits}
              onChange={(items) => setContent((c) => c && { ...c, benefits: items })}
              titlePlaceholder="Hidratación profunda"
              textPlaceholder="Retiene humedad por hasta 24 horas."
              errors={scopeErrors(baseErrors, "content.benefits.")}
            />
          </div>
        </Card>
      </form>

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
              onRemove={() => removeVariant(draft)}
              onSave={() => saveVariant(draft)}
              saving={savingVariantId === draft.tempId}
              showInitialStock={!draft.id}
              errors={variantErrors[draft.tempId]}
            />
          ))}
        </div>
      </Card>

      <Card>
        <InventoryPanel productId={product.id} />
      </Card>

      <Card>
        <ImageManager basePath={`/api/v1/admin/products/${product.id}`} images={images} onChange={setImages} />
      </Card>

      <div>
        <Button type="submit" form="edit-product-form" variant="primary" loading={savingBase}>
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
