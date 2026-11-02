import { LEGAL_DETAILS as D } from "@/lib/storefront/legal/legal-details";
import { LegalClause, LegalLink, LegalParagraph } from "./legal-blocks";

/** Términos y condiciones, versión de pedidos por WhatsApp (sin cobro en la Tienda). */
function TermsContent() {
  return (
    <>
      <LegalClause number={1} title="Quiénes somos">
        <LegalParagraph>
          El sitio esenciaglow.com.mx (la &quot;Tienda&quot;) es operado por {D.businessName}, con RFC {D.rfc} y domicilio en {D.address}{" "}
          (&quot;Esencia Glow&quot;). Puedes contactarnos en {D.supportEmail} o por WhatsApp al {D.whatsapp}, en horario de {D.supportHours}.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={2} title="Aceptación y cómo se hace un pedido">
        <LegalParagraph>
          Al crear una cuenta o enviar un pedido aceptas estos Términos y condiciones, el{" "}
          <LegalLink href="/privacidad">Aviso de privacidad</LegalLink>, la política de <LegalLink href="/envios">Envíos y entregas</LegalLink> y la
          de <LegalLink href="/devoluciones">Cambios y devoluciones</LegalLink>. En la Tienda armas tu pedido y lo envías por WhatsApp a Esencia Glow.
          Ese envío es una solicitud de compra: la venta se perfecciona cuando Esencia Glow te confirma por WhatsApp la disponibilidad, el precio
          total, el costo de entrega y la forma de pago, y tú aceptas.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={3} title="Cuenta">
        <LegalParagraph>
          Para comprar necesitas una cuenta con un correo electrónico verificado. Debes tener al menos {D.minimumAge} y dar datos verídicos. Eres
          responsable de cuidar tu contraseña y de lo que se haga desde tu cuenta; avísanos de inmediato si detectas un uso no autorizado.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={4} title="Productos">
        <LegalParagraph>
          Vendemos productos de cuidado de la piel, maquillaje y moda. Cuidamos que las fotos, descripciones, tallas e ingredientes sean exactos,
          pero el color y la presentación pueden variar ligeramente respecto a la pantalla. Los productos cosméticos no son medicamentos: no
          sustituyen un tratamiento médico. Revisa los ingredientes antes de comprar y suspende el uso si notas irritación.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={5} title="Precios">
        <LegalParagraph>
          Los precios están en pesos mexicanos (MXN) e incluyen IVA. El costo de entrega local se muestra en la Tienda antes de enviar el pedido. El
          costo del envío nacional se acuerda contigo por WhatsApp y lo conoces, junto con el total final, antes de pagar. El precio de tu pedido es
          el que te confirmamos por WhatsApp. Si un precio se publicó con un error evidente, podremos cancelar el pedido antes de cobrarlo, o
          reembolsarte lo pagado.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={6} title="Disponibilidad">
        <LegalParagraph>
          Los productos están sujetos a existencias. Enviar un pedido por la Tienda no aparta los productos: los apartamos cuando confirmamos tu
          pedido por WhatsApp, por {D.paymentDeadline}. Si no recibimos el pago en ese plazo, el pedido se cancela y los productos vuelven a estar
          disponibles. Si algún producto se agotó, te lo decimos y puedes elegir otro, esperar o cancelar sin costo.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={7} title="Pago">
        <LegalParagraph>
          Aceptamos {D.paymentMethods}. Los datos para pagar te los enviamos por WhatsApp cuando confirmamos tu pedido; nunca los pedimos por otro
          medio ni te pedimos datos de tu tarjeta. La Tienda no procesa cobros. Conserva tu comprobante de pago. El pedido queda pagado cuando
          recibimos el dinero y te lo confirmamos por WhatsApp.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={8} title="Cupones y promociones">
        <LegalParagraph>
          Cada cupón tiene sus propias condiciones (vigencia, monto mínimo, número de usos). Los cupones no son acumulables entre sí, no son
          canjeables por dinero y no aplican al costo de envío, salvo que el cupón diga lo contrario. El descuento se confirma en el total que te
          enviamos por WhatsApp. Podemos cancelar un cupón usado de forma indebida.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={9} title="Factura">
        <LegalParagraph>{D.invoicePolicy}</LegalParagraph>
      </LegalClause>

      <LegalClause number={10} title="Envíos, cambios y devoluciones">
        <LegalParagraph>
          Se rigen por las políticas de <LegalLink href="/envios">Envíos y entregas</LegalLink> y de{" "}
          <LegalLink href="/devoluciones">Cambios y devoluciones</LegalLink> publicadas en la Tienda, que forman parte de estos Términos.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={11} title="Cancelación de pedidos">
        <LegalParagraph>
          Puedes cancelar un pedido sin costo mientras no lo hayas pagado: avísanos por WhatsApp al {D.whatsapp}. Si ya pagaste y aún no lo hemos
          entregado o enviado, te reembolsamos el total por el mismo medio con que pagaste, según la política de Cambios y devoluciones. Una vez
          entregado o enviado aplica esa política.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={12} title="Suscripción">
        <LegalParagraph>
          Por ahora la Tienda no vende suscripciones ni hace cobros recurrentes. Cuando se ofrezcan, publicaremos sus condiciones antes de que
          puedas contratarlas.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={13} title="Uso del sitio">
        <LegalParagraph>
          No está permitido usar la Tienda para fines ilícitos, intentar acceder a cuentas ajenas, copiar el contenido con fines comerciales ni
          revender los productos sin autorización por escrito. Podemos suspender cuentas que incumplan estos Términos.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={14} title="Propiedad intelectual">
        <LegalParagraph>
          La marca Esencia Glow, el logotipo, las fotografías, los textos y el diseño de la Tienda pertenecen a {D.businessName} o a sus
          licenciantes. Las marcas de los productos pertenecen a sus respectivos titulares.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={15} title="Responsabilidad">
        <LegalParagraph>
          Respondemos por los productos que vendemos conforme a la Ley Federal de Protección al Consumidor. No somos responsables por reacciones
          derivadas de usar un producto de forma distinta a la indicada, ni por retrasos causados por la paquetería, por datos de entrega incorrectos
          o por causas de fuerza mayor. Tampoco somos responsables por fallas o suspensiones de WhatsApp; si no recibes respuesta en{" "}
          {D.responseTime}, escríbenos a {D.supportEmail}.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={16} title="Cambios a estos Términos">
        <LegalParagraph>
          Podemos actualizar estos Términos. La versión vigente es la publicada en la Tienda con su fecha de última actualización; a tu pedido le
          aplica la versión vigente el día de la compra.
        </LegalParagraph>
      </LegalClause>

      <LegalClause number={17} title="Ley aplicable y quejas">
        <LegalParagraph>
          Estos Términos se rigen por las leyes de México. Cualquier queja puedes presentarla primero con nosotros en {D.supportEmail}. También
          puedes acudir a la Procuraduría Federal del Consumidor (Profeco). Para cualquier controversia judicial son competentes los tribunales de{" "}
          {D.jurisdictionCity}.
        </LegalParagraph>
      </LegalClause>
    </>
  );
}

export { TermsContent };
