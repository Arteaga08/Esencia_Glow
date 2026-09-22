import { afterEach, describe, expect, it } from "vitest";
import { PaymentEvent } from "../../src/models/payment-event.model.js";
import { syncIndexes } from "../../src/scripts/sync-indexes.js";

/**
 * `PaymentEvent` sirve de modelo representativo: tiene un índice único real
 * (`eventId`, dedupe de eventos de Stripe) y uno TTL real (`purgeAt`), en el
 * mismo modelo. `tests/setup.ts` ya corre `model.init()` en `beforeAll` para
 * TODA la suite (necesario para las transacciones de otros tests), así que
 * la BD nunca está "vacía" al llegar aquí — para probar el caso de arranque
 * en frío se hace `dropIndexes()` primero, contra este modelo únicamente.
 */
async function getIndexNames(): Promise<string[]> {
  const indexes = await PaymentEvent.collection.indexes();
  return indexes.map((index) => String(index.name));
}

describe("scripts/sync-indexes", () => {
  afterEach(async () => {
    // Deja el modelo en el estado que espera el resto de la suite: solo sus
    // índices declarados, sin el bogus que algún test haya podido agregar.
    await PaymentEvent.collection.dropIndexes();
    await PaymentEvent.createIndexes();
  });

  it("BD vacía (sin índices propios) -> crea el único y el TTL declarados", async () => {
    await PaymentEvent.collection.dropIndexes();
    expect(await getIndexNames()).toEqual(["_id_"]);

    const result = await syncIndexes({ prune: false });

    expect(result.hadFailure).toBe(false);
    const names = await getIndexNames();
    expect(names).toContain("eventId_1");
    expect(names).toContain("purgeAt_1");
  });

  it("segunda corrida es idempotente (sin toCreate ni toDrop)", async () => {
    await syncIndexes({ prune: false });
    const first = await getIndexNames();

    const result = await syncIndexes({ prune: false });

    expect(result.hadFailure).toBe(false);
    expect(await getIndexNames()).toEqual(first);

    const diff = await PaymentEvent.diffIndexes();
    expect(diff.toCreate).toEqual([]);
    expect(diff.toDrop).toEqual([]);
  });

  it("un índice sobrante se reporta pero NO se borra sin --prune", async () => {
    await PaymentEvent.collection.createIndex({ bogusField: 1 }, { name: "bogus_extra_index" });

    const result = await syncIndexes({ prune: false });

    expect(result.hadFailure).toBe(false);
    expect(await getIndexNames()).toContain("bogus_extra_index");
  });

  it("con --prune SÍ borra el índice sobrante reportado", async () => {
    await PaymentEvent.collection.createIndex({ bogusField: 1 }, { name: "bogus_extra_index" });

    const result = await syncIndexes({ prune: true });

    expect(result.hadFailure).toBe(false);
    expect(await getIndexNames()).not.toContain("bogus_extra_index");
    // Los índices declarados en el schema siguen intactos — --prune no toca
    // nada que sí esté en el schema.
    expect(await getIndexNames()).toEqual(expect.arrayContaining(["eventId_1", "purgeAt_1"]));
  });
});
