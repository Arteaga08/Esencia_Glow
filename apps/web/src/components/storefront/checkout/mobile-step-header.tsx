import { CaretLeft } from "@phosphor-icons/react/ssr";
import { SCREEN_ORDER, type MobileScreen } from "@/lib/storefront/checkout/checkout-machine";
import { LABEL, TEXT_LINK } from "../cart/cta-styles";

const TITLES: Record<MobileScreen, string> = {
  account: "Cuenta",
  address: "Dirección de envío",
  rates: "Paquetería",
  payment: "Pago",
};

interface MobileStepHeaderProps {
  screen: MobileScreen;
  /** Texto y acción para volver a la pantalla anterior; sin ellos no hay "volver". */
  back?: { label: string; onClick: () => void };
}

/**
 * Encabezado de cada pantalla del checkout en móvil ("Paso 2 de 4"). Es también el
 * destino del scroll y del foco cuando cambia el paso (ver `useStepFocus`).
 */
function MobileStepHeader({ screen, back }: MobileStepHeaderProps) {
  return (
    <div id="checkout-mobile-step" tabIndex={-1} className="scroll-mt-20 border-t border-border-strong pt-6 outline-none lg:hidden">
      {back ? (
        <button type="button" onClick={back.onClick} className={`${TEXT_LINK} -ml-1 mb-2 gap-1`}>
          <CaretLeft size={14} aria-hidden="true" />
          {back.label}
        </button>
      ) : null}
      <p className={LABEL}>Paso {SCREEN_ORDER[screen] + 1} de 4</p>
      <h2 className="mt-1 text-section-title text-foreground">{TITLES[screen]}</h2>
    </div>
  );
}

export { MobileStepHeader };
