"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

/** Mismo tope que `createBrandSchema` en el backend
 * (apps/api/src/validators/brand.validator.ts). */
const NAME_MAX_LENGTH = 80;

interface BrandFormValues {
  name: string;
}

interface BrandFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  initialValues?: BrandFormValues;
  onClose: () => void;
  onSubmit: (values: BrandFormValues) => void;
  fieldErrors: Record<string, string>;
  submitting: boolean;
}

/**
 * Crear y editar comparten el modal — una marca es un solo campo. Quien lo
 * monta le pasa `key` para que el estado arranque limpio en cada apertura.
 */
function BrandFormModal({
  open,
  mode,
  initialValues,
  onClose,
  onSubmit,
  fieldErrors,
  submitting,
}: BrandFormModalProps) {
  const [name, setName] = useState(initialValues?.name ?? "");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ name: name.trim() });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "edit" ? "Editar marca" : "Nueva marca"}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" form="brand-form" variant="primary" loading={submitting}>
            {mode === "edit" ? "Guardar cambios" : "Crear marca"}
          </Button>
        </>
      }
    >
      <form id="brand-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input
          label="Nombre"
          placeholder="Beauty of Joseon"
          value={name}
          onChange={(event) => setName(event.target.value.slice(0, NAME_MAX_LENGTH))}
          maxLength={NAME_MAX_LENGTH}
          error={fieldErrors.name}
          helper={
            fieldErrors.name
              ? undefined
              : mode === "edit"
                ? "Al renombrarla, se actualiza en todos los productos que la usan."
                : undefined
          }
        />
      </form>
    </Modal>
  );
}

export type { BrandFormValues, BrandFormModalProps };
export { BrandFormModal, NAME_MAX_LENGTH };
