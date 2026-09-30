"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { PendingImagePicker } from "@/components/products/pending-image-picker";
import { PLAN_API_ACTIONS, uploadPlanImages } from "@/components/subscription-plans/plan-api-actions";
import { PlanEditor, type PlanEditorActions } from "@/components/subscription-plans/plan-editor";
import { ApiRequestError } from "@/lib/api";

/** Alta de plan (2.7b-2). Crear sincroniza Product+Price(s) en Stripe
 * antes de guardar (subscription-plan.service.ts::createPlan). Las fotos se
 * eligen aquí (2.7d) y se suben justo después del POST, con el id ya real. Si
 * la subida falla el plan YA existe: se manda a su pantalla con el error en
 * línea para reintentar, sin perder nada. */
export default function NewSubscriptionPlanPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  // Resultado de la subida, leído por `onSaved` (el editor solo conoce el plan).
  const uploadFailure = useRef<string | null>(null);

  const actions: PlanEditorActions = {
    ...PLAN_API_ACTIONS,
    create: async (body) => {
      const plan = await PLAN_API_ACTIONS.create(body);
      uploadFailure.current = null;
      if (pendingImages.length > 0) {
        try {
          await uploadPlanImages(plan.id, pendingImages);
        } catch (error) {
          uploadFailure.current =
            error instanceof ApiRequestError ? error.message : "No se pudo subir las fotos.";
        }
      }
      return plan;
    },
  };

  return (
    <PlanEditor
      plan={null}
      actions={actions}
      extraSection={
        <Card>
          <PendingImagePicker
            files={pendingImages}
            onChange={setPendingImages}
            onRejected={(message) =>
              toast({ variant: "warning", title: "Foto no agregada", description: message })
            }
            uploadNote="se suben en cuanto creas el plan."
          />
        </Card>
      }
      onSaved={(plan) => {
        if (uploadFailure.current) {
          toast({
            variant: "error",
            title: "El plan se creó, pero las fotos no se pudieron subir",
            description: uploadFailure.current,
          });
          router.push(`/subscriptions/plans/${plan.id}?photos=failed`);
          return;
        }
        toast({ variant: "success", title: "Plan creado", description: plan.name });
        router.push("/subscriptions/plans");
      }}
      onCancel={() => router.push("/subscriptions/plans")}
    />
  );
}
