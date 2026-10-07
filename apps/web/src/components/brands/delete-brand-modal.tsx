"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { AdminBrand } from "@/lib/types/admin-catalog";

interface DeleteBrandModalProps {
  brand: AdminBrand | null;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
  /** Mensaje humano del 409 (marca en uso): el modal se queda abierto mostrándolo. */
  error: string | null;
}

/** Borrado duro: el backend rechaza (409) si algún producto usa la marca. */
function DeleteBrandModal({ brand, onCancel, onConfirm, loading, error }: DeleteBrandModalProps) {
  return (
    <Modal
      open={brand !== null}
      onClose={onCancel}
      title="Eliminar marca"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} loading={loading} disabled={Boolean(error)}>
            Eliminar
          </Button>
        </>
      }
    >
      <p>
        <strong className="font-medium text-foreground">{brand?.name}</strong> se eliminará
        permanentemente. Esta acción no se puede deshacer.
      </p>
      {error ? (
        <p className="mt-3 flex items-start gap-1.5 text-body-sm text-destructive-action">
          <WarningCircle size={16} weight="regular" className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </Modal>
  );
}

export { DeleteBrandModal };
