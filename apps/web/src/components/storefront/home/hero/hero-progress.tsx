/**
 * Barra de paginación del hero (como Etude): una línea de 1px dividida en
 * tantos tramos como slides, con un tramo fijo que marca el activo (en tinta
 * en móvil, donde cae sobre el degradado claro del slide; blanco desde `md`,
 * sobre la foto).
 * No se llena con el tiempo: al cambiar de slide el tramo se desliza a su
 * nueva posición. El autoplay lo lleva `HeroCarousel`. Con
 * `prefers-reduced-motion` el tramo salta sin deslizarse.
 */
function HeroProgress({
  count,
  index,
  labels,
  onSelect,
}: {
  count: number;
  index: number;
  labels: string[];
  onSelect: (next: number) => void;
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 mx-auto max-w-shell px-4 pb-6 md:px-8 md:pb-8 xl:px-12">
      <div className="relative h-px bg-foreground/25 md:bg-white/40">
        <span
          aria-hidden="true"
          style={{ left: `${(index / count) * 100}%`, width: `${100 / count}%` }}
          className="absolute inset-y-0 bg-foreground transition-[left] duration-[var(--duration-slow)] ease-out-quart motion-reduce:transition-none md:bg-white"
        />
        <div className="absolute inset-x-0 -inset-y-3 flex">
          {labels.map((label, position) => (
            <button
              key={label + position}
              type="button"
              onClick={() => onSelect(position)}
              aria-label={`Ir a la diapositiva ${position + 1} de ${count}: ${label}`}
              aria-current={position === index}
              className="h-full flex-1 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export { HeroProgress };
