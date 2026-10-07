"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { AdminCoupon } from "@esencia-glow/shared";
import { Button, getButtonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field-error";
import { useToast } from "@/components/ui/toast";
import { apiRequest, ApiRequestError } from "@/lib/api";
import { ADMIN_ROUTES } from "@/lib/admin-routes";
import { EMPTY_COUPON_FORM, toCouponInput, type CouponFormValues } from "@/lib/coupon-form";
import { CouponFormFields } from "./coupon-form-fields";

/**
 * Alta de un cupón público (Milestone 3.7). Un cupón creado ya no se edita:
 * solo se activa o desactiva, así que el formulario avisa antes de guardar.
 * Los errores del servidor (código repetido, fecha pasada…) vuelven pegados a
 * su campo.
 */
function NewCouponForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState<CouponFormValues>(EMPTY_COUPON_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const parsed = toCouponInput(values);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const response = await apiRequest<AdminCoupon>("/api/v1/admin/coupons", { method: "POST", authenticated: true, body: parsed.input });
      toast({ variant: "success", title: "Cupón creado", description: response.data.code });
      router.push(ADMIN_ROUTES.coupons);
    } catch (error) {
      if (error instanceof ApiRequestError && error.fieldErrors && Object.keys(error.fieldErrors).length > 0) {
        setErrors(error.fieldErrors);
      } else {
        const message = error instanceof ApiRequestError ? error.message : "No pudimos crear el cupón. Inténtalo de nuevo.";
        setFormError(message);
        toast({ variant: "error", title: "No se pudo crear el cupón", description: message });
      }
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Card className="max-w-2xl">
        <CouponFormFields values={values} onChange={(patch) => setValues((current) => ({ ...current, ...patch }))} errors={errors} disabled={submitting} />
        <p className="mt-6 text-body-sm text-muted-foreground-strong">
          Una vez creado, el cupón no se puede editar: solo desactivar o reactivar. Si te equivocas, desactívalo y crea otro.
        </p>
        {formError ? (
          <div className="mt-4">
            <FieldError message={formError} />
          </div>
        ) : null}
        <div className="mt-6 flex justify-end gap-3">
          <Link href={ADMIN_ROUTES.coupons} className={getButtonClassName("secondary")}>
            Cancelar
          </Link>
          <Button type="submit" variant="primary" loading={submitting}>
            Crear cupón
          </Button>
        </div>
      </Card>
    </form>
  );
}

export { NewCouponForm };
