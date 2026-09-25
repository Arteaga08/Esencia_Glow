"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { AdminBadge } from "@/lib/types/admin-catalog";

interface DeleteBadgeModalProps {
  badge: AdminBadge | null;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
  /** Mensaje humano del 409 (badge asignada a productos) — el backend lo
   * rechaza de verdad, así que el modal se queda abierto mostrándolo en vez
   * de cerrarse con solo un toast. */
  error: string | null;
}

/**
 * A diferencia de archivar un producto, borrar un badge SÍ es un borrado
 * duro (no hay soft-delete para esta entidad — `badge.service.ts` hace
 * `deleteOne`). El copy lo deja explícito.
 */
function DeleteBadgeModal({ badge, onCancel, onConfirm, loading, error }: DeleteBadgeModalProps) {
  return (
    <Modal
      open={badge !== null}
      onClose={onCancel}
      title="Eliminar badge"
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
        <strong className="font-medium text-foreground">{badge?.text}</strong> se eliminará
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

export { DeleteBadgeModal };
