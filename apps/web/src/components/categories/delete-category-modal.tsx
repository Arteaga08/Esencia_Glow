"use client";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { AdminCategory } from "@/lib/types/admin-catalog";

interface DeleteCategoryModalProps {
  category: AdminCategory | null;
  isSubcategory: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
}

/**
 * A diferencia de Producto (que archiva), una categoría SÍ se borra de
 * verdad cuando no tiene hijos ni productos asociados — el copy lo dice sin
 * rodeos (PRODUCT.md principio 3: el dato honesto importa más que la
 * brevedad). El backend responde 409 si tiene subcategorías o productos; ese
 * mensaje ya viene en español y llega tal cual al toast de quien use este
 * modal.
 */
function DeleteCategoryModal({
  category,
  isSubcategory,
  onCancel,
  onConfirm,
  loading,
}: DeleteCategoryModalProps) {
  return (
    <Modal
      open={category !== null}
      onClose={onCancel}
      title={isSubcategory ? "Borrar subcategoría" : "Borrar categoría"}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} loading={loading}>
            Borrar
          </Button>
        </>
      }
    >
      <p>
        <strong className="font-medium text-foreground">{category?.name}</strong> se borrará por
        completo — a diferencia de un producto, esto no se puede deshacer. Si tiene{" "}
        {isSubcategory ? "productos asociados" : "subcategorías o productos asociados"}, no se podrá
        borrar.
      </p>
    </Modal>
  );
}

export { DeleteCategoryModal };
