"use client";

import { useEffect, useMemo, useState } from "react";
import type { PublicCartLine, ResolveCartLineInput } from "@esencia-glow/shared";
import { apiRequest } from "@/lib/api";
import { buildCartView, computeTotals, type CartLineView, type CartTotals } from "./cart-view";
import type { Cart } from "./cart-store";

type ResolveStatus = "loading" | "ready" | "error";

interface ResolvedCart {
  lines: CartLineView[];
  totals: CartTotals;
  status: ResolveStatus;
  retry: () => void;
}

interface Resolution {
  /** Identidad de las líneas para las que se pidió; si cambió, esto ya es viejo. */
  key: string;
  live: PublicCartLine[] | null;
  failed: boolean;
}

/**
 * Funde el carrito del navegador con el precio y la disponibilidad vivos de
 * `POST /cart/resolve`. Pide al activarse (panel abierto o página montada) y
 * cuando cambia QUÉ lleva, no cuando cambia una cantidad. Mientras llega la
 * respuesta, o si falla, pinta el snapshot guardado y el aviso lo da `status`.
 */
function useResolvedCart(cart: Cart, active: boolean): ResolvedCart {
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [attempt, setAttempt] = useState(0);

  const identities = useMemo<ResolveCartLineInput[]>(
    () => cart.map(({ itemType, itemId }) => ({ itemType, itemId })),
    [cart],
  );
  const key = useMemo(() => identities.map((line) => `${line.itemType}:${line.itemId}`).join("|"), [identities]);

  useEffect(() => {
    if (!active || key === "") return;
    let cancelled = false;

    apiRequest<PublicCartLine[]>("/api/v1/cart/resolve", { method: "POST", body: { lines: identities } })
      .then((response) => {
        if (!cancelled) setResolution({ key, live: response.data, failed: false });
      })
      .catch(() => {
        if (!cancelled) setResolution({ key, live: null, failed: true });
      });

    return () => {
      cancelled = true;
    };
    // `identities` se deriva de `key`: depender de ambos repetiría la petición por nada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key, attempt]);

  const current = resolution && resolution.key === key ? resolution : null;
  const lines = useMemo(() => buildCartView(cart, current?.live ?? null), [cart, current]);
  const totals = useMemo(() => computeTotals(lines, null), [lines]);
  const status: ResolveStatus = key === "" ? "ready" : !current ? "loading" : current.failed ? "error" : "ready";

  return { lines, totals, status, retry: () => {
      // Se descarta la respuesta fallida para que el aviso vuelva a "Actualizando…" mientras reintenta.
      setResolution(null);
      setAttempt((value) => value + 1);
    },
  };
}

export { useResolvedCart };
export type { ResolvedCart, ResolveStatus };
