"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { BundleItemEditor, type ItemEditorCopy } from "@/components/bundles/bundle-item-editor";
import { ApiRequestError } from "@/lib/api";
import { currentCycle, formatCycle, nextCycle, previousCycle } from "@/lib/format-cycle";
import type {
  AdminEditionItem,
  AdminSubscriptionEdition,
  AdminSubscriptionPlan,
} from "@/lib/types/admin-subscription";
import { humanize } from "./edition-error-text";

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => {
  const label = new Date(2026, index, 1).toLocaleDateString("es-MX", { month: "long" });
  return { value: String(index + 1), label: label.charAt(0).toUpperCase() + label.slice(1) };
});

const EDITION_ITEM_COPY: ItemEditorCopy = {
  title: "Productos de la caja",
  empty: "La caja está vacía. Puedes crearla así y agregar productos después, pero necesita al menos uno para publicarse.",
  addTitle: "Agregar producto",
  duplicate: "Esa variante ya está en la caja; cambia la cantidad en vez de repetirla.",
};

interface CreateEditionBody {
  planId: string;
  cycleYear: number;
  cycleMonth: number;
  title: string;
  items: AdminEditionItem[];
}

function sameItems(a: AdminEditionItem[], b: AdminEditionItem[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (item, index) =>
        item.variantId === b[index]?.variantId &&
        item.productId === b[index]?.productId &&
        item.quantity === b[index]?.quantity,
    )
  );
}

/** Caja del mes anterior al ciclo dado (del plan dado), si existe y trae productos. */
function findPreviousEdition(
  editions: AdminSubscriptionEdition[] | undefined,
  planId: string | null,
  cycleYear: string,
  cycleMonth: string,
): AdminSubscriptionEdition | null {
  if (!planId || !/^\d{4}$/.test(cycleYear)) return null;
  const previous = previousCycle(Number(cycleYear), Number(cycleMonth));
  return (
    editions?.find(
      (edition) =>
        edition.planId === planId &&
        edition.cycleYear === previous.cycleYear &&
        edition.cycleMonth === previous.cycleMonth &&
        edition.items.length > 0,
    ) ?? null
  );
}

interface CreateEditionFormProps {
  plans: AdminSubscriptionPlan[];
  /** Valores de arranque (p. ej. la celda "Sin edición" que se eligió). */
  initial?: { planId?: string; cycleYear?: number; cycleMonth?: number };
  create: (body: CreateEditionBody) => Promise<AdminSubscriptionEdition>;
  /** Ediciones ya existentes (de cualquier plan): de aquí sale la caja del
   * mes anterior que se ofrece copiar. Sin ellas no se ofrece la copia. */
  existingEditions?: AdminSubscriptionEdition[];
  onCreated: (edition: AdminSubscriptionEdition) => void;
  onCancel?: () => void;
}

/**
 * Alta de una edición en un solo guardado (2.7d): plan + ciclo + título +
 * productos (el `POST` acepta `items`, subscription-edition.validator.ts).
 * Publicar sigue siendo aparte, en la pantalla de la caja. Arranca en el
 * ciclo SIGUIENTE: es el que normalmente se está armando. La casilla de
 * copiar PRECARGA la lista con la caja del mes anterior: lo que se ve es lo
 * que se guarda. El 409 de "ya existe una edición de este plan para este
 * ciclo" se muestra en línea, junto al botón.
 */
function CreateEditionForm({
  plans,
  initial,
  create,
  existingEditions,
  onCreated,
  onCancel,
}: CreateEditionFormProps) {
  const fallback = nextCycle(currentCycle().cycleYear, currentCycle().cycleMonth);
  const initialPlanId = plans.some((plan) => plan.id === initial?.planId)
    ? (initial?.planId ?? null)
    : (plans[0]?.id ?? null);
  const initialMonth = String(initial?.cycleMonth ?? fallback.cycleMonth);
  const initialYear = String(initial?.cycleYear ?? fallback.cycleYear);
  const initialPrevious = findPreviousEdition(existingEditions, initialPlanId, initialYear, initialMonth);

  const [planId, setPlanId] = useState<string | null>(initialPlanId);
  const [cycleMonth, setCycleMonth] = useState(initialMonth);
  const [cycleYear, setCycleYear] = useState(initialYear);
  const [title, setTitle] = useState("");
  const [copyPrevious, setCopyPrevious] = useState(true);
  const [items, setItems] = useState<AdminEditionItem[]>(initialPrevious?.items ?? []);
  /** Lo último que se precargó solo: si la lista sigue igual, un cambio de
   * plan/mes la vuelve a precargar; si ya se ajustó a mano, no se pisa. */
  const [preloaded, setPreloaded] = useState<AdminEditionItem[]>(initialPrevious?.items ?? []);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Mientras el año va a medio teclear ("20") se usa el de arranque, para
  // que el placeholder no diga "1920".
  const cycleLabel = formatCycle(
    /^\d{4}$/.test(cycleYear) ? Number(cycleYear) : fallback.cycleYear,
    Number(cycleMonth),
  );

  const previousEdition = findPreviousEdition(existingEditions, planId, cycleYear, cycleMonth);
  const previous = /^\d{4}$/.test(cycleYear)
    ? previousCycle(Number(cycleYear), Number(cycleMonth))
    : null;

  function preload(next: AdminEditionItem[]) {
    setItems(next);
    setPreloaded(next);
  }

  /** Cambió plan, mes o año: con la casilla marcada y la lista sin tocar, se
   * precarga la caja del nuevo mes anterior (o se vacía si no hay). */
  function changeContext(next: { planId: string | null; cycleMonth: string; cycleYear: string }) {
    setPlanId(next.planId);
    setCycleMonth(next.cycleMonth);
    setCycleYear(next.cycleYear);
    if (copyPrevious && sameItems(items, preloaded)) {
      const nextPrevious = findPreviousEdition(existingEditions, next.planId, next.cycleYear, next.cycleMonth);
      preload(nextPrevious?.items ?? []);
    }
  }

  function handleCopyToggle(checked: boolean) {
    setCopyPrevious(checked);
    preload(checked ? (previousEdition?.items ?? []) : []);
  }

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
        items,
      });
      onCreated(edition);
    } catch (error) {
      if (error instanceof ApiRequestError && error.fieldErrors) {
        // `items.0.quantity` y similares no tienen campo propio: van al bloque
        // de productos; cualquier otra clave desconocida, al mensaje general.
        const { planId: planError, cycleYear: yearError, cycleMonth: monthError, title: titleError, ...rest } =
          error.fieldErrors;
        const itemsError = Object.entries(rest).find(([key]) => key.startsWith("items"));
        const orphan = Object.entries(rest).find(([key]) => !key.startsWith("items"));
        setFieldErrors({
          ...(planError ? { planId: planError } : {}),
          ...(yearError ? { cycleYear: yearError } : {}),
          ...(monthError ? { cycleMonth: monthError } : {}),
          ...(titleError ? { title: titleError } : {}),
          ...(itemsError ? { items: humanize(itemsError[1], names) } : {}),
        });
        if (orphan) setConflict(humanize(orphan[1], names));
      } else {
        setConflict(
          error instanceof ApiRequestError
            ? humanize(error.message, names)
            : "No se pudo crear la edición.",
        );
      }
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
          onChange={(value) => changeContext({ planId: value || null, cycleMonth, cycleYear })}
          options={plans.map((plan) => ({ value: plan.id, label: plan.name }))}
          placeholder="Elige un plan"
          error={fieldErrors.planId}
        />
        <Select
          label="Mes"
          value={cycleMonth}
          onChange={(value) => changeContext({ planId, cycleMonth: value, cycleYear })}
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
          onChange={(e) => changeContext({ planId, cycleMonth, cycleYear: e.target.value })}
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
            onChange={(e) => handleCopyToggle(e.target.checked)}
            className="mt-1 cursor-pointer"
          />
          <span>
            Copiar los {previousEdition.items.length}{" "}
            {previousEdition.items.length === 1 ? "producto" : "productos"} de{" "}
            {formatCycle(previous.cycleYear, previous.cycleMonth)}
            <span className="block text-body-sm text-muted-foreground-strong">
              Se cargan abajo: cambia lo que sea distinto este mes antes de crearla.
            </span>
          </span>
        </label>
      ) : null}
      <BundleItemEditor
        items={items}
        onChange={setItems}
        onNamesResolved={setNames}
        channel="subscription"
        copy={EDITION_ITEM_COPY}
        error={fieldErrors.items}
      />
      {conflict ? <FieldError message={conflict} /> : null}
      <div className="flex gap-3">
        <Button type="submit" loading={saving} disabled={!planId}>
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
