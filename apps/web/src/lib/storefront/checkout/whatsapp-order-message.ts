import type { PublicShippingAddress } from "@esencia-glow/shared";
import { formatMoneyMXN } from "@/lib/format-money";
import { DELIVERY_LABELS, type DeliveryMethod } from "../delivery";
import type { CartLineView, CartTotals } from "../cart/cart-view";

interface WhatsappOrderInput {
  customer: { fullName: string; email: string; phone: string };
  lines: readonly CartLineView[];
  totals: CartTotals;
  delivery: DeliveryMethod;
  /** Ausente al recoger en tienda. */
  address: PublicShippingAddress | null;
}

function addressLines(address: PublicShippingAddress): string[] {
  const street = [address.street, address.exteriorNumber, address.interiorNumber ? `int. ${address.interiorNumber}` : ""].filter(Boolean).join(" ");
  return [
    `Recibe: ${address.fullName} (${address.phone})`,
    `${street}, col. ${address.neighborhood}`,
    `${address.city}, ${address.state}, C.P. ${address.postalCode}`,
    ...(address.references ? [`Referencias: ${address.references}`] : []),
  ];
}

/**
 * El pedido completo como texto plano para WhatsApp: quién compra, qué lleva,
 * cuánto cuesta y a dónde va. No crea nada en el sistema, así que el mensaje es
 * lo único que la dueña recibe: tiene que bastar para cerrar la venta.
 */
function buildWhatsappOrderMessage({ customer, lines, totals, delivery, address }: WhatsappOrderInput): string {
  const buyable = lines.filter((line) => line.available);
  const national = delivery === "national";

  const products = buyable.map((line) => {
    const label = line.variantLabel ? ` (${line.variantLabel})` : "";
    const brand = line.brand ? `${line.brand} ` : "";
    return `• ${line.quantity} × ${brand}${line.name}${label}: ${formatMoneyMXN(line.priceCents * line.quantity)} (${formatMoneyMXN(line.priceCents)} c/u)`;
  });

  const money = [
    `Subtotal: ${formatMoneyMXN(totals.subtotalCents)}`,
    ...(totals.discountCents ? [`Descuento${totals.couponCode ? ` (${totals.couponCode})` : ""}: -${formatMoneyMXN(totals.discountCents)}`] : []),
    national ? "Envío: por acordar" : `Envío: ${totals.shippingCents ? formatMoneyMXN(totals.shippingCents) : "Gratis"}`,
    `${national ? "Total sin envío" : "Total"}: ${formatMoneyMXN(totals.totalCents)}`,
  ];

  return [
    "¡Hola! Quiero hacer este pedido en Esencia Glow:",
    "",
    "*Mis datos*",
    `Nombre: ${customer.fullName}`,
    `Correo: ${customer.email}`,
    `Celular: ${customer.phone}`,
    "",
    "*Productos*",
    ...products,
    "",
    ...money,
    "",
    `*Entrega: ${DELIVERY_LABELS[delivery]}*`,
    ...(address ? addressLines(address) : ["Paso a recogerlo a la tienda."]),
    "",
    "¿Me ayudas a confirmar el pago y la entrega? ¡Gracias!",
  ].join("\n");
}

export { buildWhatsappOrderMessage };
export type { WhatsappOrderInput };
