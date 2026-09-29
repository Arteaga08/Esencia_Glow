"use client";

import { useState } from "react";
import type { CommerceSettings, InventorySettings } from "@esencia-glow/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { ApiRequestError } from "@/lib/api";
import {
  commerceFieldFormatErrors,
  commerceFormToPatch,
  commerceToFormValue,
  shippingQuoteTtlError,
  type CommerceFormValue,
} from "./commerce-form-value";
import type { SettingsActions } from "./settings-actions";

/** Traduce la clave que devuelve la API (el shape real de `CommerceSettings`)
 * al campo del formulario en pantalla (`taxRatePct`, no `taxRateBps`) — así
 * un 400 de Joi señala el input correcto en vez de quedarse huérfano. */
const API_TO_FORM_FIELD: Record<string, keyof CommerceFormValue> = {
  taxRateBps: "taxRatePct",
  freeShippingThresholdCents: "freeShippingThresholdPesos",
  shippingQuoteTtlMinutes: "shippingQuoteTtlMinutes",
};

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError ? error.message : fallback;
}

interface CommerceSettingsCardProps {
  settings: CommerceSettings;
  /** Solo para la regla cruzada de vigencia de cotización — la sección
   * `inventory` no se edita aquí, pero su TTL de reserva es el piso de esta. */
  reservationTtlMinutes: InventorySettings["reservationTtlMinutes"];
  actions: SettingsActions;
}

/**
 * Tarjeta "Comercio" del panel de Ajustes (Milestone 2.8): IVA, umbral de
 * envío gratis y vigencia de la cotización de envío. Última escritura gana
 * (Settings no tiene CAS, ver [[esencia-glow-2-8]]) — tras guardar, la
 * tarjeta se repinta con exactamente lo que el servidor confirmó.
 */
function CommerceSettingsCard({ settings, reservationTtlMinutes, actions }: CommerceSettingsCardProps) {
  const [value, setValue] = useState<CommerceFormValue>(() => commerceToFormValue(settings));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const patch = commerceFormToPatch(value, settings);
  const formatErrors = commerceFieldFormatErrors(value);
  const crossFieldError = shippingQuoteTtlError(value, reservationTtlMinutes);
  const dirty = Object.keys(patch).length > 0;
  // Un IVA o una vigencia sin lectura de negocio (vacío, no numérico) nunca
  // deben guardarse en silencio: bloquean el submit, no solo desaparecen del
  // PATCH (hallazgo de code review).
  const hasFormatError = Object.keys(formatErrors).length > 0;

  function handleChange(fieldPatch: Partial<CommerceFormValue>) {
    setValue((current) => ({ ...current, ...fieldPatch }));
  }

  function handleDiscard() {
    setValue(commerceToFormValue(settings));
    setFieldErrors({});
    setFormError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (hasFormatError || crossFieldError || Object.keys(patch).length === 0) return;
    setSaving(true);
    setFieldErrors({});
    setFormError(null);
    try {
      const saved = await actions.updateCommerce(patch);
      setValue(commerceToFormValue(saved));
    } catch (error) {
      const apiErrors = error instanceof ApiRequestError ? (error.fieldErrors ?? {}) : {};
      const mapped: Record<string, string> = {};
      let orphan: string | null = null;
      for (const [key, message] of Object.entries(apiErrors)) {
        const formField = API_TO_FORM_FIELD[key];
        // Toda clave que no mapea a un campo visible (p. ej. `valor`, de un
        // cuerpo rechazado entero) nunca se descarta en silencio.
        if (formField) mapped[formField] = message;
        else orphan = message;
      }
      setFieldErrors(mapped);
      if (orphan) setFormError(orphan);
      else if (Object.keys(mapped).length === 0) setFormError(messageOf(error, "No se pudo guardar Comercio."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">Comercio</p>
          <Badge color={dirty ? "warning" : "success"}>{dirty ? "Cambios sin guardar" : "Guardado"}</Badge>
        </div>

        <Input
          label="IVA (%)"
          placeholder="16"
          inputMode="decimal"
          value={value.taxRatePct}
          onChange={(event) => handleChange({ taxRatePct: event.target.value })}
          error={fieldErrors.taxRatePct ?? formatErrors.taxRatePct}
          helper={
            !fieldErrors.taxRatePct && !formatErrors.taxRatePct
              ? "Se aplica a todos los pedidos, de 0 a 100."
              : undefined
          }
        />
        <Input
          label="Envío gratis desde ($)"
          placeholder="999.00"
          inputMode="decimal"
          value={value.freeShippingThresholdPesos}
          onChange={(event) => handleChange({ freeShippingThresholdPesos: event.target.value })}
          error={fieldErrors.freeShippingThresholdPesos}
          helper={
            !fieldErrors.freeShippingThresholdPesos
              ? "Deja el campo vacío para desactivar el envío gratis."
              : undefined
          }
        />
        <Input
          label="Vigencia de la cotización de envío (min)"
          placeholder="60"
          inputMode="numeric"
          value={value.shippingQuoteTtlMinutes}
          onChange={(event) => handleChange({ shippingQuoteTtlMinutes: event.target.value })}
          error={fieldErrors.shippingQuoteTtlMinutes ?? formatErrors.shippingQuoteTtlMinutes ?? crossFieldError ?? undefined}
        />

        {formError ? <FieldError message={formError} /> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={saving} disabled={!dirty || hasFormatError || Boolean(crossFieldError)}>
            Guardar
          </Button>
          <Button type="button" variant="ghost" onClick={handleDiscard} disabled={!dirty || saving}>
            Descartar
          </Button>
        </div>
      </form>
    </Card>
  );
}

export { CommerceSettingsCard };
