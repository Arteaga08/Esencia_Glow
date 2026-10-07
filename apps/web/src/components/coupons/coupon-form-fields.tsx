"use client";

import { COUPON_CODE_MAX_LENGTH, COUPON_DESCRIPTION_MAX_LENGTH, CouponDiscountType } from "@esencia-glow/shared";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CouponFormValues } from "@/lib/coupon-form";

const DISCOUNT_TYPE_OPTIONS = [
  { value: CouponDiscountType.PERCENT, label: "Porcentaje" },
  { value: CouponDiscountType.FIXED, label: "Monto fijo" },
];

interface CouponFormFieldsProps {
  values: CouponFormValues;
  onChange: (patch: Partial<CouponFormValues>) => void;
  /** Errores por campo, con las mismas claves que el API (`percentOff`, `endsAt`…). */
  errors: Record<string, string>;
  /** Cupón personal para una clienta: sin tope de personas y con la descripción como mensaje del correo. */
  personal?: boolean;
  disabled?: boolean;
}

/**
 * Campos compartidos por el alta de cupones públicos (página) y "Dar cupón"
 * (modal en Clientes). Cada error va pegado a su campo en lenguaje humano; el
 * toast solo acompaña.
 */
function CouponFormFields({ values, onChange, errors, personal = false, disabled = false }: CouponFormFieldsProps) {
  const isPercent = values.discountType === CouponDiscountType.PERCENT;
  const valueError = isPercent ? errors.percentOff : errors.amountOffCents;

  return (
    <div className="flex flex-col gap-5">
      <Input
        label="Código"
        placeholder="BIENVENIDA10"
        value={values.code}
        onChange={(event) => onChange({ code: event.target.value.toUpperCase() })}
        maxLength={COUPON_CODE_MAX_LENGTH + 8}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        error={errors.code}
        helper={errors.code ? undefined : "Lo que la clienta escribe al pagar. Letras sin acento, números y guiones."}
      />

      <Textarea
        label={personal ? "Mensaje para la clienta" : "Descripción"}
        placeholder={personal ? "Gracias por estar con nosotras desde el primer día" : "Cupón de bienvenida para la primera compra"}
        value={values.description}
        onChange={(event) => onChange({ description: event.target.value.slice(0, COUPON_DESCRIPTION_MAX_LENGTH) })}
        rows={3}
        disabled={disabled}
        error={errors.description}
        helper={
          errors.description
            ? undefined
            : `${personal ? "Sale en el correo que recibe." : "Solo la ves tú, para recordar de qué es."} ${values.description.length}/${COUPON_DESCRIPTION_MAX_LENGTH}`
        }
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Select
          label="Tipo de descuento"
          value={values.discountType}
          onChange={(value) => onChange({ discountType: value as CouponDiscountType })}
          options={DISCOUNT_TYPE_OPTIONS}
          disabled={disabled}
          error={errors.discountType}
        />
        <Input
          label={isPercent ? "Porcentaje" : "Monto en pesos"}
          placeholder={isPercent ? "15" : "100.00"}
          inputMode={isPercent ? "numeric" : "decimal"}
          value={values.value}
          onChange={(event) => onChange({ value: event.target.value })}
          disabled={disabled}
          error={valueError}
          helper={valueError ? undefined : isPercent ? "De 1 a 100, sobre los productos." : "Se descuenta de los productos."}
        />
      </div>

      <Input
        label="Compra mínima (opcional)"
        placeholder="800.00"
        inputMode="decimal"
        value={values.minSubtotal}
        onChange={(event) => onChange({ minSubtotal: event.target.value })}
        disabled={disabled}
        error={errors.minSubtotalCents}
        helper={errors.minSubtotalCents ? undefined : "En pesos, sin contar el envío. Vacío = sin mínimo."}
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Input
          label="Empieza (opcional)"
          type="date"
          value={values.startsAt}
          onChange={(event) => onChange({ startsAt: event.target.value })}
          disabled={disabled}
          error={errors.startsAt}
          helper={errors.startsAt ? undefined : "Desde las 00:00, hora de México."}
        />
        <Input
          label="Vence (opcional)"
          type="date"
          value={values.endsAt}
          onChange={(event) => onChange({ endsAt: event.target.value })}
          disabled={disabled}
          error={errors.endsAt}
          helper={errors.endsAt ? undefined : "Hasta las 23:59, hora de México."}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {personal ? null : (
          <Input
            label="Límite de personas (opcional)"
            placeholder="100"
            inputMode="numeric"
            value={values.maxCustomers}
            onChange={(event) => onChange({ maxCustomers: event.target.value })}
            disabled={disabled}
            error={errors.maxCustomers}
            helper={errors.maxCustomers ? undefined : "Cuántas clientas distintas pueden usarlo. Vacío = sin límite."}
          />
        )}
        <Input
          label="Usos por clienta"
          placeholder="1"
          inputMode="numeric"
          value={values.perCustomerLimit}
          onChange={(event) => onChange({ perCustomerLimit: event.target.value })}
          disabled={disabled}
          error={errors.perCustomerLimit}
          helper={errors.perCustomerLimit ? undefined : "Cuántas veces puede usarlo cada una."}
        />
      </div>
    </div>
  );
}

export { CouponFormFields };
