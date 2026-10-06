import { SpinnerGap } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { CTA_DISABLED, CTA_PRIMARY } from "../shared/styles";

interface SubmitButtonProps {
  submitting: boolean;
  /** Texto mientras se envía ("Entrando"). */
  busyLabel: string;
  children: ReactNode;
  className?: string;
}

/** Botón de envío de los formularios de acceso: bloquea el doble clic y avisa que está trabajando. */
function SubmitButton({ submitting, busyLabel, children, className = "w-full" }: SubmitButtonProps) {
  if (submitting) {
    return (
      <span className={`${CTA_DISABLED} ${className}`} role="status">
        <SpinnerGap size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
        {busyLabel}
      </span>
    );
  }
  return (
    <button type="submit" className={`${CTA_PRIMARY} ${className}`}>
      {children}
    </button>
  );
}

export { SubmitButton };
