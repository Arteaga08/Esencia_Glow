"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { CreateEditionForm } from "@/components/subscription-editions/create-edition-form";
import { createEdition } from "@/components/subscription-editions/edition-api-actions";
import { useSubscriptionEditions } from "@/components/subscription-editions/use-subscription-editions";
import { useInitialQueryParam } from "@/lib/hooks/use-initial-query-param";
import { useSubscriptionPlans } from "@/components/subscription-plans/use-subscription-plans";

/** Alta de caja mensual (2.7b-2, en un solo guardado desde 2.7d): plan +
 * ciclo + título + productos. Al crearla lleva a su pantalla, donde se
 * publica. Solo se ofrecen planes activos. */
export default function NewSubscriptionEditionPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { plans, loadError, retry } = useSubscriptionPlans();
  const { editions } = useSubscriptionEditions({ planId: null, status: null, cycleYear: null });
  // Llegan desde "Armar caja de <mes>" en la pantalla del plan.
  const initialPlanId = useInitialQueryParam("planId");
  const initialYear = Number(useInitialQueryParam("cycleYear"));
  const initialMonth = Number(useInitialQueryParam("cycleMonth"));

  if (loadError) return <ErrorState description={loadError} onRetry={retry} />;

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <p className="text-body text-muted-foreground-strong">Nueva edición</p>
      <Card>
        <p className="mb-6 text-section-title text-foreground">Plan, ciclo y productos</p>
        {plans === null || editions === null ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <CreateEditionForm
            plans={plans.filter((plan) => plan.isActive)}
            initial={{
              planId: initialPlanId ?? undefined,
              cycleYear: initialYear || undefined,
              cycleMonth: initialMonth || undefined,
            }}
            create={createEdition}
            existingEditions={editions}
            onCreated={(edition) => {
              toast({
                variant: "success",
                title: "Edición creada",
                description: "Revísala y publícala cuando esté lista.",
              });
              router.push(`/subscriptions/editions/${edition.id}`);
            }}
            onCancel={() => router.push("/subscriptions/editions")}
          />
        )}
      </Card>
    </div>
  );
}
