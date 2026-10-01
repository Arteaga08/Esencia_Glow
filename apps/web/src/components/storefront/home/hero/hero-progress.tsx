/**
 * Barra de paginación del hero: una línea de 1px con un tramo blanco que
 * marca el slide activo y se va llenando con el tiempo del autoplay. El
 * llenado es una animación CSS; su fin (`onAnimationEnd`) es lo que avanza
 * el carrusel, así la barra y el cambio nunca se desfasan. Con
 * `prefers-reduced-motion` no hay animación: el tramo queda lleno y fijo.
 */
function HeroProgress({
  count,
  index,
  paused,
  labels,
  onSelect,
  onFinish,
}: {
  count: number;
  index: number;
  paused: boolean;
  labels: string[];
  onSelect: (next: number) => void;
  onFinish: () => void;
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 mx-auto max-w-shell px-4 pb-6 md:px-8 md:pb-8 xl:px-12">
      <div className="relative h-px bg-white/40">
        <span
          key={index}
          aria-hidden="true"
          onAnimationEnd={onFinish}
          style={{
            left: `${(index / count) * 100}%`,
            width: `${100 / count}%`,
            animationPlayState: paused ? "paused" : "running",
          }}
          className="absolute inset-y-0 origin-left animate-hero-progress bg-white motion-reduce:animate-none"
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
