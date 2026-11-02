import { formatMoneyMXN } from "@/lib/format-money";
import { STORE_WHATSAPP_DISPLAY } from "@/lib/storefront/contact";
import { LOCAL_DELIVERY_FEE_CENTS } from "@/lib/storefront/delivery";

/**
 * Datos de la tienda que llenan los textos legales (/terminos, /privacidad,
 * /cookies, /envios, /devoluciones) y /contacto. Única fuente: al recibir los
 * datos de la dueña se cambia SOLO este archivo.
 *
 * PROVISIONAL: todo lo que va entre corchetes es un dato que falta (salió de
 * la tabla "Lo que necesitamos de ti" de las plantillas legales). Los textos
 * son la versión WhatsApp de las plantillas; al reactivar Stripe hay que
 * volver a la versión Stripe. Falta además la revisión de abogada/contador.
 */
const LEGAL_DETAILS = {
  businessName: "[RAZÓN SOCIAL]",
  rfc: "[RFC]",
  address: "[DOMICILIO]",
  supportEmail: "[CORREO DE ATENCIÓN]",
  whatsapp: STORE_WHATSAPP_DISPLAY,
  supportHours: "[HORARIO DE ATENCIÓN]",
  jurisdictionCity: "[CIUDAD DE JURISDICCIÓN]",
  invoicePolicy: "[FACTURA: SI SE EMITE, CÓMO PEDIRLA Y EN QUÉ PLAZO]",
  minimumAge: "[EDAD MÍNIMA]",
  publishedAt: "[FECHA DE PUBLICACIÓN]",

  // Pedidos por WhatsApp
  paymentMethods: "[FORMAS DE PAGO]",
  paymentDeadline: "[PLAZO PARA PAGAR]",
  responseTime: "[TIEMPO DE RESPUESTA]",

  // Envíos y entregas
  localZone: "[ZONA DE ENTREGA LOCAL]",
  pickupPoint: "[PUNTO DE RECOGIDA]",
  localDeliveryFee: formatMoneyMXN(LOCAL_DELIVERY_FEE_CENTS),
  coverage: "[COBERTURA]",
  preparationDays: "[DÍAS DE PREPARACIÓN]",
  cutoff: "[DÍAS Y HORA DE CORTE]",
  deliveryAttempts: "[NÚMERO DE INTENTOS]",
  daysWithoutMovement: "[DÍAS SIN MOVIMIENTO]",

  // Cambios y devoluciones
  returnDays: "[DÍAS PARA DEVOLVER]",
  damageReportDays: "[DÍAS PARA REPORTAR DAÑO]",
  returnShippingPayer: "[QUIÉN PAGA EL ENVÍO DE REGRESO]",
  nonReturnableProducts: "[PRODUCTOS SIN DEVOLUCIÓN]",
  refundDays: "[DÍAS PARA REEMBOLSO]",
  returnResponseDays: "[DÍAS DE RESPUESTA]",
  reactionPolicy: "[ELEGIR: CAMBIO O CUPÓN POR EL VALOR DEL PRODUCTO / SOLO ORIENTACIÓN PARA ELEGIR OTRO]",
  exchangeShippingPayer: "[QUIÉN CUBRE EL ENVÍO DEL CAMBIO]",
  couponOnReturn: "[ELEGIR: EL CUPÓN NO SE REACTIVA / SE REACTIVA SI EL ERROR FUE NUESTRO]",
} as const;

export { LEGAL_DETAILS };
