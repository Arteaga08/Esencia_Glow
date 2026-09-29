"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { CreateEditionForm } from "@/components/subscription-editions/create-edition-form";
import { createEdition } from "@/components/subscription-editions/edition-api-actions";
import { useSubscriptionPlans } from "@/components/subscription-plans/use-subscription-plans";

/** Alta de edición (2.7b-2): plan + ciclo + título. Al crearla lleva
 * directo a su pantalla para agregar los productos (el `POST` no acepta
 * `items`). Solo se ofrecen planes activos. */
export default function NewSubscriptionEditionPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { plans, loadError, retry } = useSubscriptionPlans();

  if (loadError) return <ErrorState description={loadError} onRetry={retry} />;

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <p className="text-body text-muted-foreground-strong">Nueva edición</p>
      <Card>
        <p className="mb-6 text-section-title text-foreground">Plan y ciclo</p>
        {plans === null ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <CreateEditionForm
            plans={plans.filter((plan) => plan.isActive)}
            create={createEdition}
            onCreated={(edition) => {
              toast({
                variant: "success",
                title: "Edición creada",
                description: "Ahora agrega los productos de la caja.",
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
