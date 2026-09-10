/**
 * Triage operativo de una orden, independiente de `OrderStatus` — nunca se
 * valida en la máquina de estados ni condiciona una acción; solo cambia
 * dónde ordena en la cola del panel (ver DASHBOARD_GUIDELINES.md §10).
 */
enum OrderPriority {
  NORMAL = "normal",
  HIGH = "high",
  URGENT = "urgent",
}

export { OrderPriority };
