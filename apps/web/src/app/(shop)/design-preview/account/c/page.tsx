import Link from "next/link";
import { CaretLeft } from "@phosphor-icons/react/ssr";
import { AccountSection } from "../_kit/account-section";
import { AuthContent } from "../_kit/auth-content";
import { getAccountData } from "../_kit/fixture";
import { ACCOUNT_NAV, hasActiveSubscription } from "../_kit/nav";
import { PreviewBar } from "../_kit/preview-bar";
import { previewHref, readPreviewState, type SearchParams } from "../_kit/preview-state";
import { TEXT_LINK } from "../_kit/styles";
import { isAuthView } from "../_kit/types";
import { AuthShellC } from "./auth-shell";
import { HomeC } from "./home";

const BASE = "/design-preview/account/c";
const HEADING = "text-page-title text-foreground";

/**
 * Propuesta C: acceso en una tarjeta con pestañas Entrar / Crear cuenta sobre
 * rosa suave; Mi cuenta como índice de renglones, cada sección en su pantalla
 * (una sola columna, pensada primero para el celular).
 */
export default async function ProposalC({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const current = readPreviewState(await searchParams);
  const data = await getAccountData();
  const key = `${current.view}-${current.state ?? "base"}`;
  const { view, state } = current;
  const section = ACCOUNT_NAV.find((item) => item.view === view);

  return (
    <>
      {isAuthView(view) ? (
        <AuthShellC key={key} view={view} base={BASE}>
          <AuthContent view={view} state={state} base={BASE} email={data.user.email} headingClass={HEADING} showSwitchLinks={false} />
        </AuthShellC>
      ) : (
        <main key={key} className="pt-16 pb-40 xl:pt-20">
          <div className="mx-auto max-w-2xl px-4 py-10 md:py-16">
            {view === "inicio" ? (
              <HomeC base={BASE} data={data} hasSubscription={hasActiveSubscription(view, state)} />
            ) : (
              <>
                <Link href={previewHref(BASE, "inicio")} className={`${TEXT_LINK} -ml-1 gap-1`}>
                  <CaretLeft size={16} aria-hidden="true" />
                  Mi cuenta
                </Link>
                <h1 className="mt-2 mb-6 text-page-title text-foreground">{section?.title}</h1>
                <AccountSection view={view} state={state} base={BASE} tone="plain" data={data} />
              </>
            )}
          </div>
        </main>
      )}
      <PreviewBar base={BASE} label="C" current={current} />
    </>
  );
}
