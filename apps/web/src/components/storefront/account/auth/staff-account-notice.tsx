import Link from "next/link";
import { UsersThree } from "@phosphor-icons/react/ssr";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-routes";
import { CTA_PRIMARY, TEXT_LINK } from "../shared/styles";
import { StatusPanel } from "../shared/status-panel";

/**
 * Una cuenta del equipo intentó entrar por el acceso de la tienda. No se le da
 * sesión de clienta ni se le pide el código aquí: se le indica el acceso del panel.
 */
function StaffAccountNotice({ onBack }: { onBack: () => void }) {
  return (
    <StatusPanel
      icon={UsersThree}
      tone="warning"
      title="Esta cuenta es del equipo"
      actions={
        <>
          <Link href={ADMIN_LOGIN_PATH} className={CTA_PRIMARY}>
            Ir al panel
          </Link>
          <button type="button" onClick={onBack} className={TEXT_LINK}>
            Usar otra cuenta
          </button>
        </>
      }
    >
      <p>Las cuentas del equipo entran desde el acceso del panel, con su verificación en dos pasos. Aquí solo entran las clientas.</p>
    </StatusPanel>
  );
}

export { StaffAccountNotice };
