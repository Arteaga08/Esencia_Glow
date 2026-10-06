import Link from "next/link";
import { LinkBreak } from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";
import { StatusPanel } from "../shared/status-panel";
import { CTA_SECONDARY } from "../shared/styles";

interface InvalidLinkPanelProps {
  /** Qué hacer ahora: pedir otro enlace de verificación o de contraseña. */
  children: ReactNode;
  actions: ReactNode;
}

/** Enlace del correo vencido, ya usado o roto: el mismo mensaje en verificar y en restablecer. */
function InvalidLinkPanel({ children, actions }: InvalidLinkPanelProps) {
  return (
    <StatusPanel
      icon={LinkBreak}
      tone="warning"
      role="alert"
      title="Este enlace ya no sirve"
      actions={
        <>
          {actions}
          <Link href="/ingresar" className={CTA_SECONDARY}>
            Ingresar
          </Link>
        </>
      }
    >
      {children}
    </StatusPanel>
  );
}

export { InvalidLinkPanel };
