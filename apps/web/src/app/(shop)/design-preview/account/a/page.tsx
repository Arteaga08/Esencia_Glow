import { AccountSection } from "../_kit/account-section";
import { AuthContent } from "../_kit/auth-content";
import { getAccountData } from "../_kit/fixture";
import { hasActiveSubscription } from "../_kit/nav";
import { PreviewBar } from "../_kit/preview-bar";
import { readPreviewState, type SearchParams } from "../_kit/preview-state";
import { isAuthView } from "../_kit/types";
import { AccountShellA } from "./account-shell";
import { AuthShellA } from "./auth-shell";
import { HomeA } from "./home";

const BASE = "/design-preview/account/a";

/** Propuesta A: acceso en página partida con foto; Mi cuenta con barra lateral y tarjetas de lectura. */
export default async function ProposalA({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const current = readPreviewState(await searchParams);
  const data = await getAccountData();
  // La key reinicia el estado de los formularios al saltar de vista o de estado.
  const key = `${current.view}-${current.state ?? "base"}`;
  const { view, state } = current;

  return (
    <>
      {isAuthView(view) ? (
        <AuthShellA key={key} photo={data.authPhoto}>
          <AuthContent view={view} state={state} base={BASE} email={data.user.email} />
        </AuthShellA>
      ) : (
        <AccountShellA key={key} view={view} base={BASE} data={data}>
          {view === "inicio" ? (
            <HomeA base={BASE} data={data} hasSubscription={hasActiveSubscription(view, state)} />
          ) : (
            <AccountSection view={view} state={state} base={BASE} tone="card" data={data} />
          )}
        </AccountShellA>
      )}
      <PreviewBar base={BASE} label="A" current={current} />
    </>
  );
}
