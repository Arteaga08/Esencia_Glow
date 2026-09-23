"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

// DESIGN.md §5 Buttons: forma 8px, nunca rounded-full salvo badges/avatares.
// El hover es siempre un cambio de color, jamás una elevación (Regla de lo
// que Flota) — por eso ninguna variante aquí lleva shadow.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-primary-action text-primary-foreground hover:bg-[oklch(0.51_0.0851_6.1876)] " +
    "disabled:bg-muted disabled:text-muted-foreground",
  secondary:
    "bg-surface text-foreground border border-border-strong hover:border-foreground " +
    "hover:bg-muted/40 disabled:border-border disabled:text-muted-foreground disabled:bg-transparent",
  ghost:
    "bg-transparent text-foreground hover:bg-muted disabled:text-muted-foreground",
  destructive:
    "bg-destructive-action text-destructive-foreground hover:bg-[oklch(0.51_0.1404_16.0328)] " +
    "disabled:bg-muted disabled:text-muted-foreground",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "text-body-sm px-3 py-1.5",
  md: "text-body px-4 py-2.5",
};

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading}
      className={
        "relative inline-flex items-center justify-center gap-2 rounded-md " +
        "font-sans transition-colors duration-[var(--duration-fast)] ease-out-quart " +
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
        "focus-visible:outline-ring disabled:cursor-not-allowed " +
        `${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`
      }
    >
      {/* El label queda invisible (no `hidden`) para conservar el ancho del
          botón en reposo — evita el salto de layout que prohíbe DESIGN.md §5. */}
      <span className={loading ? "invisible" : ""}>{children}</span>
      {loading ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </span>
      ) : null}
    </button>
  );
}

export type { ButtonProps, ButtonVariant, ButtonSize };
export { Button };
