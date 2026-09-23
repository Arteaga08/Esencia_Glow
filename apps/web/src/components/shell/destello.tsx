import { StarFour, type IconProps } from "@phosphor-icons/react";

/**
 * Destello de marca (DESIGN.md §5, componente de firma). Única excepción a
 * "los íconos nunca llevan color propio" — es un activo decorativo, no un
 * ícono funcional. Un máximo de uno por vista; su lugar en el dashboard es
 * solo el wordmark del sidebar/login.
 */
function Destello(props: Omit<IconProps, "color">) {
  return <StarFour weight="fill" className="text-accent-foreground-strong" aria-hidden="true" {...props} />;
}

export { Destello };
