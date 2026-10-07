/**
 * Código de referencia del error (el `digest` de Next). Es lo único del error
 * que se muestra: nunca el mensaje ni el stack, para no filtrar detalles.
 */
function StateReference({ digest, className = "" }: { digest?: string; className?: string }) {
  if (!digest) return null;
  return <p className={`font-mono text-label text-muted-foreground-strong ${className}`}>Código de referencia: {digest}</p>;
}

export { StateReference };
