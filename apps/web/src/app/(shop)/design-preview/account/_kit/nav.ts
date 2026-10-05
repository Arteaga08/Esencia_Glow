import type { Icon } from "@phosphor-icons/react";
import { ArrowsClockwise, Heart, MapPin, Package, Receipt, UserCircle } from "@phosphor-icons/react/ssr";
import { formatCompactDate } from "./dates";
import type { AccountData } from "./fixture";
import type { AccountView } from "./types";

/**
 * Única fuente de las secciones de Mi cuenta: alimenta la barra lateral, las
 * pestañas, la rejilla móvil y el índice de renglones. Agregar una sección es
 * una línea aquí y su vista en `account-section.tsx`.
 */
interface AccountNavItem {
  view: Exclude<AccountView, "inicio">;
  /** Texto corto de la navegación. */
  label: string;
  /** Título de la página de la sección. */
  title: string;
  icon: Icon;
}

const ACCOUNT_NAV: AccountNavItem[] = [
  { view: "suscripcion", label: "Mi suscripción", title: "Mi suscripción", icon: ArrowsClockwise },
  { view: "pedidos", label: "Mis pedidos", title: "Mis pedidos", icon: Package },
  { view: "direcciones", label: "Direcciones", title: "Mis direcciones", icon: MapPin },
  { view: "perfil", label: "Perfil", title: "Perfil y contraseña", icon: UserCircle },
  { view: "facturacion", label: "Facturación", title: "Datos de facturación", icon: Receipt },
  { view: "guardados", label: "Guardados", title: "Guardados", icon: Heart },
];

/** Una línea que resume el estado de cada sección (índice y rejilla móvil). */
function sectionSummary(view: AccountNavItem["view"], data: AccountData, hasSubscription: boolean): string {
  switch (view) {
    case "suscripcion":
      return hasSubscription ? `Activa. Próximo cobro el ${formatCompactDate(data.subscription.nextChargeAt)}` : "Aún no tienes una caja";
    case "pedidos": {
      const pending = data.orders.filter((order) => order.status === "pending").length;
      return `${data.orders.length} pedidos${pending > 0 ? `, ${pending} por pagar` : ""}`;
    }
    case "direcciones":
      return "2 direcciones, una principal";
    case "perfil":
      return data.user.email;
    case "facturacion":
      return "Sin datos fiscales";
    case "guardados":
      return `${data.saved.length} productos`;
  }
}

/** Primer nombre para el saludo ("María" de "María Fernanda"). */
function greetingName(data: AccountData): string {
  return data.user.firstName.split(" ")[0] ?? data.user.firstName;
}

/** Las vistas previas "sin suscripción" apagan la caja en el inicio y en su sección. */
function hasActiveSubscription(view: AccountView, state: string | null): boolean {
  if (view === "inicio") return state !== "sinsuscripcion";
  if (view === "suscripcion") return state !== "sin";
  return true;
}

export { ACCOUNT_NAV, sectionSummary, greetingName, hasActiveSubscription };
export type { AccountNavItem };
