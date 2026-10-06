/** Título de la página de una sección de Mi cuenta (en móvil, debajo del enlace de regreso). */
function SectionTitle({ children }: { children: string }) {
  return <h1 className="mt-2 mb-8 text-page-title text-foreground md:text-display lg:mt-0">{children}</h1>;
}

export { SectionTitle };
