/**
 * Corre una operación contra un tercero con un deadline DURO. La señal se
 * aborta al vencer (para que un adapter que la respete corte su request), pero
 * además se compite contra un temporizador propio: un adapter que ignore la
 * señal no puede colgar al llamador (el checkout, el webhook, el tick del
 * cron).
 *
 * Si el deadline vence, el resultado SIEMPRE es `onTimeout(...)`, aunque el
 * adapter rechace con otro error justo al abortar: con el tiempo agotado, la
 * causa real es el tiempo, y el llamador decide qué significa (una cotización
 * cortada es un 504; una compra cortada es un resultado desconocido).
 */
async function runWithDeadline<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  onTimeout: (cause?: unknown) => Error,
): Promise<T> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(onTimeout());
    }, timeoutMs);
  });

  try {
    return await Promise.race([run(controller.signal), deadline]);
  } catch (error) {
    if (controller.signal.aborted) throw onTimeout(error);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export { runWithDeadline };
