"use client";

import { CheckCircle, Info, WarningCircle, XCircle } from "@phosphor-icons/react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type ToastVariant = "success" | "error" | "info" | "warning";

interface ToastInput {
  variant: ToastVariant;
  title: string;
  description?: string;
}

interface ToastItem extends ToastInput {
  id: number;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// DESIGN.md §5 Toast: sin franja lateral de color — el estado se comunica
// con el ícono, nunca con el borde. success 4s / info 5s / warning 6s / error
// no se autodescarta (requiere cierre explícito del operador).
const VARIANT_ICON: Record<ToastVariant, ReactNode> = {
  success: <CheckCircle size={20} weight="regular" className="text-secondary-foreground" />,
  info: <Info size={20} weight="regular" className="text-foreground" />,
  warning: <WarningCircle size={20} weight="regular" className="text-accent-foreground-strong" />,
  error: <XCircle size={20} weight="regular" className="text-destructive-action" />,
};

const AUTO_DISMISS_MS: Record<ToastVariant, number | null> = {
  success: 4000,
  info: 5000,
  warning: 6000,
  error: null,
};

const MAX_VISIBLE_TOASTS = 3;

function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      setItems((current) => [...current, { ...input, id }].slice(-MAX_VISIBLE_TOASTS));

      const autoDismissMs = AUTO_DISMISS_MS[input.variant];
      if (autoDismissMs !== null) {
        setTimeout(() => dismiss(id), autoDismissMs);
      }
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="fixed top-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-3 rounded-md border border-border-strong bg-surface p-4 shadow-modal"
          >
            {VARIANT_ICON[item.variant]}
            <div className="flex-1">
              <p className="text-body font-medium text-foreground">{item.title}</p>
              {item.description ? (
                <p className="mt-1 text-body-sm text-muted-foreground-strong">{item.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="Cerrar notificación"
              className="text-muted-foreground hover:text-foreground"
            >
              <XCircle size={16} weight="regular" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast debe usarse dentro de <ToastProvider>.");
  }
  return context;
}

export type { ToastInput, ToastVariant };
export { ToastProvider, useToast };
