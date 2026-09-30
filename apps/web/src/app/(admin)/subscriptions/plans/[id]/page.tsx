"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest, ApiRequestError } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { ErrorState } from "@/components/ui/error-state";
import { FieldError } from "@/components/ui/field-error";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageManager } from "@/components/products/image-manager";
import { PLAN_API_ACTIONS } from "@/components/subscription-plans/plan-api-actions";
import { PlanEditor } from "@/components/subscription-plans/plan-editor";
import { PlanMonthlyBoxes } from "@/components/subscription-plans/plan-monthly-boxes";
import { useInitialQueryParam } from "@/lib/hooks/use-initial-query-param";
import type { AdminProductImage } from "@/lib/types/admin-catalog";
import type { AdminSubscriptionPlan } from "@/lib/types/admin-subscription";

/** Edición de plan (2.7b-2): datos, cupo y orden. Los precios se muestran
 * pero no se editan (inmutables tras crear el plan). Las fotos (2.7c) van
 * aparte del formulario, con subrutas propias igual que en Paquetes. */
export default function EditSubscriptionPlanPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [plan, setPlan] = useState<AdminSubscriptionPlan | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [images, setImages] = useState<AdminProductImage[]>([]);
  const [retryKey, setRetryKey] = useState(0);
  // Llega del alta cuando el plan se creó pero la subida de fotos falló (2.7d).
  const arrivedWithFailedPhotos = useInitialQueryParam("photos") === "failed";
  const [photosFailureDismissed, setPhotosFailureDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiRequest<AdminSubscriptionPlan>(`/api/v1/admin/subscription-plans/${params.id}`, {
      authenticated: true,
    })
      .then((response) => {
        if (cancelled) return;
        setPlan(response.data);
        setImages(response.data.images);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(
          error instanceof ApiRequestError ? error.message : "No pudimos cargar el plan.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [params.id, retryKey]);

  if (loadError) {
    return <ErrorState description={loadError} onRetry={() => setRetryKey((key) => key + 1)} />;
  }

  if (!plan) {
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
      <PlanEditor
        // `key` por estado: al desactivar, el editor se remonta con el plan
        // ya inactivo en vez de arrastrar el formulario viejo.
        key={`${plan.id}:${plan.isActive}`}
        plan={plan}
        actions={PLAN_API_ACTIONS}
        onSaved={(saved) => {
          setPlan(saved);
          toast({ variant: "success", title: "Cambios guardados", description: saved.name });
        }}
        onDeactivated={() => {
          setPlan((current) => current && { ...current, isActive: false });
          toast({ variant: "success", title: "Plan desactivado", description: plan.name });
        }}
        onCancel={() => router.push("/subscriptions/plans")}
      />

      <PlanMonthlyBoxes plan={plan} />

      <Card>
        {arrivedWithFailedPhotos && !photosFailureDismissed ? (
          <div className="mb-4">
            <FieldError message="El plan se creó, pero las fotos no se pudieron subir. Vuelve a elegirlas aquí." />
          </div>
        ) : null}
        <ImageManager
          basePath={`/api/v1/admin/subscription-plans/${plan.id}`}
          images={images}
          onChange={(next) => {
            setPhotosFailureDismissed(true);
            setImages(next);
          }}
        />
      </Card>
    </div>
  );
}
