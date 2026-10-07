import type { AdminCustomerListItem, AdminOrder } from "@esencia-glow/shared";
import { ADMIN_ROUTES } from "@/lib/admin-routes";
import type { AdminProduct } from "@/lib/types/admin-catalog";
import type { GlobalSearchResults } from "./use-global-search";

type SearchItem =
  | { kind: "order"; id: string; href: string; order: AdminOrder }
  | { kind: "customer"; id: string; href: string; customer: AdminCustomerListItem }
  | { kind: "product"; id: string; href: string; product: AdminProduct };

/**
 * Lista plana de lo que se puede abrir, en el orden en que se pinta (pedidos,
 * clientes, productos). Es la que recorren las flechas del teclado.
 */
function flattenResults(results: GlobalSearchResults): SearchItem[] {
  return [
    ...results.orders.items.map((order): SearchItem => ({ kind: "order", id: `order-${order.id}`, href: ADMIN_ROUTES.order(order.id), order })),
    ...results.customers.items.map(
      (customer): SearchItem => ({ kind: "customer", id: `customer-${customer.id}`, href: ADMIN_ROUTES.customer(customer.id), customer }),
    ),
    ...results.products.items.map(
      (product): SearchItem => ({ kind: "product", id: `product-${product.id}`, href: ADMIN_ROUTES.product(product.id), product }),
    ),
  ];
}

export { flattenResults };
export type { SearchItem };
