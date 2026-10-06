import type { Icon } from "@phosphor-icons/react";
import { ArrowsClockwise, MapPin, Package, Receipt, Star, UserCircle } from "@phosphor-icons/react/ssr";

/**
 * Única fuente de las secciones de Mi cuenta: alimenta la barra lateral y la
 * rejilla de accesos del móvil. Agregar una sección es una línea aquí y su ruta.
 */
interface AccountNavItem {
  slug: string;
  href: string;
  /** Texto corto de la navegación. */
  label: string;
  /** Título de la página de la sección. */
  title: string;
  icon: Icon;
}

const ACCOUNT_HOME = "/mi-cuenta";

const ACCOUNT_NAV: AccountNavItem[] = [
  { slug: "suscripcion", href: `${ACCOUNT_HOME}/suscripcion`, label: "Mi suscripción", title: "Mi suscripción", icon: ArrowsClockwise },
  { slug: "pedidos", href: `${ACCOUNT_HOME}/pedidos`, label: "Mis pedidos", title: "Mis pedidos", icon: Package },
  { slug: "direcciones", href: `${ACCOUNT_HOME}/direcciones`, label: "Direcciones", title: "Mis direcciones", icon: MapPin },
  { slug: "perfil", href: `${ACCOUNT_HOME}/perfil`, label: "Perfil", title: "Perfil y contraseña", icon: UserCircle },
  { slug: "facturacion", href: `${ACCOUNT_HOME}/facturacion`, label: "Facturación", title: "Datos de facturación", icon: Receipt },
  { slug: "guardados", href: `${ACCOUNT_HOME}/guardados`, label: "Guardados", title: "Guardados", icon: Star },
];

export { ACCOUNT_HOME, ACCOUNT_NAV };
export type { AccountNavItem };
