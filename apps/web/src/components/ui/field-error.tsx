import { WarningCircle } from "@phosphor-icons/react";

interface FieldErrorProps {
  message: string;
}

/**
 * Error que no viene en `fieldErrors` (un 409 de conflicto, por ejemplo) y
 * por tanto no lo pinta `Input`/`Textarea`/`Select`: mismo tratamiento
 * visual (ícono `WarningCircle` 16px en `destructive-action`, DESIGN.md
 * §5) que esos controles, extraído del `FormError` privado de
 * `login-form.tsx` para reusarlo en el detalle de pedido y donde haga
 * falta. `role="alert"` para que un lector de pantalla lo anuncie al
 * aparecer, ya que nada mueve el foco.
 */
function FieldError({ message }: FieldErrorProps) {
  return (
    <p role="alert" className="flex items-start gap-1.5 text-body-sm text-destructive-action">
      <WarningCircle size={16} weight="regular" className="mt-0.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

export { FieldError };
