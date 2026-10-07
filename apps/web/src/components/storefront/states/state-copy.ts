type StateKind = "not-found" | "error" | "coming-soon";

interface StateCopy {
  title: string;
  text: string;
}

const STATE_COPY: Record<StateKind, StateCopy> = {
  "not-found": {
    title: "No encontramos esa página",
    text: "El enlace pudo cambiar o la página ya no está disponible. Vuelve al inicio y seguimos desde ahí.",
  },
  error: {
    title: "Algo salió mal de nuestro lado",
    text: "No pudimos cargar esta página. Intenta de nuevo; si sigue igual, vuelve en unos minutos.",
  },
  "coming-soon": {
    title: "Estamos armando tu caja",
    text: "La suscripción de Esencia Glow todavía no está disponible. La estamos preparando con mucho cuidado; vuelve pronto para conocerla.",
  },
};

export type { StateCopy, StateKind };
export { STATE_COPY };
