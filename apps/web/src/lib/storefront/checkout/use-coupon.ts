"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CartLineInput, CouponPreview } from "@esencia-glow/shared";
import { linesKeyOf } from "./order-lines";
import { validateCoupon } from "./coupon";
import { normalizeCouponInput } from "./coupon-errors";

interface UseCouponInput {
  /** Sin sesión no se puede validar: el campo no se ofrece. */
  enabled: boolean;
  lines: CartLineInput[];
  /** El API dijo que la sesión venció. */
  onSessionLost: () => void;
}

interface CouponState {
  input: string;
  applied: CouponPreview | null;
  error: string | null;
  pending: boolean;
}

const EMPTY: CouponState = { input: "", applied: null, error: null, pending: false };

/**
 * Cupón del checkout: lo que la clienta escribe, el descuento ya validado y el
 * error pegado a su campo. Solo guarda el CÓDIGO y la vista previa del
 * servidor; nunca calcula un descuento por su cuenta. Si el carrito cambia con
 * un cupón aplicado, se revalida en silencio (el descuento depende del
 * subtotal) y, si ya no aplica, se quita y se avisa en el campo.
 */
function useCoupon({ enabled, lines, onSessionLost }: UseCouponInput) {
  const [state, setState] = useState<CouponState>(EMPTY);
  // Una respuesta lenta no debe pisar a una más nueva (cambió el carrito o se quitó el cupón).
  const requestId = useRef(0);
  const linesKey = linesKeyOf(lines);
  const linesRef = useRef(lines);
  const onSessionLostRef = useRef(onSessionLost);
  // Antes del efecto de revalidación (los efectos corren en orden de declaración): así éste ya ve lo último.
  useEffect(() => {
    linesRef.current = lines;
    onSessionLostRef.current = onSessionLost;
  });

  const setInput = useCallback((input: string) => setState((current) => ({ ...current, input, error: null })), []);

  const apply = useCallback(async () => {
    const code = normalizeCouponInput(state.input);
    if (!code) {
      setState((current) => ({ ...current, error: "Escribe el código de tu cupón." }));
      return;
    }
    const id = ++requestId.current;
    setState((current) => ({ ...current, pending: true, error: null }));
    const result = await validateCoupon({ code, lines: linesRef.current });
    if (id !== requestId.current) return;

    if (result.ok) setState({ input: result.preview.code, applied: result.preview, error: null, pending: false });
    else {
      setState((current) => ({ ...current, pending: false, error: result.message }));
      if (result.unauthorized) onSessionLost();
    }
  }, [state.input, onSessionLost]);

  const remove = useCallback(() => {
    requestId.current += 1;
    setState(EMPTY);
  }, []);

  /** El servidor rechazó el cupón al crear el pedido: se quita y el motivo queda en el campo. */
  const reject = useCallback((message: string) => {
    requestId.current += 1;
    setState((current) => ({ input: current.applied?.code ?? current.input, applied: null, error: message, pending: false }));
  }, []);

  const appliedCode = state.applied?.code;
  useEffect(() => {
    // Con el carrito vacío (el pedido se acaba de crear y gastó el carrito) no hay nada que revalidar.
    if (!enabled || !appliedCode || linesRef.current.length === 0) return;
    const id = ++requestId.current;
    void validateCoupon({ code: appliedCode, lines: linesRef.current }).then((result) => {
      if (id !== requestId.current) return;
      if (result.ok) setState((current) => ({ ...current, applied: result.preview }));
      else if (result.rejected) setState({ input: appliedCode, applied: null, error: result.message, pending: false });
      else if (result.unauthorized) onSessionLostRef.current();
      // Cualquier otro fallo (red, 5xx, límite de intentos) no dice nada del cupón: se conserva el que ya estaba aplicado.
    });
    // Solo cuando cambia QUÉ lleva el carrito: aplicar o quitar el cupón no debe revalidarse a sí mismo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey, enabled]);

  return { ...state, setInput, apply, remove, reject };
}

export { useCoupon };
export type { CouponState };
