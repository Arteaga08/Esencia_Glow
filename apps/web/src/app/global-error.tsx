"use client";

import { useEffect } from "react";
import { fontVariables } from "./fonts";
import "./globals.css";

const BUTTON =
  "inline-flex min-h-12 cursor-pointer items-center justify-center rounded-md border border-foreground bg-surface px-7 py-3 " +
  "type-shop-cta text-foreground transition-colors duration-[var(--duration-base)] ease-out-quart hover:bg-primary " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * Último recurso: el error ocurrió en el layout raíz, así que esta página
 * reemplaza al documento completo y no puede apoyarse en el header, el footer
 * ni el API. Declara su propio <html>, fuentes y estilos; usa <a> y no Link
 * porque no hay garantía de que el router siga montado.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es" className={fontVariables}>
      <body>
        <main className="flex min-h-svh items-end bg-blush px-4 pb-14 md:px-8 md:pb-20 xl:px-12">
          <div className="mx-auto w-full max-w-shell">
            <p className="mb-6 text-section-title text-foreground">Esencia Glow</p>
            <h1 className="max-w-3xl text-hero text-foreground">Algo salió mal de nuestro lado</h1>
            <p className="mt-4 max-w-[48ch] text-subtitle text-foreground/80">
              No pudimos cargar la tienda. Intenta de nuevo; si sigue igual, vuelve en unos minutos.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button type="button" onClick={() => retry()} className={BUTTON}>
                Reintentar
              </button>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- navegación completa a propósito: reinicia el estado tras una caída del layout raíz */}
              <a href="/" className={`${BUTTON} border-primary-action! hover:border-foreground!`}>
                Ir al inicio
              </a>
            </div>
            {error.digest ? (
              <p className="mt-6 font-mono text-label text-muted-foreground-strong">Código de referencia: {error.digest}</p>
            ) : null}
          </div>
        </main>
      </body>
    </html>
  );
}
