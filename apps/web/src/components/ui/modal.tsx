"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useFocusTrap } from "@/lib/use-focus-trap";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * DESIGN.md §5: superficie `surface`, `rounded.lg`, `shadow.modal`, borde
 * `border-strong` 1px, padding 24px, scrim tinta 40% SIN blur, focus trap +
 * retorno de foco. Reservado a lo que de verdad no cabe inline ni en un
 * panel lateral (`DESIGN.md:545`) — en esta sección, solo el confirm de
 * archivar un producto.
 */
function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
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
        aria-labelledby="modal-title"
        style={{ "--surface-bg": "var(--color-surface)" } as React.CSSProperties}
        className={
          "relative z-10 w-full max-w-md rounded-lg border border-border-strong bg-surface p-6 " +
          "text-foreground shadow-[var(--shadow-modal)]"
        }
      >
        <h2 id="modal-title" className="text-section-title text-foreground">
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
