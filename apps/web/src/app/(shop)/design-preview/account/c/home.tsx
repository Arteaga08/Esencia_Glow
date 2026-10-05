import Link from "next/link";
import { CaretRight, SignOut } from "@phosphor-icons/react/ssr";
import { Badge } from "@/components/ui/badge";
import type { AccountData } from "../_kit/fixture";
import { ACCOUNT_NAV, greetingName, sectionSummary } from "../_kit/nav";
import { previewHref } from "../_kit/preview-state";
import { FOCUS } from "../_kit/styles";

interface HomeCProps {
  base: string;
  data: AccountData;
  hasSubscription: boolean;
}

const ROW = `-mx-2 flex min-h-20 items-center gap-4 rounded-md border-b border-border px-2 py-4 transition-colors duration-[var(--duration-fast)] hover:bg-muted/60 ${FOCUS}`;

/**
 * Inicio de Mi cuenta en C: un índice de renglones grandes (pensado primero
 * para el celular). Cada renglón dice cómo está esa sección; tocar uno abre su
 * propia pantalla.
 */
function HomeC({ base, data, hasSubscription }: HomeCProps) {
  return (
    <div>
      <h1 className="text-page-title text-foreground">Hola, {greetingName(data)}</h1>
      <p className="mt-1 text-body text-foreground/80">{data.user.email}</p>

      <nav aria-label="Secciones de Mi cuenta" className="mt-8">
        <ul className="flex flex-col border-t border-border">
          {ACCOUNT_NAV.map((item) => (
            <li key={item.view}>
              <Link href={previewHref(base, item.view)} className={ROW}>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                  <item.icon size={22} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-subtitle text-foreground">{item.label}</span>
                  <span className="block truncate text-body-sm text-muted-foreground-strong">{sectionSummary(item.view, data, hasSubscription)}</span>
                </span>
                {item.view === "suscripcion" && hasSubscription ? <Badge color="success">Activa</Badge> : null}
                <CaretRight size={18} className="shrink-0 text-muted-foreground-strong" aria-hidden="true" />
              </Link>
            </li>
          ))}
          <li>
            <Link href={previewHref(base, "ingresar")} className={ROW}>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground-strong">
                <SignOut size={22} aria-hidden="true" />
              </span>
              <span className="flex-1 text-subtitle text-muted-foreground-strong">Cerrar sesión</span>
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}

export { HomeC };
