"use client";

import { Bell, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Skeleton } from "../../ui/skeleton";
import { usePendingAlerts } from "./use-pending-alerts";

/**
 * Campana de pendientes del panel: lo que hay que atender ahora, calculado del
 * estado actual (no es un historial). El contador no depende solo del color:
 * es un número y la etiqueta del botón lo dice completo.
 */
function AlertsBell() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { rows, total, failed, refresh } = usePendingAlerts();

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleToggle() {
    if (!open) refresh();
    setOpen((current) => !current);
  }

  const label = total > 0 ? `Pendientes, ${total} por atender` : "Pendientes";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        className="relative cursor-pointer rounded-md p-2 text-muted-foreground-strong hover:bg-muted hover:text-foreground"
      >
        <Bell size={20} weight="regular" aria-hidden="true" />
        {total > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-foreground px-1 font-mono text-label leading-4 text-background tabular-nums"
          >
            {total > 99 ? "99+" : total}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-md border border-border-strong bg-surface p-1 shadow-overlay"
          style={{ "--surface-bg": "var(--color-surface)" } as React.CSSProperties}
        >
          <p className="px-3 py-2 font-mono text-label uppercase text-muted-foreground-strong">Por atender</p>
          {rows === null && !failed ? (
            <div className="flex flex-col gap-2 px-3 pb-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-4/5" />
            </div>
          ) : rows === null ? (
            <div role="alert" className="px-3 pb-3 text-body text-muted-foreground-strong">
              <p>No pudimos cargar los pendientes.</p>
              <button type="button" onClick={refresh} className="mt-2 cursor-pointer text-foreground underline underline-offset-4">
                Reintentar
              </button>
            </div>
          ) : rows.length === 0 ? (
            <p className="px-3 pb-3 text-body text-muted-foreground-strong">Todo al día. No hay nada pendiente.</p>
          ) : (
            <ul>
              {rows.map((row) => (
                <li key={row.key}>
                  <Link
                    href={row.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-sm px-3 py-2 text-body text-foreground hover:bg-muted"
                  >
                    {row.tone === "critical" ? (
                      <WarningCircle size={16} weight="fill" aria-hidden="true" className="shrink-0 text-destructive-action" />
                    ) : (
                      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-primary-action" />
                    )}
                    <span className="min-w-0">{row.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {failed && rows !== null ? (
            <p role="status" className="px-3 pb-2 text-body-sm text-muted-foreground-strong">
              No se pudo actualizar; se muestra la última lista.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export { AlertsBell };
