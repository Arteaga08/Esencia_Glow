"use client";

import { useState, type FormEvent } from "react";
import type { GiveCouponResult } from "@esencia-glow/shared";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiRequest, ApiRequestError } from "@/lib/api";
import { EMPTY_COUPON_FORM, toCouponInput, type CouponFormValues } from "@/lib/coupon-form";
import { CouponFormFields } from "./coupon-form-fields";

interface GiveCouponModalProps {
  open: boolean;
  customer: { id: string; firstName: string; email: string };
  onClose: () => void;
}

/**
 * "Dar cupón" desde el detalle de una clienta (Milestone 3.7): crea un cupón
 * personal (solo ella lo canjea) y se lo manda por correo con el mensaje que
 * escribas. Si el correo no sale, el cupón ya quedó creado: se avisa para que
 * se lo hagas llegar por otro medio. Quien monta el modal le pasa
 * `key={customer.id}` para que el estado arranque limpio en cada clienta.
 */
function GiveCouponModal({ open, customer, onClose }: GiveCouponModalProps) {
  const { toast } = useToast();
  const [values, setValues] = useState<CouponFormValues>(EMPTY_COUPON_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    if (submitting) return;
    setErrors({});
    setFormError(null);
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const parsed = toCouponInput(values, { personal: true });
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const response = await apiRequest<GiveCouponResult>(`/api/v1/admin/customers/${customer.id}/coupons`, {
        method: "POST",
        authenticated: true,
        body: parsed.input,
      });
      const { coupon, emailSent } = response.data;
      if (emailSent) {
        toast({ variant: "success", title: "Cupón enviado", description: `${coupon.code} le llegó a ${customer.email}.` });
      } else {
        toast({
          variant: "warning",
          title: "Cupón creado, pero el correo no salió",
          description: `Avísale a ${customer.firstName} que su código es ${coupon.code}.`,
        });
      }
      setValues(EMPTY_COUPON_FORM);
      onClose();
    } catch (error) {
      if (error instanceof ApiRequestError && error.fieldErrors && Object.keys(error.fieldErrors).length > 0) {
        setErrors(error.fieldErrors);
      } else {
        const message = error instanceof ApiRequestError ? error.message : "No pudimos dar el cupón. Inténtalo de nuevo.";
        setFormError(message);
        toast({ variant: "error", title: "No se pudo dar el cupón", description: message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Dar cupón a ${customer.firstName}`}
      size="lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" form="give-coupon-form" variant="primary" loading={submitting}>
            Crear y enviar
          </Button>
        </>
      }
    >
      <form id="give-coupon-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <p className="text-body-sm text-muted-foreground-strong">
          Es un cupón personal: solo {customer.firstName} puede usarlo. Le llega a {customer.email}.
        </p>
        <CouponFormFields values={values} onChange={(patch) => setValues((current) => ({ ...current, ...patch }))} errors={errors} personal disabled={submitting} />
        {formError ? <FieldError message={formError} /> : null}
      </form>
    </Modal>
  );
}

export { GiveCouponModal };
