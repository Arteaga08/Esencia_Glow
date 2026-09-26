"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { useFocusTrap } from "@/lib/use-focus-trap";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** `md` (default, `max-w-md`) para confirmaciones; `lg` (`max-w-2xl`)
   * para formularios con varios campos, como corregir dirección. */
  size?: "md" | "lg";
}

const SIZE_CLASSNAMES: Record<NonNullable<ModalProps["size"]>, string> = {
  md: "max-w-md",
  lg: "max-w-2xl",
};

/**
 * DESIGN.md §5: superficie `surface`, `rounded.lg`, `shadow.modal`, borde
 * `border-strong` 1px, padding 24px, scrim tinta 40% SIN blur, focus trap +
 * retorno de foco. Reservado a lo que de verdad no cabe inline ni en un
 * panel lateral (`DESIGN.md:545`).
 *
 * `titleId` es propio de cada instancia (`useId`): con dos modales en el
 * árbol (uno de confirmación y otro con formulario, como en el detalle de
 * pedido) un id fijo se duplicaría y rompería `aria-labelledby`.
 */
function Modal({ open, onClose, title, children, footer, size = "md" }: ModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(containerRef, open);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-[oklch(0.4015_0.0436_37.9587_/_0.4)]"
      />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ "--surface-bg": "var(--color-surface)" } as React.CSSProperties}
        className={
          `relative z-10 flex max-h-[calc(100vh-4rem)] w-full flex-col overflow-y-auto ${SIZE_CLASSNAMES[size]} ` +
          "rounded-lg border border-border-strong bg-surface p-6 text-foreground shadow-[var(--shadow-modal)]"
        }
      >
        <h2 id={titleId} className="text-section-title text-foreground">
          {title}
        </h2>
        <div className="mt-3 text-body text-foreground">{children}</div>
        {footer ? <div className="mt-6 flex justify-end gap-3">{footer}</div> : null}
      </div>
    </div>
  );
}

export type { ModalProps };
export { Modal };
