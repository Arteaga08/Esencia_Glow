"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { Button } from "./button";

interface ErrorStateProps {
  title?: string;
  description: string;
  onRetry?: () => void;
}

/**
 * DESIGN.md §5 Page States, Error: mismo layout que Vacío, ícono
 * `WarningCircle` en `destructive-action`, botón secundario "Reintentar"
 * cuando la operación es reintentable.
 */
function ErrorState({ title = "Algo salió mal", description, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <WarningCircle size={32} weight="regular" className="text-destructive-action" aria-hidden="true" />
      <p className="text-subtitle text-foreground">{title}</p>
      <p className="max-w-[42ch] text-body-sm text-muted-foreground-strong">{description}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-2" onClick={onRetry}>
          Reintentar
        </Button>
      ) : null}
    </div>
  );
}

export type { ErrorStateProps };
export { ErrorState };
