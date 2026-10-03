/**
 * Nombre de la marca a todo el ancho. Es texto SVG cuyo viewBox se calculó con
 * la métrica real de Schibsted Grotesk 600 (a 200px mide 1528 de ancho y 143 de
 * altura de mayúscula): a 130px el texto llena 1000 unidades sin deformarse, y
 * el margen de arriba deja respirar el sobrepaso de las letras redondas. Si
 * cambia la fuente, hay que remedir. Decorativo: el nombre accesible ya está en
 * el logo del header, por eso va oculto a lectores de pantalla.
 */
function FooterWordmark({ className = "text-foreground" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1000 100"
      aria-hidden="true"
      focusable="false"
      className={`block h-auto w-full select-none overflow-visible ${className}`}
    >
      <text
        x="-9.5"
        y="97"
        fill="currentColor"
        style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 130 }}
      >
        ESENCIA GLOW
      </text>
    </svg>
  );
}

export { FooterWordmark };
