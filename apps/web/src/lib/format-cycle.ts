/** "Octubre 2026" — nombre de un ciclo de suscripción (año + mes 1-12), con
 * la primera letra en mayúscula porque siempre aparece como etiqueta suelta
 * (encabezado de fila, título de celda), nunca a mitad de una oración. */
function formatCycle(cycleYear: number, cycleMonth: number): string {
  const label = new Date(cycleYear, cycleMonth - 1, 1).toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1).replace(" de ", " ");
}

/** Mes siguiente a un ciclo dado, respetando el cambio de año. */
function nextCycle(
  cycleYear: number,
  cycleMonth: number,
): { cycleYear: number; cycleMonth: number } {
  return cycleMonth === 12
    ? { cycleYear: cycleYear + 1, cycleMonth: 1 }
    : { cycleYear, cycleMonth: cycleMonth + 1 };
}

/** Ciclo en curso según el reloj del navegador — solo para ordenar/resaltar
 * en el panel, nunca para decidir nada que el backend valide. */
function currentCycle(now: Date = new Date()): { cycleYear: number; cycleMonth: number } {
  return { cycleYear: now.getFullYear(), cycleMonth: now.getMonth() + 1 };
}

export { formatCycle, nextCycle, currentCycle };
