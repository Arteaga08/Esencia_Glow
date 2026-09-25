"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest, ApiRequestError } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { BundleBaseFields, type BundleBaseFieldsValue } from "@/components/bundles/bundle-base-fields";
import { BundleItemEditor } from "@/components/bundles/bundle-item-editor";
import { ArchiveBundleModal } from "@/components/bundles/archive-bundle-modal";
import { ContentBlockEditor, type ContentItem } from "@/components/products/content-block-editor";
import { ImageManager } from "@/components/products/image-manager";
import { centsToPesosInput, pesosInputToCents } from "@/lib/format-money";
import { scopeErrors } from "@/lib/field-errors";
import type { AdminBundle, AdminBundleItem, AdminProductImage } from "@/lib/types/admin-catalog";

interface ContentState {
  ingredients: ContentItem[];
  routineSteps: ContentItem[];
  usage: ContentItem[];
  benefits: ContentItem[];
}

/**
 * Edición de paquete (Milestone 2.2.3, Fase 3) — a diferencia de Producto,
 * "Guardar cambios" cubre TODO en un solo `PATCH` (nombre, precio,
 * `listPrice`, `badgeId`, `content`, `items` completos): el backend no
 * divide bundle en subrutas por bloque. Solo fotos quedan aparte
 * (`ImageManager`, subrutas propias, igual que en Producto) y
 * publicar/archivar (acciones de un clic, sin pasar por el formulario).
 */
export default function EditBundlePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [bundle, setBundle] = useState<AdminBundle | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [base, setBase] = useState<BundleBaseFieldsValue | null>(null);
  const [items, setItems] = useState<AdminBundleItem[]>([]);
  const [componentsSum, setComponentsSum] = useState(0);
  const [content, setContent] = useState<ContentState | null>(null);
  const [images, setImages] = useState<AdminProductImage[]>([]);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [togglingPublish, setTogglingPublish] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiRequest<AdminBundle>(`/api/v1/admin/bundles/${params.id}`, { authenticated: true })
      .then((response) => {
        if (cancelled) return;
        const b = response.data;
        setBundle(b);
        setBase({
          name: b.name,
          description: b.description,
          price: centsToPesosInput(b.price),
          listPrice: b.listPrice ? centsToPesosInput(b.listPrice) : "",
          badgeId: b.badgeId,
        });
        setItems(b.items);
        setContent({
          ingredients: b.content?.ingredients ?? [],
          routineSteps: b.content?.routineSteps ?? [],
          usage: b.content?.usage ?? [],
          benefits: b.content?.benefits ?? [],
        });
        setImages(b.images);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof ApiRequestError ? error.message : "No pudimos cargar el paquete.");
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  function handleBaseChange(patch: Partial<BundleBaseFieldsValue>) {
    setBase((current) => current && { ...current, ...patch });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!base || !content || !bundle) return;
    if (items.length === 0) {
      setFieldErrors({ items: "El paquete necesita al menos un componente" });
      return;
    }
    setSaving(true);
    setFieldErrors({});
    try {
      const response = await apiRequest<AdminBundle>(`/api/v1/admin/bundles/${bundle.id}`, {
        method: "PATCH",
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
      setBundle(response.data);
      toast({ variant: "success", title: "Cambios guardados" });
    } catch (error) {
      if (error instanceof ApiRequestError && error.fieldErrors) {
        setFieldErrors(error.fieldErrors);
        toast({ variant: "error", title: "Revisa los campos marcados", description: error.message });
      } else {
        toast({
          variant: "error",
          title: "No se pudieron guardar los cambios",
          description: error instanceof ApiRequestError ? error.message : "Intenta de nuevo.",
        });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePublish(nextActive: boolean) {
    if (!bundle) return;
    setTogglingPublish(true);
    try {
      const response = await apiRequest<AdminBundle>(`/api/v1/admin/bundles/${bundle.id}`, {
        method: "PATCH",
        authenticated: true,
        body: { status: nextActive ? "active" : "draft" },
      });
      setBundle(response.data);
      toast({ variant: "success", title: nextActive ? "Paquete publicado" : "Paquete despublicado" });
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

  async function handleConfirmArchive() {
    if (!bundle) return;
    setArchiving(true);
    try {
      await apiRequest(`/api/v1/admin/bundles/${bundle.id}`, { method: "DELETE", authenticated: true });
      toast({ variant: "success", title: "Paquete archivado", description: bundle.name });
      router.push("/bundles");
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo archivar el paquete",
        description: error instanceof ApiRequestError ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setArchiving(false);
      setConfirmingArchive(false);
    }
  }

  if (loadError) {
    return <ErrorState description={loadError} />;
  }

  if (!bundle || !base || !content) {
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-body text-muted-foreground-strong">Editando: {bundle.name}</p>
          {bundle.status !== "archived" ? (
            <Switch
              checked={bundle.status === "active"}
              onChange={handleTogglePublish}
              label="Publicar paquete"
              disabled={togglingPublish}
            />
          ) : null}
        </div>
        {bundle.status !== "archived" ? (
          <Button variant="destructive" size="sm" onClick={() => setConfirmingArchive(true)}>
            Archivar
          </Button>
        ) : null}
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-6">
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
              onChange={(next) => setContent((c) => c && { ...c, benefits: next })}
              titlePlaceholder="Ahorro real"
              textPlaceholder="14% más barato que comprar los productos por separado."
              errors={scopeErrors(fieldErrors, "content.benefits.")}
            />
            <ContentBlockEditor
              label="Ingredientes"
              items={content.ingredients}
              onChange={(next) => setContent((c) => c && { ...c, ingredients: next })}
              titlePlaceholder="Niacinamida al 10%"
              textPlaceholder="Regula la producción de sebo y afina la textura."
              errors={scopeErrors(fieldErrors, "content.ingredients.")}
            />
            <ContentBlockEditor
              label="Pasos de rutina"
              items={content.routineSteps}
              onChange={(next) => setContent((c) => c && { ...c, routineSteps: next })}
              titlePlaceholder="Paso 2"
              textPlaceholder="Aplica sobre el rostro limpio y seco."
              errors={scopeErrors(fieldErrors, "content.routineSteps.")}
            />
            <ContentBlockEditor
              label="Modo de uso"
              items={content.usage}
              onChange={(next) => setContent((c) => c && { ...c, usage: next })}
              titlePlaceholder="Por la noche"
              textPlaceholder="Úsalo después del tónico y antes de la crema hidratante."
              errors={scopeErrors(fieldErrors, "content.usage.")}
            />
          </div>
        </Card>

        <div>
          <Button type="submit" variant="primary" loading={saving}>
            Guardar cambios
          </Button>
        </div>
      </form>

      <Card>
        <ImageManager basePath={`/api/v1/admin/bundles/${bundle.id}`} images={images} onChange={setImages} />
      </Card>

      <ArchiveBundleModal
        bundle={confirmingArchive ? bundle : null}
        onCancel={() => setConfirmingArchive(false)}
        onConfirm={handleConfirmArchive}
        loading={archiving}
      />
    </div>
  );
}
