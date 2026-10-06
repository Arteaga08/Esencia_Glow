"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CartLineInput, PublicShippingAddress, PublicShippingQuote } from "@esencia-glow/shared";
import { accountRequest } from "../account-api";
import { classifyError } from "../auth-errors";
import { classifyQuoteFailure, type QuoteFailureState } from "./quote-failures";

type QuoteState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; quote: PublicShippingQuote }
  /** La vigencia real de la cotización (`expiresAt`) ya pasó. */
  | { status: "expired" }
  | QuoteFailureState;

/**
 * Cotización de envío en vivo (`POST /shipping/quotes`, exige sesión). Una
 * respuesta que llega después de que cambió la dirección o el carrito se
 * descarta (`seq`). Al llegar `expiresAt` la cotización pasa sola a `expired`:
 * el servidor ya no la aceptaría y es mejor decirlo antes de pagar.
 */
function useShippingQuote() {
  const [state, setState] = useState<QuoteState>({ status: "idle" });
  const seq = useRef(0);

  const request = useCallback(async (destination: PublicShippingAddress, lines: CartLineInput[]) => {
    const current = ++seq.current;
    setState({ status: "loading" });
    try {
      const response = await accountRequest<PublicShippingQuote>("/api/v1/shipping/quotes", {
        method: "POST",
        body: { destination, lines },
        redirectOnFailure: false,
      });
      if (current === seq.current) setState({ status: "ready", quote: response.data });
    } catch (caught) {
      if (current === seq.current) setState(classifyQuoteFailure(classifyError(caught)));
    }
  }, []);

  const reset = useCallback(() => {
    seq.current += 1;
    setState({ status: "idle" });
  }, []);

  useEffect(() => {
    if (state.status !== "ready") return;
    const remaining = new Date(state.quote.expiresAt).getTime() - Date.now();
    const timer = window.setTimeout(() => setState({ status: "expired" }), Math.max(remaining, 0));
    return () => window.clearTimeout(timer);
  }, [state]);

  return { state, request, reset };
}

export { useShippingQuote };
export type { QuoteState };
