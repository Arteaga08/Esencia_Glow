"use client";

import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { PLAN_API_ACTIONS } from "@/components/subscription-plans/plan-api-actions";
import { PlanEditor } from "@/components/subscription-plans/plan-editor";

/** Alta de plan (2.7b-2). Crear sincroniza Product+Price(s) en Stripe
 * antes de guardar (subscription-plan.service.ts::createPlan); al terminar
 * vuelve al listado, igual que la creación de producto. */
export default function NewSubscriptionPlanPage() {
  const router = useRouter();
  const { toast } = useToast();

  return (
    <PlanEditor
      plan={null}
      actions={PLAN_API_ACTIONS}
      onSaved={(plan) => {
        toast({ variant: "success", title: "Plan creado", description: plan.name });
        router.push("/subscriptions/plans");
      }}
      onCancel={() => router.push("/subscriptions/plans")}
    />
  );
}
