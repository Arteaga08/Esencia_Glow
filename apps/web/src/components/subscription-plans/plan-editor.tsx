"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { FieldError } from "@/components/ui/field-error";
import { ApiRequestError } from "@/lib/api";
import type { AdminSubscriptionPlan } from "@/lib/types/admin-subscription";
import { PlanFormFields } from "./plan-form-fields";
import { PlanStatusBadge } from "./plan-status-badge";
import {
  EMPTY_PLAN_FORM,
  PLAN_FIELD_KEYS,
  formValueToCreateBody,
  formValueToPatchBody,
  planToFormValue,
  type PlanFormValue,
} from "./plan-form-value";

/** Escrituras del editor; las implementa quien lo monta (pantalla real
 * contra la API, o las previews de diseño sin escribir). */
interface PlanEditorActions {
  create: (body: Record<string, unknown>) => Promise<AdminSubscriptionPlan>;
  update: (id: string, body: Record<string, unknown>) => Promise<AdminSubscriptionPlan>;
  deactivate: (id: string) => Promise<void>;
}

interface PlanEditorProps {
  /** `null` = alta de un plan nuevo. */
  plan: AdminSubscriptionPlan | null;
  actions: PlanEditorActions;
  onSaved: (plan: AdminSubscriptionPlan) => void;
  onDeactivated?: (id: string) => void;
  onCancel?: () => void;
  /** Bloque extra del alta (fotos por subir), entre los campos y el botón. */
  extraSection?: ReactNode;
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError ? error.message : fallback;
}

/**
 * Formulario completo de plan (2.7b-2). Crear sincroniza con Stripe
 * (subscription-plan.service.ts::createPlan), por eso el botón dice
 * exactamente lo que hace. Desactivar es irreversible desde el panel (no hay
 * endpoint para reactivar): siempre pasa por confirmación nombrada, y el 409
 * de "tiene suscriptoras activas" aparece en línea, no solo en un toast.
 */
function PlanEditor({ plan, actions, onSaved, onDeactivated, onCancel, extraSection }: PlanEditorProps) {
  const [value, setValue] = useState<PlanFormValue>(plan ? planToFormValue(plan) : EMPTY_PLAN_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  const patchBody = plan ? formValueToPatchBody(value, plan) : null;
  const dirty = plan ? Object.keys(patchBody ?? {}).length > 0 : true;

  function handleChange(patch: Partial<PlanFormValue>) {
    setValue((current) => ({ ...current, ...patch }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    setFormError(null);
    try {
      const saved = plan
        ? await actions.update(plan.id, patchBody ?? {})
        : await actions.create(formValueToCreateBody(value));
      setValue(planToFormValue(saved));
      onSaved(saved);
    } catch (error) {
      const fields = error instanceof ApiRequestError ? (error.fieldErrors ?? {}) : {};
      setFieldErrors(fields);
      // Un error sin campo que lo pinte (p. ej. la clave `valor` de un
      // cuerpo rechazado entero) nunca se descarta en silencio.
      const orphan = Object.entries(fields).find(([key]) => !PLAN_FIELD_KEYS.has(key.split(".")[0] ?? key));
      if (orphan) setFormError(orphan[1]);
      else if (Object.keys(fields).length === 0)
        setFormError(messageOf(error, "No se pudo guardar el plan."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!plan) return;
    setDeactivating(true);
    setDeactivateError(null);
    try {
      await actions.deactivate(plan.id);
      setConfirmingDeactivate(false);
      onDeactivated?.(plan.id);
    } catch (error) {
      setConfirmingDeactivate(false);
      setDeactivateError(messageOf(error, "No se pudo desactivar el plan."));
    } finally {
      setDeactivating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-body text-muted-foreground-strong">
            {plan ? `Editando: ${plan.name}` : "Nuevo plan"}
          </p>
          {plan ? <PlanStatusBadge isActive={plan.isActive} /> : null}
        </div>
        {plan?.isActive ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setConfirmingDeactivate(true)}
          >
            Desactivar plan
          </Button>
        ) : null}
      </div>
      {deactivateError ? <FieldError message={deactivateError} /> : null}
      {plan && !plan.isActive ? (
        <p className="text-body-sm text-muted-foreground-strong">
          Plan desactivado: ya no admite altas nuevas. Sus datos se pueden seguir editando.
        </p>
      ) : null}

      <PlanFormFields value={value} onChange={handleChange} errors={fieldErrors} plan={plan} />

      {extraSection}

      {formError ? <FieldError message={formError} /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={saving} disabled={!dirty}>
          {plan ? "Guardar cambios" : "Crear plan"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
      </div>

      {plan ? (
        <ConfirmModal
          open={confirmingDeactivate}
          title={`¿Desactivar ${plan.name}?`}
          confirmLabel="Desactivar"
          variant="destructive"
          loading={deactivating}
          onCancel={() => setConfirmingDeactivate(false)}
          onConfirm={() => void handleDeactivate()}
        >
          <p className="text-body text-foreground">
            El plan deja de admitir altas nuevas y desaparece del catálogo. Desde el panel no se
            puede volver a activar. Solo es posible si no tiene suscriptoras activas.
          </p>
        </ConfirmModal>
      ) : null}
    </form>
  );
}

export { PlanEditor };
export type { PlanEditorActions };
