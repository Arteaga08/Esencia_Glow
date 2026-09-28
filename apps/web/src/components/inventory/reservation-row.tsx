"use client";

import { useState } from "react";
import { ReservationStatus } from "@esencia-glow/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useToast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/api";
import { formatDateTime } from "@/lib/format-date";
import type { AdminReservation } from "@/lib/types/admin-inventory";
import { handleInventoryError } from "./handle-inventory-error";
import { RESERVATION_STATUS_BADGE } from "./stock-status";

interface ReservationRowProps {
  reservation: AdminReservation;
  /** Tras liberar (o tras un 409) las tres colas se vuelven a pedir: la
   * reserva cambió de cola y la fila no se muta con la respuesta. */
  onChanged: () => void;
}

/** La fecha que importa según el estado: cuándo vence la activa, cuándo se
 * cerró la que ya terminó. */
function describeWhen(reservation: AdminReservation): string {
  if (reservation.status === ReservationStatus.COMMITTED && reservation.committedAt) {
    return `Comprometido el ${formatDateTime(reservation.committedAt)}`;
  }
  if (reservation.status === ReservationStatus.RELEASED && reservation.releasedAt) {
    return `Liberado el ${formatDateTime(reservation.releasedAt)}`;
  }
  return `Vence el ${formatDateTime(reservation.expiresAt)}`;
}

/**
 * Un apartado = un carrito: referencia arriba, líneas (SKU × cantidad) y
 * fecha abajo. "Liberar" solo existe en `active`: una reserva comprometida
 * ya es venta y el backend la rechaza con 409, que se pinta dentro del
 * modal si alguien la comprometió entre que se listó y se confirmó.
 */
function ReservationRow({ reservation, onChanged }: ReservationRowProps) {
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const badge = RESERVATION_STATUS_BADGE[reservation.status];
  const units = reservation.lines.reduce((sum, line) => sum + line.quantity, 0);

  async function handleRelease() {
    setReleasing(true);
    setConflict(null);
    try {
      await apiRequest(`/api/v1/admin/inventory/reservations/${reservation.id}/release`, {
        method: "POST",
        authenticated: true,
      });
      toast({ variant: "success", title: "Apartado liberado", description: "Las unidades volvieron a estar disponibles." });
      setConfirmOpen(false);
      onChanged();
    } catch (error) {
      handleInventoryError({ error, setConflict, toast, title: "No se pudo liberar el apartado", refresh: onChanged });
    } finally {
      setReleasing(false);
    }
  }

  function closeModal() {
    setConfirmOpen(false);
    setConflict(null);
  }

  return (
    <li className="border-t border-border first:border-t-0">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate font-mono text-body-sm tabular-nums text-foreground">{reservation.cartRef}</span>
          <ul className="flex flex-wrap gap-x-4 gap-y-0.5">
            {reservation.lines.map((line) => (
              <li key={line.variantId} className="font-mono text-body-sm tabular-nums text-muted-foreground-strong">
                {line.sku} × {line.quantity}
              </li>
            ))}
          </ul>
          <span className="text-body-sm text-muted-foreground">{describeWhen(reservation)}</span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Badge color={badge.color}>{badge.label}</Badge>
          {reservation.status === ReservationStatus.ACTIVE ? (
            <Button size="sm" variant="secondary" onClick={() => setConfirmOpen(true)}>
              Liberar
            </Button>
          ) : null}
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Liberar apartado"
        confirmLabel="Liberar"
        variant="destructive"
        loading={releasing}
        error={conflict}
        onCancel={closeModal}
        onConfirm={handleRelease}
      >
        <p className="text-body-sm text-muted-foreground-strong">
          {units} {units === 1 ? "unidad vuelve" : "unidades vuelven"} a estar disponibles y el carrito{" "}
          <span className="font-mono">{reservation.cartRef}</span> pierde su apartado.
        </p>
      </ConfirmModal>
    </li>
  );
}

export { ReservationRow };
