import {
  CalendarBlank,
  FolderSimple,
  GearSix,
  Gift,
  House,
  ListChecks,
  Package,
  SealCheck,
  SquaresFour,
  Stack,
  Tag,
  Ticket,
  Truck,
  Users,
  UsersThree,
  type Icon,
} from "@phosphor-icons/react";
import { ADMIN_ROUTES } from "@/lib/admin-routes";

interface NavItem {
  label: string;
  href: string;
  icon: Icon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Rutas de las 8 secciones del Milestone 2 (2.1–2.8, ver el plan maestro).
 * Cada una existe hoy como stub honesto — no da 404, dice en qué sesión se
 * construye (DESIGN.md §5, Shell).
 */
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operación",
    items: [
      { label: "Resumen", href: ADMIN_ROUTES.home, icon: SquaresFour },
      { label: "Pedidos", href: ADMIN_ROUTES.orders, icon: Package },
      { label: "Envíos", href: ADMIN_ROUTES.shipments, icon: Truck },
      { label: "Inventario", href: ADMIN_ROUTES.inventory, icon: Stack },
      { label: "Contenido del home", href: ADMIN_ROUTES.homeContent, icon: House },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { label: "Productos", href: ADMIN_ROUTES.products, icon: Tag },
      { label: "Categorías", href: ADMIN_ROUTES.categories, icon: FolderSimple },
      { label: "Paquetes", href: ADMIN_ROUTES.bundles, icon: Gift },
      { label: "Badges", href: ADMIN_ROUTES.badges, icon: SealCheck },
      { label: "Cupones", href: ADMIN_ROUTES.coupons, icon: Ticket },
    ],
  },
  {
    label: "Suscripciones",
    items: [
      { label: "Planes", href: ADMIN_ROUTES.plans, icon: ListChecks },
      { label: "Ediciones", href: ADMIN_ROUTES.editions, icon: CalendarBlank },
      { label: "Cuentas", href: ADMIN_ROUTES.accounts, icon: UsersThree },
    ],
  },
  {
    label: "Personas",
    items: [{ label: "Clientes", href: ADMIN_ROUTES.customers, icon: Users }],
  },
];

/**
 * Anclado al fondo del sidebar, separado por spacing.8 (DESIGN.md §5, Shell).
 * Solo configuración del sistema; el contenido editorial del home vive en Operación.
 */
const MANAGEMENT_GROUP: NavGroup = {
  label: "Gestión",
  items: [{ label: "Ajustes", href: ADMIN_ROUTES.settings, icon: GearSix }],
};

export type { NavGroup, NavItem };
export { NAV_GROUPS, MANAGEMENT_GROUP };
