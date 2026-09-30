"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ApiRequestError } from "@/lib/api";
import { currentCycle, formatCycle, nextCycle, previousCycle } from "@/lib/format-cycle";
import type {
  AdminEditionItem,
  AdminSubscriptionEdition,
  AdminSubscriptionPlan,
} from "@/lib/types/admin-subscription";

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => {
  const label = new Date(2026, index, 1).toLocaleDateString("es-MX", { month: "long" });
  return { value: String(index + 1), label: label.charAt(0).toUpperCase() + label.slice(1) };
});

interface CreateEditionBody {
  planId: string;
  cycleYear: number;
  cycleMonth: number;
  title: string;
}

interface CreateEditionFormProps {
  plans: AdminSubscriptionPlan[];
  /** Valores de arranque (p. ej. la celda "Sin edición" que se eligió). */
  initial?: { planId?: string; cycleYear?: number; cycleMonth?: number };
  create: (body: CreateEditionBody) => Promise<AdminSubscriptionEdition>;
  /** Ediciones ya existentes (de cualquier plan): de aquí sale la caja del
   * mes anterior que se ofrece copiar. Sin ellas no se ofrece la copia. */
  existingEditions?: AdminSubscriptionEdition[];
  /** Guarda los productos en la edición recién creada (el `POST` no acepta
   * `items`, así que copiar es un segundo paso). */
  copyItems?: (editionId: string, items: AdminEditionItem[]) => Promise<AdminSubscriptionEdition>;
  onCreated: (edition: AdminSubscriptionEdition) => void;
  onCancel?: () => void;
}

/**
 * Alta de una edición: plan + ciclo + título. Los productos se agregan
 * después, ya en el editor (el `POST` no acepta `items`,
 * subscription-edition.validator.ts). Arranca en el ciclo SIGUIENTE: es el
 * que normalmente se está armando. El 409 de "ya existe una edición de este
 * plan para este ciclo" se muestra en línea, junto al botón.
 */
function CreateEditionForm({
  plans,
  initial,
  create,
  existingEditions,
  copyItems,
  onCreated,
  onCancel,
}: CreateEditionFormProps) {
  const fallback = nextCycle(currentCycle().cycleYear, currentCycle().cycleMonth);
  const [planId, setPlanId] = useState<string | null>(
    plans.some((plan) => plan.id === initial?.planId) ? (initial?.planId ?? null) : (plans[0]?.id ?? null),
  );
  const [cycleMonth, setCycleMonth] = useState(String(initial?.cycleMonth ?? fallback.cycleMonth));
  const [cycleYear, setCycleYear] = useState(String(initial?.cycleYear ?? fallback.cycleYear));
  const [title, setTitle] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copyPrevious, setCopyPrevious] = useState(true);
  /** Edición ya creada cuando falló el segundo paso (copiar productos). */
  const [createdWithoutItems, setCreatedWithoutItems] = useState<AdminSubscriptionEdition | null>(null);

  // Mientras el año va a medio teclear ("20") se usa el de arranque, para
  // que el placeholder no diga "1920".
  const cycleLabel = formatCycle(
    /^\d{4}$/.test(cycleYear) ? Number(cycleYear) : fallback.cycleYear,
    Number(cycleMonth),
  );

  // Caja del mes anterior del plan elegido, si existe y trae productos: es
  // lo que se ofrece copiar para no armar la caja desde cero cada mes.
  const previous = /^\d{4}$/.test(cycleYear)
    ? previousCycle(Number(cycleYear), Number(cycleMonth))
    : null;
  const previousEdition =
    copyItems && previous && planId
      ? (existingEditions?.find(
          (edition) =>
            edition.planId === planId &&
            edition.cycleYear === previous.cycleYear &&
            edition.cycleMonth === previous.cycleMonth &&
            edition.items.length > 0,
        ) ?? null)
      : null;

  if (plans.length === 0) {
    return (
      <p className="text-body-sm text-muted-foreground-strong">
        No hay planes activos. Crea uno en{" "}
        <Link href="/subscriptions/plans" className="text-foreground underline">
          Planes
        </Link>{" "}
        para poder armar sus ediciones.
      </p>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!planId) return;
    setSaving(true);
    setFieldErrors({});
    setConflict(null);
    try {
      const edition = await create({
        planId,
        cycleYear: Number(cycleYear),
        cycleMonth: Number(cycleMonth),
        title: title.trim() || `Edición ${cycleLabel}`,
      });
      if (previousEdition && copyPrevious && copyItems) {
        try {
          const withItems = await copyItems(edition.id, previousEdition.items);
          onCreated(withItems);
        } catch {
          // La edición ya existe (borrador vacío): no se pierde nada, pero el
          // aviso no puede quedar oculto por una navegación.
          setCreatedWithoutItems(edition);
          setConflict("La caja se creó, pero no pudimos copiar los productos del mes anterior.");
        }
        return;
      }
      onCreated(edition);
    } catch (error) {
      if (error instanceof ApiRequestError && error.fieldErrors) setFieldErrors(error.fieldErrors);
      else
        setConflict(
          error instanceof ApiRequestError ? error.message : "No se pudo crear la edición.",
        );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr_1fr]">
        <Select
          label="Plan"
          value={planId}
          onChange={(value) => setPlanId(value || null)}
          options={plans.map((plan) => ({ value: plan.id, label: plan.name }))}
          placeholder="Elige un plan"
          error={fieldErrors.planId}
        />
        <Select
          label="Mes"
          value={cycleMonth}
          onChange={(value) => setCycleMonth(value)}
          options={MONTH_OPTIONS}
          error={fieldErrors.cycleMonth}
        />
        <Input
          label="Año"
          type="number"
          inputMode="numeric"
          min={2024}
          max={2100}
          placeholder="2026"
          value={cycleYear}
          onChange={(e) => setCycleYear(e.target.value)}
          error={fieldErrors.cycleYear}
        />
      </div>
      <Input
        label="Título"
        placeholder={`Edición ${cycleLabel}`}
        helper="Si lo dejas vacío, se usa el del placeholder."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        error={fieldErrors.title}
        maxLength={160}
      />
      {previousEdition && previous ? (
        <label className="flex cursor-pointer items-start gap-2 text-body text-foreground">
          <input
            type="checkbox"
            checked={copyPrevious}
            onChange={(e) => setCopyPrevious(e.target.checked)}
            className="mt-1 cursor-pointer"
          />
          <span>
            Copiar los {previousEdition.items.length}{" "}
            {previousEdition.items.length === 1 ? "producto" : "productos"} de{" "}
            {formatCycle(previous.cycleYear, previous.cycleMonth)}
            <span className="block text-body-sm text-muted-foreground-strong">
              Después los ajustas en la caja: cambia lo que sea distinto este mes.
            </span>
          </span>
        </label>
      ) : null}
      {conflict ? <FieldError message={conflict} /> : null}
      {createdWithoutItems ? (
        <Link
          href={`/subscriptions/editions/${createdWithoutItems.id}`}
          className="text-body text-foreground underline"
        >
          Abrir la caja y agregar los productos a mano
        </Link>
      ) : null}
      <div className="flex gap-3">
        <Button type="submit" loading={saving} disabled={!planId || createdWithoutItems !== null}>
          Crear edición
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export { CreateEditionForm };
export type { CreateEditionBody };
