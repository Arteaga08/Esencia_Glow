"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { EditionStatus } from "@esencia-glow/shared";
import { apiRequest, ApiRequestError } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { editionApiActions } from "@/components/subscription-editions/edition-api-actions";
import { EditionEditor } from "@/components/subscription-editions/edition-editor";
import { useSubscriptionPlans } from "@/components/subscription-plans/use-subscription-plans";
import type { AdminSubscriptionEdition } from "@/lib/types/admin-subscription";

/** Armar y publicar una edición (2.7b-2). El aviso de cada acción sale
 * como toast; los errores quedan en línea dentro del editor. */
export default function EditSubscriptionEditionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { plans } = useSubscriptionPlans();

  const [edition, setEdition] = useState<AdminSubscriptionEdition | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const actions = useMemo(() => editionApiActions(params.id), [params.id]);

  useEffect(() => {
    let cancelled = false;
    apiRequest<AdminSubscriptionEdition>(`/api/v1/admin/subscription-editions/${params.id}`, {
      authenticated: true,
    })
      .then((response) => {
        if (cancelled) return;
        setEdition(response.data);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(
          error instanceof ApiRequestError ? error.message : "No pudimos cargar la edición.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [params.id, retryKey]);

  if (loadError) {
    return <ErrorState description={loadError} onRetry={() => setRetryKey((key) => key + 1)} />;
  }

  if (!edition) {
    return (
      <div className="flex max-w-6xl flex-col gap-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  function handleChanged(next: AdminSubscriptionEdition) {
    const previous = edition;
    setEdition(next);
    if (previous && previous.status !== next.status) {
      toast({
        variant: "success",
        title:
          next.status === EditionStatus.PUBLISHED ? "Edición publicada" : "Edición despublicada",
        description: next.title,
      });
    } else {
      toast({ variant: "success", title: "Cambios guardados", description: next.title });
    }
  }

  return (
    <EditionEditor
      edition={edition}
      plan={plans?.find((plan) => plan.id === edition.planId)}
      actions={actions}
      onChanged={handleChanged}
      onRemoved={() => {
        toast({ variant: "success", title: "Borrador eliminado", description: edition.title });
        router.push("/subscriptions/editions");
      }}
    />
  );
}
