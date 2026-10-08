import { LockKey, SealCheck, ShieldCheck, Truck } from "@phosphor-icons/react";
import { AccordionRows, type AccordionRow } from "./accordion-rows";
import { CardBrands } from "./card-brands";

const TEXT = "flex max-w-[65ch] flex-col gap-2 text-body text-foreground/80";

/**
 * Garantías de compra bajo el botón de agregar (referencia Piel Coreana): pago,
 * envío, calidad y originalidad. Son las mismas para todos los productos, por
 * eso el texto vive aquí y no en el contenido editorial de cada uno.
 */
const ASSURANCES: AccordionRow[] = [
  {
    key: "payments",
    label: "Pagos 100% seguros",
    icon: LockKey,
    content: (
      <div className={TEXT}>
        <p>Paga con tarjeta de crédito o débito.</p>
        <p>El cobro lo procesa Stripe: los datos de tu tarjeta viajan cifrados y nunca se guardan en nuestra tienda.</p>
        <CardBrands />
      </div>
    ),
  },
  {
    key: "shipping",
    label: "Envíos a todo México",
    icon: Truck,
    content: (
      <div className={TEXT}>
        <p>Al pagar eliges la paquetería: ahí ves el costo y los días de entrega según tu código postal.</p>
        <p>Cuando tu pedido sale, te mandamos por correo la guía para rastrearlo.</p>
      </div>
    ),
  },
  {
    key: "quality",
    label: "Garantía de calidad",
    icon: ShieldCheck,
    content: (
      <div className={TEXT}>
        <p>Revisamos cada pedido antes de enviarlo.</p>
        <p>Si tu producto llega dañado o no es el que pediste, escríbenos y lo resolvemos contigo.</p>
      </div>
    ),
  },
  {
    key: "originals",
    label: "Productos 100% originales",
    icon: SealCheck,
    content: (
      <div className={TEXT}>
        <p>Solo vendemos productos originales, nuevos y sellados.</p>
      </div>
    ),
  },
];

function PurchaseAssurances() {
  return <AccordionRows rows={ASSURANCES} compact />;
}

export { PurchaseAssurances };
