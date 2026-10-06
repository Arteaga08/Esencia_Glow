"use client";

import { useSyncExternalStore } from "react";

/**
 * Estado abierto/cerrado del panel lateral del carrito. Vive en memoria (no se
 * guarda): lo abre el botón de la bolsa y también cualquier "Agregar" de la
 * tienda, por eso es un store global y no estado del header.
 */
const listeners = new Set<() => void>();
let isOpen = false;

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function setOpen(next: boolean): void {
  if (isOpen === next) return;
  isOpen = next;
  listeners.forEach((listener) => listener());
}

function openCartPanel(): void {
  setOpen(true);
}

function closeCartPanel(): void {
  setOpen(false);
}

function useCartPanelOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isOpen,
    () => false,
  );
}

export { openCartPanel, closeCartPanel, useCartPanelOpen };
