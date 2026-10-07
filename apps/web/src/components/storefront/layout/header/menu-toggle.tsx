/**
 * Botón de menú de dos líneas que se cruzan en X, con recorrido corto para
 * que el cambio sea discreto. En Tailwind v4 `translate-*` y `rotate-*`
 * escriben las propiedades `translate` y `rotate` (no `transform`), así que
 * son esas las que se listan en la transición.
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
    "absolute left-0 top-1/2 h-[1.5px] w-full rounded-full bg-current transition-[translate,rotate] duration-[var(--duration-base)] ease-out-quart motion-reduce:transition-none";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      aria-label={open ? "Cerrar menú" : "Abrir menú"}
      className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring xl:hidden"
    >
      <span className="relative block h-4 w-6" aria-hidden="true">
        <span className={`${bar} ${open ? "rotate-45" : "-translate-y-[3.5px]"}`} />
        <span className={`${bar} ${open ? "-rotate-45" : "translate-y-[3.5px]"}`} />
      </span>
    </button>
  );
}

export { MenuToggle };
