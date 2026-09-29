"use client";

import { useState } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import type { ShippingSettings } from "@esencia-glow/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field-error";
import { AddressFields, EMPTY_ADDRESS_FORM, addressFormToBody, addressToFormValue, type AddressFormValue } from "@/components/addresses/address-fields";
import { ApiRequestError } from "@/lib/api";
import { scopeErrors } from "@/lib/field-errors";
import type { SettingsActions } from "./settings-actions";

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError ? error.message : fallback;
}

/** ¿Cambió algo respecto a lo guardado? La dirección se manda completa, así
 * que basta comparar por valor — no hay diff parcial como en Comercio. */
function isDirty(value: AddressFormValue, saved: ShippingSettings): boolean {
  const savedValue = saved.origin ? addressToFormValue(saved.origin) : EMPTY_ADDRESS_FORM;
  return (Object.keys(value) as (keyof AddressFormValue)[]).some((key) => value[key] !== savedValue[key]);
}

interface ShippingOriginCardProps {
  settings: ShippingSettings;
  actions: SettingsActions;
}

/**
 * Tarjeta "Dirección de origen" del panel de Ajustes (Milestone 2.8): desde
 * dónde se despachan los pedidos — Skydropx la exige para generar guías
 * (`ShippingSettings.origin`, opcional en el modelo). `PATCH .../shipping`
 * reemplaza la dirección completa, nunca campo a campo.
 */
function ShippingOriginCard({ settings, actions }: ShippingOriginCardProps) {
  const [value, setValue] = useState<AddressFormValue>(() =>
    settings.origin ? addressToFormValue(settings.origin) : EMPTY_ADDRESS_FORM,
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = isDirty(value, settings);

  function handleChange(patch: Partial<AddressFormValue>) {
    setValue((current) => ({ ...current, ...patch }));
  }

  function handleDiscard() {
    setValue(settings.origin ? addressToFormValue(settings.origin) : EMPTY_ADDRESS_FORM);
    setFieldErrors({});
    setFormError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!dirty) return;
    setSaving(true);
    setFieldErrors({});
    setFormError(null);
    try {
      const saved = await actions.updateShippingOrigin(addressFormToBody(value));
      setValue(saved.origin ? addressToFormValue(saved.origin) : EMPTY_ADDRESS_FORM);
    } catch (error) {
      const apiErrors = error instanceof ApiRequestError ? (error.fieldErrors ?? {}) : {};
      // El body va anidado (`{origin: {...}}`), así que Joi reporta
      // `origin.postalCode`; `scopeErrors` lo recorta a `postalCode` para
      // que apunte al campo correcto. Una clave que no empieza con `origin.`
      // (p. ej. `valor`, de un cuerpo rechazado entero) nunca se descarta en
      // silencio: cae al mensaje general de la tarjeta.
      const scoped = scopeErrors(apiErrors, "origin.");
      const orphan = Object.entries(apiErrors).find(([key]) => !key.startsWith("origin."));
      setFieldErrors(scoped);
      if (orphan) setFormError(orphan[1]);
      else if (Object.keys(scoped).length === 0) setFormError(messageOf(error, "No se pudo guardar la dirección."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">
            Dirección de origen
          </p>
          <Badge color={dirty ? "warning" : settings.origin ? "success" : "danger"}>
            {dirty ? "Cambios sin guardar" : settings.origin ? "Guardado" : "Sin capturar"}
          </Badge>
        </div>

        {!settings.origin ? (
          <p className="flex items-start gap-1.5 text-body-sm text-muted-foreground-strong">
            <WarningCircle size={16} weight="regular" className="mt-0.5 shrink-0 text-accent-foreground-strong" aria-hidden="true" />
            Sin dirección de origen no se pueden generar guías de envío.
          </p>
        ) : null}

        <AddressFields value={value} onChange={handleChange} errors={fieldErrors} />

        {formError ? <FieldError message={formError} /> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={saving} disabled={!dirty}>
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

export { ShippingOriginCard };
