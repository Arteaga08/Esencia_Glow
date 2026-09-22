import { env } from "../config/env.js";
import { processOrderLabel } from "./order-label.service.js";

/**
 * Disparo inmediato de la compra de la guía tras confirmarse el pago
 * (Milestone 1.9). Es fire-and-forget POR DISEÑO: se llama desde
 * `settleCapturedPayment`, que a su vez cuelga del webhook de Stripe — un
 * `await` aquí convertiría cualquier falla del proveedor de envíos en un 500
 * del webhook y Stripe reentregaría el evento para siempre. Si el disparo se
 * pierde (proceso muerto, proveedor caído), el job de guías la retoma en el
 * siguiente tick: este disparo es una optimización de latencia, no la fuente
 * de verdad.
 *
 * `processOrderLabel` nunca lanza, así que el `void` no deja un rechazo sin
 * atender.
 */

const inFlight = new Set<Promise<unknown>>();

/** En tests el disparo está APAGADO por defecto: una escritura de fondo que
 * sobrevive al test que la originó contaminaría al siguiente. Solo los tests
 * del disparo lo encienden (y lo apagan al terminar). Vive aquí y no en
 * `tests/setup.ts` a propósito: ese setup reimporta sus módulos en cada test
 * y este arrastra modelos de Mongoose, que no toleran recompilarse tras un
 * `vi.resetModules()`. */
let testEnabled = !env.isTest;

function __setLabelTriggerEnabledForTests(enabled: boolean): void {
  if (!env.isTest) {
    throw new Error("__setLabelTriggerEnabledForTests solo puede usarse en NODE_ENV=test");
  }
  testEnabled = enabled;
}

/** Espera a que terminen los disparos en vuelo — solo para tests. */
async function __flushLabelTriggersForTests(): Promise<void> {
  await Promise.all([...inFlight]);
}

function triggerLabelGeneration(orderId: string): void {
  if (env.isTest && !testEnabled) return;
  const task = processOrderLabel(orderId).finally(() => inFlight.delete(task));
  inFlight.add(task);
}

export { triggerLabelGeneration, __setLabelTriggerEnabledForTests, __flushLabelTriggersForTests };
