import { LEGAL_DETAILS as D } from "@/lib/storefront/legal/legal-details";
import { LegalClause, LegalLink, LegalList, LegalParagraph, LegalTable } from "./legal-blocks";

const PROVIDER_ROWS = [
  ["WhatsApp (Meta)", "Recibir y atender tus pedidos por mensaje", "Tu mensaje de pedido, número de celular y la conversación"],
  ["La paquetería que se acuerde para tu envío", "Entregar tu paquete", "Nombre, teléfono, dirección de entrega"],
  ["Resend", "Enviar los correos de la Tienda", "Nombre y correo"],
  ["Servicios de alojamiento y base de datos (Railway, MongoDB Atlas, Cloudflare)", "Operar el sitio y guardar la información", "Los datos de tu cuenta"],
];

/** Aviso de privacidad, versión de pedidos por WhatsApp (sin Stripe ni analítica). */
function PrivacyContent() {
  return (
    <>
      <LegalClause number={1} title="Responsable">
        <LegalParagraph>
          {D.businessName}, con domicilio en {D.address}, es responsable del tratamiento de tus datos personales en la tienda esenciaglow.com.mx.
          Contacto para temas de privacidad: {D.supportEmail}.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={2} title="Datos que recabamos">
        <LegalList
          items={[
            "Identificación y contacto: nombre, correo electrónico y teléfono.",
            "Cuenta: tu contraseña, que guardamos cifrada y nadie puede leer.",
            "Entrega: direcciones de envío y nombre de quien recibe.",
            "Compras: pedidos, productos guardados y cupones usados.",
            "Pedidos por WhatsApp: el contenido del mensaje que nos envías al hacer un pedido (nombre completo, correo, celular, dirección, productos, descuento, tipo de entrega y total) y la conversación posterior. Si pagas por transferencia o depósito, podemos ver el nombre del titular y los datos del comprobante que nos compartas. No recabamos ni guardamos datos de tu tarjeta.",
            "Datos técnicos: dirección IP, tipo de navegador y cookies necesarias para mantener tu sesión.",
          ]}
        />
        <LegalParagraph>No recabamos datos personales sensibles.</LegalParagraph>
      </LegalClause>

      <LegalClause number={3} title="Para qué los usamos (finalidades necesarias)">
        <LegalList
          items={[
            "Crear y administrar tu cuenta.",
            "Confirmar y gestionar tus pedidos por WhatsApp, recibir tu pago y emitir reembolsos.",
            "Coordinar la entrega local o cotizar y enviar tu paquete por paquetería.",
            "Enviarte correos sobre tu cuenta y tus pedidos.",
            "Atender dudas, cambios, devoluciones y aclaraciones.",
            "Prevenir fraudes y proteger la seguridad de la Tienda.",
            "Cumplir obligaciones legales y fiscales.",
          ]}
        />
      </LegalClause>

      <LegalClause number={4} title="Finalidades no necesarias">
        <LegalParagraph>No usamos tus datos para publicidad ni te enviamos correos promocionales.</LegalParagraph>
      </LegalClause>

      <LegalClause number={5} title="Con quién los compartimos">
        <LegalParagraph>
          No vendemos tus datos. Los compartimos únicamente con los proveedores que nos ayudan a operar la Tienda, que solo pueden usarlos para
          prestarnos ese servicio:
        </LegalParagraph>
        <LegalTable caption="Proveedores con los que compartimos datos" headers={["Proveedor", "Para qué", "Datos"]} rows={PROVIDER_ROWS} />
        <LegalParagraph>
          Al enviar tu pedido por WhatsApp, esa conversación también queda sujeta al aviso de privacidad y a los términos de WhatsApp. Algunos
          proveedores guardan información en servidores fuera de México. También podremos entregar datos a una autoridad cuando la ley nos obligue.
          Estas comunicaciones no requieren tu consentimiento conforme a la ley.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={6} title="Tus derechos (ARCO)">
        <LegalParagraph>
          Puedes acceder a tus datos, rectificarlos, cancelarlos u oponerte a su uso, y revocar tu consentimiento. Varios de estos cambios puedes
          hacerlos tú misma en &quot;Mi cuenta&quot;. Para lo demás, escribe a {D.supportEmail} con:
        </LegalParagraph>
        <LegalList
          ordered
          items={["Tu nombre y el correo de tu cuenta.", "Copia de una identificación oficial.", "Qué derecho quieres ejercer y sobre qué datos."]}
        />
        <LegalParagraph>
          Te responderemos en un plazo máximo de 20 días hábiles. Si procede, lo haremos efectivo dentro de los 15 días hábiles siguientes. Algunos
          datos debemos conservarlos por obligación legal o fiscal aunque pidas su cancelación.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={7} title="Cuánto tiempo los conservamos">
        <LegalParagraph>
          Mientras tu cuenta esté activa y, después, el tiempo que exijan las leyes fiscales y de protección al consumidor.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={8} title="Cookies">
        <LegalParagraph>
          Usamos cookies según se explica en la <LegalLink href="/cookies">Política de cookies</LegalLink>.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={9} title="Menores de edad">
        <LegalParagraph>
          La Tienda no está dirigida a menores de {D.minimumAge}. Si detectamos una cuenta de un menor sin autorización de su madre, padre o tutor,
          la cancelaremos.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={10} title="Cambios al aviso">
        <LegalParagraph>
          Publicaremos cualquier cambio en esta página con su fecha de actualización. Si el cambio es importante, te avisaremos por correo.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={11} title="Autoridad">
        <LegalParagraph>
          Si consideras que tu derecho a la protección de datos fue vulnerado, puedes acudir a la Secretaría Anticorrupción y Buen Gobierno.
        </LegalParagraph>
      </LegalClause>
    </>
  );
}

export { PrivacyContent };
