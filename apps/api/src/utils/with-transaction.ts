import mongoose, { type ClientSession } from "mongoose";
import { AppError } from "./app-error.js";

// Cada reintento es barato (abort en memoria + un round-trip corto, no una
// espera de red) — MongoDB no ofrece fairness entre transacciones que
// compiten por el mismo documento, así que un burst ordinario de 10 lecturas
// concurrentes sobre una sola fila de Inventory puede tranquilamente hacer
// que una de ellas choque 3+ veces antes de tener su turno de escribir sin
// conflicto. Medido empíricamente: con MAX_ATTEMPTS=3, un burst de 10 sobre
// 5 unidades disponibles produce un 409 falso (`intenta de nuevo`) en ~50%
// de las corridas, aun cuando SÍ había stock para las 5 primeras en llegar.
// 50 deja margen amplio para bursts de decenas de requests sobre el mismo
// documento sin acercarse al límite de 120s del driver.
const MAX_ATTEMPTS = 50;

const TRANSACTION_OPTIONS = {
  readConcern: { level: "snapshot" as const },
  writeConcern: { w: "majority" as const },
  maxCommitTimeMS: 5000,
};

/**
 * Corre `fn` dentro de una transacción de Mongo, o reusa `session` tal cual
 * cuando el llamador ya es dueño de una (esto es lo que hace componible el
 * módulo: 1.5 encadenará varios services bajo una sola transacción pasando
 * la misma `session` a cada uno).
 *
 * Contrato obligatorio de `fn`: cero estado mutable capturado desde fuera del
 * closure, cero efectos no-DB adentro (auditoría, email, HTTP — eso va
 * DESPUÉS de que esta función resuelve), cero lecturas hechas antes de
 * llamar a `withTransaction`, cero operaciones en paralelo sobre la sesión,
 * cero llamadas a algo que abra su propia transacción.
 *
 * Por qué el contrato importa: WiredTiger aborta al perdedor de un conflicto
 * de escritura con un `TransientTransactionError`, y `session.withTransaction`
 * REEJECUTA EL CALLBACK COMPLETO al ver esa etiqueta. Mongo revierte sus
 * propias escrituras en el abort, pero cualquier estado de JS capturado fuera
 * del closure sobrevive y se duplica en el reintento.
 *
 * Cap de intentos: el driver no expone un máximo (solo corta a los 120s). Un
 * contador propio traduce el agotamiento a un 409 explícito en vez de dejar
 * que el caller vea un 500 después de más de un minuto de reintentos.
 * `maxAttempts` es configurable (default 50) porque una transacción larga
 * — el checkout de 1.5 toca varias colecciones y re-precia todo en cada
 * reintento — puede acercarse al límite de vida de transacción del
 * servidor mucho antes de agotar 50 intentos; ese caller pasa un techo
 * más bajo.
 */
async function withTransaction<T>(
  fn: (session: ClientSession) => Promise<T>,
  session?: ClientSession,
  maxAttempts: number = MAX_ATTEMPTS,
): Promise<T> {
  if (session) {
    return fn(session);
  }

  const ownSession = await mongoose.startSession();
  let attempts = 0;
  let result!: T;

  try {
    await ownSession.withTransaction(async () => {
      attempts += 1;
      if (attempts > maxAttempts) {
        throw new AppError("El inventario está siendo actualizado, intenta de nuevo.", 409);
      }
      result = await fn(ownSession);
    }, TRANSACTION_OPTIONS);
  } finally {
    await ownSession.endSession();
  }

  return result;
}

export { withTransaction };
