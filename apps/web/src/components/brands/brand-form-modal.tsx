"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import type { AdminBrand } from "@/lib/types/admin-catalog";
import { BrandLogoField } from "./brand-logo-field";

/** Mismo tope que `createBrandSchema` en el backend
 * (apps/api/src/validators/brand.validator.ts). */
const NAME_MAX_LENGTH = 80;

interface BrandFormValues {
  name: string;
  showOnHome: boolean;
  /** Logo nuevo elegido en este modal; se sube después de guardar la marca. */
  logoFile: File | null;
  /** El logo guardado se quita al guardar (sin `logoFile` que lo reemplace). */
  removeLogo: boolean;
}

interface BrandFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  initialBrand?: AdminBrand;
  onClose: () => void;
  onSubmit: (values: BrandFormValues) => void;
  fieldErrors: Record<string, string>;
  submitting: boolean;
}

/**
 * Crear y editar comparten el modal: nombre, logo y si la marca sale en la
 * cinta del home. Quien lo monta le pasa `key` para que el estado arranque
 * limpio en cada apertura.
 */
function BrandFormModal({
  open,
  mode,
  initialBrand,
  onClose,
  onSubmit,
  fieldErrors,
  submitting,
}: BrandFormModalProps) {
  const [name, setName] = useState(initialBrand?.name ?? "");
  const [showOnHome, setShowOnHome] = useState(initialBrand?.showOnHome ?? false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ name: name.trim(), showOnHome, logoFile, removeLogo });
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
        <BrandLogoField
          currentUrl={initialBrand?.logo?.url}
          file={logoFile}
          removed={removeLogo}
          onPick={(file) => {
            setLogoFile(file);
            setRemoveLogo(false);
          }}
          onRemove={() => {
            setLogoFile(null);
            setRemoveLogo(true);
          }}
        />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-body text-foreground">Mostrar en el home</p>
            <p className="text-body-sm text-muted-foreground-strong">
              {showOnHome && !logoFile && (removeLogo || !initialBrand?.logo)
                ? "Sin logo se mostrará solo el nombre de la marca."
                : "Aparece en la cinta de marcas debajo de la portada."}
            </p>
          </div>
          <Switch checked={showOnHome} onChange={setShowOnHome} label="Mostrar en el home" />
        </div>
      </form>
    </Modal>
  );
}

export type { BrandFormValues, BrandFormModalProps };
export { BrandFormModal, NAME_MAX_LENGTH };
