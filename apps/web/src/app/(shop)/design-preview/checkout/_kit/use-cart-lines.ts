"use client";

import { useState } from "react";
import type { PreviewLine } from "./preview-types";

/** Presentación para el estado `?estado=agotado`: la segunda línea se agotó. */
const SOLD_OUT_INDEX = 1;

function applyState(lines: PreviewLine[], state: string | null): PreviewLine[] {
  if (state === "vacio") return [];
  if (state === "agotado") {
    return lines.map((line, index) => (index === SOLD_OUT_INDEX ? { ...line, available: false } : line));
  }
  return lines;
}

/**
 * Estado local del carrito de la vista previa: cambiar cantidades y quitar
 * renglones funciona de verdad para sentir el flujo, pero nada se guarda.
 * Quien lo use debe llevar `key` con el estado de la URL para que se reinicie.
 */
function useCartLines(initial: PreviewLine[], state: string | null) {
  const [lines, setLines] = useState(() => applyState(initial, state));

  function setQuantity(id: string, quantity: number) {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, quantity } : line)));
  }

  function remove(id: string) {
    setLines((current) => current.filter((line) => line.id !== id));
  }

  return { lines, setQuantity, remove };
}

export { useCartLines };
