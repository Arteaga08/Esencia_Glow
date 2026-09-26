"use client";

import { useState, type FormEvent } from "react";
import type { AdminOrder } from "@esencia-glow/shared";
import { apiRequest, ApiRequestError } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { formatMoneyMXN } from "@/lib/format-money";

interface RefundModalProps {
  order: AdminOrder;
  remainingCents: number;
  open: boolean;
  onClose: () => void;
  onOrderUpdated: (order: AdminOrder) => void;
  /** Relee el pedido tras un 409 (contracargo abierto, ya reembolsado,
   * reembolso en proceso) — sin esto, el botón sigue ofreciendo un
   * reembolso que va a volver a fallar. */
  refreshOrder: () => void;
}

/**
 * Reembolso en dos pasos — la irreversibilidad y el monto (siempre el
 * remanente total, nunca parcial) se confirman ANTES de pedir el código
 * 2FA, en vez de meter los tres campos en un solo formulario.
 */
function RefundModal({ order, remainingCents, open, onClose, onOrderUpdated, refreshOrder }: RefundModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<"amount" | "code">("amount");
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  function resetAndClose() {
    setStep("amount");
    setReason("");
    setCode("");
    setCodeError(null);
    setConflict(null);
    onClose();
  }

  function handleContinue(event: FormEvent) {
    event.preventDefault();
    setStep("code");
  }

  async function handleConfirm(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setCodeError(null);
    setConflict(null);
    try {
      const response = await apiRequest<AdminOrder>(`/api/v1/admin/orders/${order.id}/refund`, {
        method: "POST",
        authenticated: true,
        body: { twoFactorCode: code, ...(reason.trim() ? { reason: reason.trim() } : {}) },
      });
      onOrderUpdated(response.data);
      toast({ variant: "success", title: "Reembolso solicitado" });
      resetAndClose();
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        setCodeError(error.message);
        setCode("");
      } else if (error instanceof ApiRequestError) {
        setConflict(error.message);
        toast({ variant: "error", title: "No se pudo solicitar el reembolso", description: error.message });
        if (error.status === 409) refreshOrder();
      } else {
        setConflict("Intenta de nuevo.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={resetAndClose}
      title={step === "amount" ? "Reembolsar pedido" : "Verificación en dos pasos"}
      footer={
        step === "amount" ? (
          <>
            <Button type="button" variant="secondary" onClick={resetAndClose}>
              Cancelar
            </Button>
            <Button type="submit" form="refund-amount-form" variant="destructive">
              Continuar
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="secondary" onClick={() => setStep("amount")} disabled={saving}>
              Volver
            </Button>
            <Button type="submit" form="refund-code-form" variant="destructive" loading={saving}>
              Reembolsar {formatMoneyMXN(remainingCents)}
            </Button>
          </>
        )
      }
    >
      {step === "amount" ? (
        <form id="refund-amount-form" onSubmit={handleContinue} className="flex flex-col gap-4">
          <p className="font-mono text-section-title tabular-nums text-foreground">{formatMoneyMXN(remainingCents)}</p>
          <p className="text-body-sm text-destructive-action">
            Esta acción no se puede revertir. El reembolso siempre es por el remanente total del
            pedido — no se puede reembolsar solo una parte.
          </p>
          <Textarea
            label="Motivo (opcional)"
            placeholder="Producto dañado en tránsito"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </form>
      ) : (
        <form id="refund-code-form" onSubmit={handleConfirm} className="flex flex-col gap-4">
          <p className="text-body-sm text-muted-foreground-strong">
            Ingresa el código de 6 dígitos de tu app de autenticación para confirmar el reembolso de{" "}
            {formatMoneyMXN(remainingCents)}.
          </p>
          <Input
            label="Código"
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            error={codeError ?? undefined}
          />
          {conflict ? <FieldError message={conflict} /> : null}
        </form>
      )}
    </Modal>
  );
}

export { RefundModal };
