import { HourglassMedium } from "@phosphor-icons/react/ssr";
import { EmptyState } from "../ui/empty-state";

/**
 * Stub honesto para las rutas del sidebar que aún no tienen sección (2.2–2.8
 * las llenan una por una, ver el plan maestro). Un ítem de navegación que da
 * 404 es peor que uno que explica dónde está parado.
 */
function SectionStub({ milestone }: { milestone: string }) {
  return (
    <EmptyState
      icon={HourglassMedium}
      title="Esta sección todavía no existe"
      description={`Se construye en el Milestone ${milestone}, sección por sección, según el plan de Esencia Glow.`}
    />
  );
}

export { SectionStub };
