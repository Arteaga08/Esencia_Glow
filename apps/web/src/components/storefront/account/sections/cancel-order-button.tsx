"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { accountRequest } from "@/lib/storefront/account-api";
import { classifyError } from "@/lib/storefront/auth-errors";
import { TEXT_LINK } from "../shared/styles";

/** Cancelar un pedido propio que aún no se paga (`POST /orders/:id/cancel`). */
function CancelOrderButton({ orderId, onCancelled }: { orderId: string; /** Aviso a quien lo usa dentro de una pantalla que no se recarga sola (el checkout). */ onCancelled?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      await accountRequest(`/api/v1/orders/${orderId}/cancel`, { method: "POST" });
      setOpen(false);
      onCancelled?.();
      router.refresh();
    } catch (caught) {
      setError(classifyError(caught).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={TEXT_LINK}>
        Cancelar pedido
      </button>
      <ConfirmModal
        open={open}
        title="Cancelar pedido"
        confirmLabel="Cancelar pedido"
        cancelLabel="Conservarlo"
        variant="destructive"
        loading={loading}
        error={error}
        onCancel={() => setOpen(false)}
        onConfirm={handleConfirm}
      >
        <p className="text-body text-foreground/80">Si lo cancelas, liberamos los productos y ya no podrás pagarlo. Esta acción no se puede deshacer.</p>
      </ConfirmModal>
    </>
  );
}

export { CancelOrderButton };
