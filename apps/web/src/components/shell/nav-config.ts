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
  Truck,
  Users,
  UsersThree,
  type Icon,
} from "@phosphor-icons/react";

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
      { label: "Resumen", href: "/", icon: SquaresFour },
      { label: "Pedidos", href: "/orders", icon: Package },
      { label: "Envíos", href: "/shipments", icon: Truck },
      { label: "Inventario", href: "/inventory", icon: Stack },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { label: "Productos", href: "/products", icon: Tag },
      { label: "Categorías", href: "/categories", icon: FolderSimple },
      { label: "Paquetes", href: "/bundles", icon: Gift },
      { label: "Badges", href: "/badges", icon: SealCheck },
    ],
  },
  {
    label: "Suscripciones",
    items: [
      { label: "Cuentas", href: "/subscriptions/accounts", icon: UsersThree },
      { label: "Ediciones", href: "/subscriptions/editions", icon: CalendarBlank },
      { label: "Planes", href: "/subscriptions/plans", icon: ListChecks },
    ],
  },
  {
    label: "Personas",
    items: [{ label: "Clientes", href: "/customers", icon: Users }],
  },
];

/** Anclado al fondo del sidebar, separado por spacing.8 (DESIGN.md §5, Shell). */
const MANAGEMENT_GROUP: NavGroup = {
  label: "Gestión",
  items: [
    { label: "Contenido del home", href: "/home-content", icon: House },
    { label: "Ajustes", href: "/settings", icon: GearSix },
  ],
};

export type { NavGroup, NavItem };
export { NAV_GROUPS, MANAGEMENT_GROUP };
