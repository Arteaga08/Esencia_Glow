"use client";

import { useRouter } from "next/navigation";

/** "Volver atrás" de la página 404: regresa a donde venía la visita. */
function BackButton({ className }: { className: string }) {
  const router = useRouter();

  return (
    <button type="button" onClick={() => router.back()} className={className}>
      Volver atrás
    </button>
  );
}

export { BackButton };
