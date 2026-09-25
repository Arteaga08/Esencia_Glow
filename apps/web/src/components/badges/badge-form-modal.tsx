"use client";

import { useState, type FormEvent } from "react";
import { Badge, type BadgeColorValue } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { BadgeColorPicker } from "./badge-color-picker";

/** Mismo tope que `createBadgeSchema`/`updateBadgeSchema` en el backend
 * (apps/api/src/validators/badge.validator.ts) — no se valida aparte, solo
 * se refleja aquí para el contador y el `maxLength` nativo del input. */
const TEXT_MAX_LENGTH = 40;

interface BadgeFormValues {
  text: string;
  color: BadgeColorValue;
}

interface BadgeFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  initialValues?: BadgeFormValues;
  onClose: () => void;
  onSubmit: (values: BadgeFormValues) => void;
  fieldErrors: Record<string, string>;
  submitting: boolean;
}

/**
 * Crear y editar comparten el mismo modal — un badge son 2 campos, no
 * justifica rutas propias como Productos (decisión confirmada con Manuel).
 * Quien monta este componente le pasa `key={badge?.id ?? "create"}` para que
 * el estado interno arranque limpio en cada apertura, en vez de resetearlo
 * con un efecto.
 */
function BadgeFormModal({
  open,
  mode,
  initialValues,
  onClose,
  onSubmit,
  fieldErrors,
  submitting,
}: BadgeFormModalProps) {
  const [text, setText] = useState(initialValues?.text ?? "");
  const [color, setColor] = useState<BadgeColorValue>(initialValues?.color ?? "neutral");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ text: text.trim(), color });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "edit" ? "Editar badge" : "Nuevo badge"}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" form="badge-form" variant="primary" loading={submitting}>
            {mode === "edit" ? "Guardar cambios" : "Crear badge"}
          </Button>
        </>
      }
    >
      <form id="badge-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input
          label="Texto"
          placeholder="Más vendido"
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, TEXT_MAX_LENGTH))}
          maxLength={TEXT_MAX_LENGTH}
          error={fieldErrors.text}
          helper={fieldErrors.text ? undefined : `${text.length}/${TEXT_MAX_LENGTH} caracteres`}
        />

        <BadgeColorPicker value={color} onChange={setColor} />

        <div>
          <p className="mb-2 font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">
            Vista previa
          </p>
          {/* max-w-60 (240px): el mismo espacio aproximado que tiene el badge
              sobre la foto de una tarjeta de producto (ver product-card.tsx)
              — así lo que se ve aquí es lo que se ve realmente en el catálogo,
              elipsis incluida si el texto no cabe. */}
          <div className="flex max-w-60 items-center rounded-md border border-border bg-muted/30 p-4">
            <Badge color={color}>{text.trim() || "Vista previa"}</Badge>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export type { BadgeFormValues, BadgeFormModalProps };
export { BadgeFormModal, TEXT_MAX_LENGTH };
