"use client";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { AdminBundle } from "@/lib/types/admin-catalog";

interface ArchiveBundleModalProps {
  bundle: AdminBundle | null;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
}

/**
 * Paso de confirmación nombrado para archivar (PRODUCT.md principio 2) —
 * mismo criterio que `ArchiveProductModal`: el paquete sigue existiendo para
 * las órdenes que ya lo referencian, no se elimina.
 */
function ArchiveBundleModal({ bundle, onCancel, onConfirm, loading }: ArchiveBundleModalProps) {
  return (
    <Modal
      open={bundle !== null}
      onClose={onCancel}
      title="Archivar paquete"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} loading={loading}>
            Archivar
          </Button>
        </>
      }
    >
      <p>
        <strong className="font-medium text-foreground">{bundle?.name}</strong> dejará de mostrarse en la
        tienda. No se elimina: sigue existiendo para las órdenes que ya lo referencian, y puedes volver a
        activarlo cuando quieras.
      </p>
    </Modal>
  );
}

export { ArchiveBundleModal };
