import { LEGAL_DETAILS as D } from "@/lib/storefront/legal/legal-details";
import { LegalClause, LegalList, LegalParagraph } from "./legal-blocks";

/** Cambios y devoluciones, versión WhatsApp: reembolso por el mismo medio de pago. */
function ReturnsContent() {
  return (
    <>
      <LegalClause number={1} title="Plazo">
        <LegalParagraph>Tienes {D.returnDays} a partir de que recibes tu pedido para solicitar un cambio o una devolución.</LegalParagraph>
      </LegalClause>

      <LegalClause number={2} title="Condiciones">
        <LegalParagraph>Por higiene y seguridad, solo aceptamos productos:</LegalParagraph>
        <LegalList
          items={[
            "Sin abrir y sin usar, con sus sellos y etiquetas intactos.",
            "En su empaque original y en buen estado.",
            "Con el número de pedido de la compra.",
          ]}
        />
      </LegalClause>

      <LegalClause number={3} title="Lo que no tiene devolución">
        <LegalParagraph>
          {D.nonReturnableProducts}. Esta excepción no aplica si el producto llegó dañado, defectuoso o equivocado.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={4} title="Producto dañado, defectuoso o equivocado">
        <LegalParagraph>
          Escríbenos dentro de {D.damageReportDays} a partir de la entrega, con tu número de pedido y fotos. Nosotras cubrimos el envío de regreso y
          tú eliges entre la reposición del producto o el reembolso total.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={5} title="Reacción al producto">
        <LegalParagraph>
          Si un producto te causa una reacción, deja de usarlo y escríbenos con fotos y tu número de pedido. {D.reactionPolicy}.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={6} title="Cómo solicitarlo">
        <LegalList
          ordered
          items={[
            `Escríbenos por WhatsApp al ${D.whatsapp} o a ${D.supportEmail} con tu número de pedido, el producto y el motivo.`,
            `Te respondemos en máximo ${D.returnResponseDays} días hábiles con las instrucciones de envío.`,
            "Envías el producto bien protegido. No aceptamos devoluciones que lleguen sin haber sido autorizadas antes.",
            "Al recibirlo lo revisamos y te confirmamos el cambio o el reembolso.",
          ]}
        />
      </LegalClause>

      <LegalClause number={7} title="Quién paga el envío de regreso">
        <LegalParagraph>
          Si la devolución es porque cambiaste de opinión, el envío de regreso lo cubre {D.returnShippingPayer} y el costo de entrega original no se
          reembolsa. En entrega local puedes devolver el producto directamente en {D.pickupPoint} o en la entrega acordada. Si es por un error
          nuestro o un producto dañado, lo cubrimos nosotras.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={8} title="Cambios">
        <LegalParagraph>
          Puedes cambiar tu producto por otro de igual o mayor valor, sujeto a existencias. Si el nuevo producto cuesta más, pagas la diferencia. El
          envío del producto nuevo lo cubre {D.exchangeShippingPayer}.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={9} title="Reembolsos">
        <LegalParagraph>
          Una vez aprobada la devolución, procesamos el reembolso en {D.refundDays}. Lo hacemos por el mismo medio con que pagaste (transferencia a
          la cuenta de origen o efectivo si pagaste en efectivo). Para una transferencia necesitamos que nos confirmes la cuenta y el nombre del
          titular por WhatsApp. El tiempo en que el banco lo refleje depende de tu institución. No hacemos reembolsos a cuentas de terceros.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={10} title="Kits y promociones">
        <LegalParagraph>
          Los kits se devuelven completos, con todos sus productos. Si compraste con un cupón, se reembolsa lo que efectivamente pagaste.{" "}
          {D.couponOnReturn}.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={11} title="Garantía y quejas">
        <LegalParagraph>
          Estas políticas no limitan los derechos que te da la Ley Federal de Protección al Consumidor. Si no quedas conforme con nuestra respuesta,
          puedes acudir a Profeco.
        </LegalParagraph>
      </LegalClause>
    </>
  );
}

export { ReturnsContent };
