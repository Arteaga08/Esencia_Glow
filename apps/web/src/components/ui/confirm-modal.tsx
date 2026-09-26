"use client";

import type { ReactNode } from "react";
import { Button } from "./button";
import { FieldError } from "./field-error";
import { Modal } from "./modal";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "primary" | "destructive";
  loading: boolean;
  /** Un 409 u otro conflicto que el backend devolvió al confirmar — se
   * pinta dentro del modal y no lo cierra. */
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  children: ReactNode;
}

/**
 * Confirmación genérica: mismo footer + focus trap + `loading` que ya
 * tenían, copiados, `archive-product-modal`, `archive-bundle-modal`,
 * `delete-category-modal` y `delete-badge-modal`. Se extrae aquí porque el
 * detalle de pedido suma tres confirmaciones más (cancelar, avanzar a
 * enviada sin guía nueva, reintentar guía) sobre la misma entidad
 * (`AdminOrder`) — la copia por entidad dejó de justificarse.
 *
 * Los cuatro modales existentes NO se migran en este milestone (cambio
 * ortogonal, riesgo gratis) — quedan como deuda técnica anotada.
 */
function ConfirmModal({
  open,
  title,
  confirmLabel,
  cancelLabel = "Cancelar",
  variant = "primary",
  loading,
  error,
  onCancel,
  onConfirm,
  children,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {children}
        {error ? <FieldError message={error} /> : null}
      </div>
    </Modal>
  );
}

export type { ConfirmModalProps };
export { ConfirmModal };
