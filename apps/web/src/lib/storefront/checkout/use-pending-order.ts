"use client";

import { useEffect, useState } from "react";
import { OrderStatus, type PublicOrder } from "@esencia-glow/shared";
import { accountRequest } from "../account-api";

type PendingOrderState = { status: "idle" | "loading" | "none" | "error" } | { status: "found"; order: PublicOrder };

/**
 * ¿La clienta dejó un pedido a medio pagar? Solo puede existir uno `pending` y
 * siempre es el más reciente, así que basta pedir el último pedido.
 */
function usePendingOrder(enabled: boolean, version = 0): PendingOrderState {
  // `null` = todavía no responde; el "cargando" se deriva, no se escribe desde el efecto.
  const [result, setResult] = useState<{ version: number; state: PendingOrderState } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    accountRequest<PublicOrder[]>("/api/v1/orders", { query: { limit: 1 }, redirectOnFailure: false })
      .then((response) => {
        if (cancelled) return;
        const latest = response.data[0];
        setResult({ version, state: latest && latest.status === OrderStatus.PENDING ? { status: "found", order: latest } : { status: "none" } });
      })
      .catch(() => {
        if (!cancelled) setResult({ version, state: { status: "error" } });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, version]);

  if (!enabled) return { status: "idle" };
  return result && result.version === version ? result.state : { status: "loading" };
}

export { usePendingOrder };
export type { PendingOrderState };
