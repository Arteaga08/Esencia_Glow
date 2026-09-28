/**
 * Criterio del ranking de mejores clientes (Milestone 2.6.1). El otro
 * criterio queda como desempate: por monto desempata con pedidos y
 * viceversa.
 */
enum TopCustomersSort {
  SPENT = "spent",
  ORDERS = "orders",
}

export { TopCustomersSort };
