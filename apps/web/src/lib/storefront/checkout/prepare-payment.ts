import type { CartLineInput, PublicOrder } from "@esencia-glow/shared";
import { formatMoneyMXN } from "@/lib/format-money";
import { fingerprintOrder, forgetIdempotencyKey, resolveIdempotencyKey, type KeyStorage } from "./idempotency-key";
import type { PlaceOrderInput, PlaceOrderResult } from "./place-order";

/** Lo que el paso de pago necesita para cobrar: el `clientSecret` del pedido (creándolo si hace falta). */
type PreparedPayment =
  | { ok: true; clientSecret: string; orderId: string }
  /** `settledOrderId`: el pedido ya no está pendiente (se pagó o se cerró): la confirmación dirá cuál. */
  | { ok: false; message: string; settledOrderId?: string };

interface PreparePaymentDeps {
  /** Pedido ya creado desde esta página (reintento tras un rechazo del banco). */
  placed: { orderId: string; clientSecret: string } | null;
  quoteId: string;
  rateId: string;
  lines: CartLineInput[];
  /** Cupón aplicado en pantalla (solo el código; el servidor calcula el descuento). */
  couponCode?: string | undefined;
  /** Total que la clienta vio en pantalla; el del servidor puede diferir. */
  shownTotalCents: number;
  placeOrder: (input: PlaceOrderInput) => Promise<PlaceOrderResult>;
  storage: KeyStorage | null;
  makeId: () => string;
  onPlaced: (order: PublicOrder, clientSecret: string) => void;
  /** El pedido ya existe: el carrito cumplió y se vacía. */
  onCartSpent: () => void;
  /** Hay un pedido pendiente que reanudar (el API lo dijo, o quedó creado sin `clientSecret`). */
  onResume: () => void;
  onRequote: (message: string) => void;
  onRetryCart: () => void;
  onSessionLost: () => void;
  /** El servidor rechazó el cupón: se quita y el mensaje va pegado a su campo. */
  onCouponRejected: (message: string) => void;
}

/**
 * Decide cuándo se crea el pedido y cuándo se vacía el carrito: es la lógica
 * que, mal hecha, deja un pedido imposible de pagar o un carrito perdido. Todo
 * lo que toca la pantalla entra por `deps`, así se prueba sin navegador.
 */
async function preparePayment(deps: PreparePaymentDeps): Promise<PreparedPayment> {
  if (deps.placed) return { ok: true, clientSecret: deps.placed.clientSecret, orderId: deps.placed.orderId };

  const idempotencyKey = resolveIdempotencyKey(deps.storage, fingerprintOrder({ lines: deps.lines, quoteId: deps.quoteId, rateId: deps.rateId, couponCode: deps.couponCode }), deps.makeId);
  const result = await deps.placeOrder({
    lines: deps.lines,
    quoteId: deps.quoteId,
    rateId: deps.rateId,
    idempotencyKey,
    ...(deps.couponCode ? { couponCode: deps.couponCode } : {}),
  });

  if (!result.ok) {
    if (result.unauthorized) {
      deps.onSessionLost();
      return { ok: false, message: "Tu sesión venció. Inicia sesión otra vez para pagar." };
    }
    const { action, message, retryable } = result.failure;
    // Un rechazo definitivo no debe dejar la llave atascada: repetir lo mismo haría replay de un pedido que ya no sirve.
    if (!retryable) forgetIdempotencyKey(deps.storage);

    if (action === "requote") deps.onRequote(`${message} Consulta las tarifas otra vez.`);
    else if (action === "cart") deps.onRetryCart();
    else if (action === "coupon") {
      deps.onCouponRejected(message);
      return { ok: false, message: "Quitamos el cupón de tu pedido. Revisa tu total y vuelve a pagar." };
    }
    else if (action === "resume") {
      deps.onResume();
      return { ok: false, message: "Ya tienes un pedido pendiente. Lo abrimos para que termines de pagarlo." };
    } else if (action === "unavailable") {
      return { ok: false, message: "Los pagos no están disponibles por ahora. Inténtalo de nuevo más tarde." };
    }
    return { ok: false, message };
  }

  // El pedido ya existe: la llave cumplió y el carrito también.
  forgetIdempotencyKey(deps.storage);
  if (!result.clientSecret) {
    deps.onCartSpent();
    deps.onResume();
    return { ok: false, message: "Tu pedido quedó creado. Lo abrimos para que termines de pagarlo." };
  }
  deps.onPlaced(result.order, result.clientSecret);
  deps.onCartSpent();

  // El servidor recalculó el total: si no es el que la clienta vio, no se cobra a ciegas.
  if (result.order.totals.totalCents !== deps.shownTotalCents) {
    return { ok: false, message: `El total de tu pedido cambió a ${formatMoneyMXN(result.order.totals.totalCents)}. Revísalo y vuelve a pagar.` };
  }
  return { ok: true, clientSecret: result.clientSecret, orderId: result.order.id };
}

export { preparePayment };
export type { PreparedPayment, PreparePaymentDeps };
