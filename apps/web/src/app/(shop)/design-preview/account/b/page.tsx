import { AccountSection } from "../_kit/account-section";
import { AuthContent } from "../_kit/auth-content";
import { getAccountData } from "../_kit/fixture";
import { hasActiveSubscription } from "../_kit/nav";
import { PreviewBar } from "../_kit/preview-bar";
import { readPreviewState, type SearchParams } from "../_kit/preview-state";
import { isAuthView } from "../_kit/types";
import { AccountShellB } from "./account-shell";
import { AuthShellB } from "./auth-shell";
import { HomeB } from "./home";

const BASE = "/design-preview/account/b";
// B usa la voz de "etiqueta de frasco" del storefront para los títulos.
const HEADING = "type-shop-section text-foreground";

/** Propuesta B: columna de bitácora para el acceso; Mi cuenta con pestañas y renglones con reglas. */
export default async function ProposalB({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const current = readPreviewState(await searchParams);
  const data = await getAccountData();
  const key = `${current.view}-${current.state ?? "base"}`;
  const { view, state } = current;

  return (
    <>
      {isAuthView(view) ? (
        <AuthShellB key={key}>
          <AuthContent view={view} state={state} base={BASE} email={data.user.email} headingClass={HEADING} />
        </AuthShellB>
      ) : (
        <AccountShellB key={key} view={view} base={BASE} data={data}>
          {view === "inicio" ? (
            <HomeB base={BASE} data={data} hasSubscription={hasActiveSubscription(view, state)} />
          ) : (
            <AccountSection view={view} state={state} base={BASE} tone="ruled" data={data} />
          )}
        </AccountShellB>
      )}
      <PreviewBar base={BASE} label="B" current={current} />
    </>
  );
}
