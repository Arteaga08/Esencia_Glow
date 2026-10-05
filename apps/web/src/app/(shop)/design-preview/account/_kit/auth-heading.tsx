const DEFAULT_HEADING = "text-page-title text-foreground md:text-display";

interface AuthHeadingProps {
  title: string;
  lead?: string;
  /** Voz tipográfica del título: cada propuesta pasa la suya. */
  headingClass?: string;
}

/** Título de la pantalla de acceso y, opcional, una línea de apoyo (máx. 2 renglones). */
function AuthHeading({ title, lead, headingClass = DEFAULT_HEADING }: AuthHeadingProps) {
  return (
    <header className="mb-7">
      <h1 className={headingClass}>{title}</h1>
      {lead ? <p className="mt-2 max-w-[44ch] text-body text-foreground/80">{lead}</p> : null}
    </header>
  );
}

export { AuthHeading, DEFAULT_HEADING };
