import type { ReactNode } from "react";

/**
 * Propuesta B, acceso: una sola columna angosta sobre el fondo de la tienda,
 * sin foto ni tarjeta. Una regla de 1px arriba la ancla como una hoja de
 * bitácora; todo lo demás es tipografía y campos.
 */
function AuthShellB({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-[100dvh] pt-16 xl:pt-20">
      <div className="mx-auto w-full max-w-md px-4 pt-12 pb-40 md:pt-20">
        <div className="border-t border-foreground pt-8">{children}</div>
      </div>
    </main>
  );
}

export { AuthShellB };
