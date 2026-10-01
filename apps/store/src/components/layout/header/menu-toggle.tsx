/**
 * Botón hamburguesa que se transforma en X. Solo anima `transform` y
 * `opacity` (nunca propiedades de layout): las barras de arriba y abajo
 * convergen al centro y giran, la del medio se desvanece.
 */
function MenuToggle({
  open,
  controls,
  onToggle,
}: {
  open: boolean;
  controls: string;
  onToggle: () => void;
}) {
  const bar =
    "absolute left-0 h-0.5 w-full rounded-full bg-current transition-[transform,opacity] duration-[var(--duration-slow)] ease-out-quart motion-reduce:transition-none";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      aria-label={open ? "Cerrar menú" : "Abrir menú"}
      className="inline-flex size-11 items-center justify-center rounded-full text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring xl:hidden"
    >
      <span className="relative block h-4 w-6" aria-hidden="true">
        <span className={`${bar} top-0 ${open ? "translate-y-[7px] rotate-45" : ""}`} />
        <span className={`${bar} top-[7px] ${open ? "scale-x-0 opacity-0" : ""}`} />
        <span className={`${bar} top-[14px] ${open ? "-translate-y-[7px] -rotate-45" : ""}`} />
      </span>
    </button>
  );
}

export { MenuToggle };
