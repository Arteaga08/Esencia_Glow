import { LEGAL_DETAILS as D } from "@/lib/storefront/legal/legal-details";
import { LegalClause, LegalLink, LegalParagraph, LegalTable } from "./legal-blocks";

const COOKIE_ROWS = [
  ["Necesarias: sesión", "Mantener tu sesión iniciada y proteger tu cuenta", "Esencia Glow", "No; sin ellas no puedes entrar a tu cuenta ni comprar"],
  ["Necesarias: carrito y preferencias", "Recordar tu carrito y tus productos guardados en este navegador", "Esencia Glow", "No"],
];

/**
 * Política de cookies, versión WhatsApp: sin el renglón de Stripe (no se carga)
 * y sin analítica ni publicidad (la Tienda no las usa hoy).
 */
function CookiesContent() {
  return (
    <>
      <LegalClause number={1} title="Qué son">
        <LegalParagraph>
          Las cookies son pequeños archivos que el sitio guarda en tu navegador para recordar información entre una página y otra, por ejemplo que
          ya iniciaste sesión.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={2} title="Cuáles usamos">
        <LegalTable
          caption="Cookies que usa la Tienda"
          headers={["Tipo", "Para qué sirve", "Quién la pone", "Se puede desactivar"]}
          rows={COOKIE_ROWS}
        />
        <LegalParagraph>
          No usamos cookies de analítica ni de publicidad. WhatsApp se abre en su propia aplicación o página y no pone cookies desde la Tienda.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={3} title="Cómo controlarlas">
        <LegalParagraph>
          Puedes borrar o bloquear las cookies desde la configuración de tu navegador. Si bloqueas las necesarias, no podrás iniciar sesión ni
          enviar un pedido.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={4} title="Más información">
        <LegalParagraph>
          El tratamiento de tus datos personales se explica en el <LegalLink href="/privacidad">Aviso de privacidad</LegalLink>. Dudas:{" "}
          {D.supportEmail}.
        </LegalParagraph>
      </LegalClause>
    </>
  );
}

export { CookiesContent };
