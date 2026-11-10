import Image from "next/image";

/**
 * Logo de la marca en el footer (mismo PNG dorado del header). El dorado se
 * lee bien sobre el fondo tinta. Decorativo: el nombre accesible ya está en el
 * logo del header.
 */
function FooterLogo() {
  return (
    <Image
      src="/brand/logo.png"
      alt=""
      width={1050}
      height={627}
      sizes="(min-width: 1024px) 112px, 80px"
      className="block h-auto w-20 shrink-0 select-none lg:w-28"
    />
  );
}

export { FooterLogo };
