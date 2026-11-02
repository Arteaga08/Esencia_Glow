import { LEGAL_DETAILS as D } from "@/lib/storefront/legal/legal-details";
import { LegalClause, LegalLink, LegalParagraph } from "./legal-blocks";

/** Envíos y entregas, versión WhatsApp: entrega local o envío nacional por acordar. */
function ShippingContent() {
  return (
    <>
      <LegalClause number={1} title="Tipos de entrega">
        <LegalParagraph>
          Ofrecemos dos: <em>entrega local</em> en {D.localZone}, y <em>envío nacional</em> por paquetería a {D.coverage}. Por ahora no hacemos
          envíos internacionales.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={2} title="Costo">
        <LegalParagraph>
          La entrega local es gratis si recoges tu pedido en {D.pickupPoint} y cuesta {D.localDeliveryFee} MXN si te lo llevamos a domicilio. El
          costo del envío nacional depende del destino y del tamaño del paquete: te lo informamos por WhatsApp antes de que pagues y solo se cobra
          si lo aceptas.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={3} title="Tiempo de preparación">
        <LegalParagraph>
          Preparamos tu pedido en {D.preparationDays} a partir de que recibimos tu pago y te lo confirmamos. Preparamos pedidos {D.cutoff}; los
          pagos confirmados después del corte, en fin de semana o en día festivo se preparan el siguiente día hábil.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={4} title="Tiempo de entrega">
        <LegalParagraph>
          En entrega local acordamos contigo el día y la hora por WhatsApp. En envío nacional depende de la paquetería y el servicio acordados; el
          tiempo estimado te lo damos junto con el costo. Ese tiempo empieza a contar cuando la paquetería recoge el paquete y es un estimado, no
          una garantía. En temporadas altas (Buen Fin, diciembre) puede haber retrasos.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={5} title="Seguimiento">
        <LegalParagraph>
          En envío nacional te enviamos por WhatsApp o por correo el número de guía y el enlace de rastreo en cuanto salga el paquete. En entrega
          local te avisamos por WhatsApp cuando vamos en camino o cuando tu pedido está listo para recoger.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={6} title="Dirección de entrega">
        <LegalParagraph>
          Revisa bien tu dirección y teléfono antes de enviar el pedido. Si necesitas corregirlos, escríbenos cuanto antes por WhatsApp al{" "}
          {D.whatsapp}; solo podemos cambiarlos antes de entregar el paquete a la paquetería o salir a entrega. Si el paquete regresa a nosotras por
          dirección incorrecta o porque nadie lo recibió, el nuevo envío corre por tu cuenta.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={7} title="Intentos de entrega">
        <LegalParagraph>
          La paquetería hace normalmente {D.deliveryAttempts} intentos de entrega. Si no logra entregar, el paquete puede quedar en una sucursal
          para que lo recojas o regresar a nuestro almacén.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={8} title="Paquete dañado, incompleto o equivocado">
        <LegalParagraph>
          Si tu paquete llega abierto, dañado, incompleto o con un producto distinto al que pediste, escríbenos dentro de {D.damageReportDays} a
          partir de la entrega, con tu número de pedido y fotos del paquete y del producto. Lo resolvemos sin costo para ti, con reposición o
          reembolso conforme a la política de <LegalLink href="/devoluciones">Cambios y devoluciones</LegalLink>.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={9} title="Paquete extraviado">
        <LegalParagraph>
          Si el rastreo no se mueve en {D.daysWithoutMovement} días hábiles o aparece como entregado y no lo recibiste, avísanos. Abrimos el reporte
          con la paquetería y, si se confirma el extravío, te reponemos el pedido o te reembolsamos el total.
        </LegalParagraph>
      </LegalClause>
    </>
  );
}

export { ShippingContent };
