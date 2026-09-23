// DESIGN.md §5 Page States, Carga: bloques `muted` con radio equivalente al
// contenido real, opacidad 0.6↔1 en 1.4s — nunca un spinner de página
// completa salvo la primera carga de sesión.
function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-skeleton rounded-md bg-muted ${className}`} />;
}

export { Skeleton };
