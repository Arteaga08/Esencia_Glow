"use client";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { AdminProduct } from "@/lib/types/admin-catalog";

interface ArchiveProductModalProps {
  product: AdminProduct | null;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
}

/**
 * Paso de confirmación nombrado para archivar (PRODUCT.md principio 2:
 * ninguna acción irreversible-en-apariencia sin confirmar). El copy aclara
 * de entrada que no es un borrado real — el dato honesto importa más que la
 * brevedad (PRODUCT.md principio 3).
 */
function ArchiveProductModal({ product, onCancel, onConfirm, loading }: ArchiveProductModalProps) {
  return (
    <Modal
      open={product !== null}
      onClose={onCancel}
      title="Archivar producto"
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
        <strong className="font-medium text-foreground">{product?.name}</strong> dejará de mostrarse
        en la tienda. No se elimina: sigue existiendo para las órdenes que ya lo referencian, y puedes
        volver a activarlo cuando quieras.
      </p>
    </Modal>
  );
}

export { ArchiveProductModal };
