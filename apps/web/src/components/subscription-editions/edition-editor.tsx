"use client";

import { useState } from "react";
import Link from "next/link";
import { EditionStatus } from "@esencia-glow/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BundleItemEditor, type ItemEditorCopy } from "@/components/bundles/bundle-item-editor";
import { ApiRequestError } from "@/lib/api";
import { formatCycle } from "@/lib/format-cycle";
import { formatDateTime } from "@/lib/format-date";
import { formatMoneyMXN } from "@/lib/format-money";
import type {
  AdminEditionItem,
  AdminSubscriptionEdition,
  AdminSubscriptionPlan,
} from "@/lib/types/admin-subscription";
import { humanize } from "./edition-error-text";
import { EditionStatusBadge } from "./edition-status-badge";
import { ADMIN_ROUTES } from "@/lib/admin-routes";

const EDITION_ITEM_COPY: ItemEditorCopy = {
  title: "Productos de la caja",
  empty: "La caja está vacía. Agrega al menos un producto para poder publicarla.",
  addTitle: "Agregar producto",
  duplicate: "Esa variante ya está en la caja; cambia la cantidad en vez de repetirla.",
};

interface EditionSaveBody {
  title: string;
  description: string;
  items?: AdminEditionItem[];
}

/** Escrituras que el editor dispara. Las implementa quien lo monta (la
 * pantalla real contra la API; las previews de diseño, sin escribir). */
interface EditionEditorActions {
  save: (body: EditionSaveBody) => Promise<AdminSubscriptionEdition>;
  publish: () => Promise<AdminSubscriptionEdition>;
  unpublish: () => Promise<AdminSubscriptionEdition>;
  remove: () => Promise<void>;
}

interface EditionEditorProps {
  edition: AdminSubscriptionEdition;
  plan: AdminSubscriptionPlan | undefined;
  actions: EditionEditorActions;
  onChanged: (edition: AdminSubscriptionEdition) => void;
  onRemoved: () => void;
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

/**
 * Armar y publicar la edición de un ciclo (2.7b-2). Borrador: todo editable.
 * Publicada: título y descripción siguen editables, los productos quedan
 * congelados (subscription-edition.service.ts::updateEdition). Publicar usa
 * lo GUARDADO, así que con cambios sin guardar el botón se apaga en vez de
 * publicar algo distinto a lo que se ve en pantalla.
 */
function EditionEditor({ edition, plan, actions, onChanged, onRemoved }: EditionEditorProps) {
  const [title, setTitle] = useState(edition.title);
  const [description, setDescription] = useState(edition.description ?? "");
  const [items, setItems] = useState<AdminEditionItem[]>(edition.items);
  const [boxValue, setBoxValue] = useState(0);
  const [names, setNames] = useState<Map<string, string>>(new Map());

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "publish" | "unpublish" | "remove" | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const published = edition.status === EditionStatus.PUBLISHED;
  const itemsDirty = !sameItems(items, edition.items);
  const dirty =
    title !== edition.title || description !== (edition.description ?? "") || itemsDirty;

  function applySaved(next: AdminSubscriptionEdition) {
    setTitle(next.title);
    setDescription(next.description ?? "");
    setItems(next.items);
    onChanged(next);
  }

  async function run(kind: NonNullable<typeof busy>, task: () => Promise<void>, fallback: string) {
    setBusy(kind);
    setActionError(null);
    setFieldErrors({});
    try {
      await task();
    } catch (error) {
      if (error instanceof ApiRequestError && error.fieldErrors) {
        // `items.0.quantity` y similares no tienen campo propio: se muestran
        // en el bloque de productos. Cualquier otra clave desconocida cae al
        // mensaje general, nunca se descarta en silencio (hallazgo de code
        // review de 2.7b-2).
        const { title: titleError, description: descriptionError, ...rest } = error.fieldErrors;
        const itemsError = Object.entries(rest).find(([key]) => key.startsWith("items"));
        const orphan = Object.entries(rest).find(([key]) => !key.startsWith("items"));
        setFieldErrors({
          ...(titleError ? { title: titleError } : {}),
          ...(descriptionError ? { description: descriptionError } : {}),
          ...(itemsError ? { items: humanize(itemsError[1], names) } : {}),
        });
        if (orphan) setActionError(humanize(orphan[1], names));
      } else {
        setActionError(
          error instanceof ApiRequestError ? humanize(error.message, names) : fallback,
        );
      }
    } finally {
      setBusy(null);
    }
  }

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    void run(
      "save",
      async () =>
        applySaved(await actions.save({ title, description, ...(itemsDirty ? { items } : {}) })),
      "No se pudieron guardar los cambios.",
    );
  }

  const cycleLabel = formatCycle(edition.cycleYear, edition.cycleMonth);

  return (
    <form onSubmit={handleSave} className="flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-body text-muted-foreground-strong">
            Caja de{" "}
            {plan ? (
              <Link href={ADMIN_ROUTES.plan(plan.id)} className="text-foreground underline">
                {plan.name}
              </Link>
            ) : (
              "plan desconocido"
            )}{" "}
            · {cycleLabel}
          </p>
          <EditionStatusBadge status={edition.status} />
          {edition.publishedAt ? (
            <p className="text-body-sm text-muted-foreground-strong">
              Publicada el {formatDateTime(edition.publishedAt)}
            </p>
          ) : null}
        </div>
        {!published ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setConfirmingRemove(true)}
          >
            Eliminar borrador
          </Button>
        ) : null}
      </div>

      <Card>
        <p className="mb-6 text-section-title text-foreground">Datos de la edición</p>
        <div className="flex flex-col gap-4">
          <Input
            label="Título"
            placeholder={`Ritual de hidratación, ${cycleLabel.toLowerCase()}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={fieldErrors.title}
            maxLength={160}
          />
          <Textarea
            label="Descripción"
            placeholder="Este mes armamos una rutina de noche completa: limpieza suave, sérum y aceite facial."
            helper="Opcional. La ve la suscriptora en su cuenta."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            error={fieldErrors.description}
            maxLength={3000}
          />
        </div>
      </Card>

      <BundleItemEditor
        items={items}
        onChange={setItems}
        onSumChange={setBoxValue}
        onNamesResolved={setNames}
        channel="subscription"
        copy={EDITION_ITEM_COPY}
        readOnly={published}
        readOnlyNote="Los productos quedan fijos al publicar. Para cambiarlos, despublica la edición (solo es posible si todavía no generó cobros)."
        error={fieldErrors.items}
      />

      {items.length > 0 && plan ? (
        <p className="text-body-sm text-muted-foreground-strong">
          Valor de la caja en tienda:{" "}
          <span className="font-mono text-data tabular-nums text-foreground">
            {formatMoneyMXN(boxValue)}
          </span>{" "}
          contra{" "}
          <span className="font-mono text-data tabular-nums">
            {formatMoneyMXN(plan.priceCents)}
          </span>{" "}
          del plan mensual.
        </p>
      ) : null}

      {actionError ? <FieldError message={actionError} /> : null}

      <div className="flex flex-wrap items-center gap-3">
        {dirty || published ? (
          <Button
            type="submit"
            variant={dirty ? "primary" : "secondary"}
            loading={busy === "save"}
            disabled={!dirty}
          >
            Guardar cambios
          </Button>
        ) : null}
        {published ? (
          <Button
            type="button"
            variant="secondary"
            loading={busy === "unpublish"}
            onClick={() =>
              void run(
                "unpublish",
                async () => applySaved(await actions.unpublish()),
                "No se pudo despublicar.",
              )
            }
          >
            Despublicar
          </Button>
        ) : (
          <Button
            type="button"
            variant={dirty ? "secondary" : "primary"}
            loading={busy === "publish"}
            disabled={dirty || edition.items.length === 0}
            onClick={() =>
              void run(
                "publish",
                async () => applySaved(await actions.publish()),
                "No se pudo publicar.",
              )
            }
          >
            Publicar edición
          </Button>
        )}
        {!published && dirty ? (
          <p className="text-body-sm text-muted-foreground-strong">
            Guarda los cambios antes de publicar.
          </p>
        ) : null}
      </div>

      <ConfirmModal
        open={confirmingRemove}
        title="¿Eliminar este borrador?"
        confirmLabel="Eliminar"
        variant="destructive"
        loading={busy === "remove"}
        onCancel={() => setConfirmingRemove(false)}
        onConfirm={() =>
          void run(
            "remove",
            async () => {
              try {
                await actions.remove();
              } finally {
                setConfirmingRemove(false);
              }
              onRemoved();
            },
            "No se pudo eliminar la edición.",
          )
        }
      >
        <p className="text-body text-foreground">
          Se borra la edición de {cycleLabel} de {plan?.name ?? "este plan"}. No se puede deshacer.
        </p>
      </ConfirmModal>
    </form>
  );
}

export { EditionEditor };
export type { EditionEditorActions, EditionSaveBody };
