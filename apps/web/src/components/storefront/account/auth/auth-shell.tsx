import Image from "next/image";
import type { ReactNode } from "react";

interface AuthShellProps {
  photo: { url: string; alt: string } | null;
  children: ReactNode;
}

/**
 * Acceso en página partida: el formulario a la izquierda sobre el fondo de la
 * tienda; a la derecha, la foto del hero a sangre (sin texto ni etiquetas
 * encima). En móvil queda solo el formulario.
 */
function AuthShell({ photo, children }: AuthShellProps) {
  return (
    <main className="grid min-h-[100dvh] pt-16 lg:grid-cols-2 xl:pt-20">
      <div className="flex items-start justify-center px-4 pt-10 pb-40 md:px-8 md:pt-16 lg:items-center lg:pt-10">
        <div className="w-full max-w-[26rem]">{children}</div>
      </div>
      <div className="relative hidden bg-blush lg:block">
        {photo ? <Image src={photo.url} alt={photo.alt} fill priority sizes="50vw" className="object-cover" /> : null}
      </div>
    </main>
  );
}

export { AuthShell };
