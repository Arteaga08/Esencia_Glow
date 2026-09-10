import mongoose from "mongoose";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../src/utils/app-error.js";
import { withTransaction } from "../../src/utils/with-transaction.js";

/**
 * Modelos desechables por test: with-transaction.ts es infraestructura
 * genérica, no depende de ningún modelo de dominio.
 */
async function throwawayModel(name: string) {
  const model = mongoose.models[name] ?? mongoose.model(name, new mongoose.Schema({ n: Number }));
  // Crear la colección ANTES de abrir cualquier transacción: Mongoose la crea
  // de forma perezosa, y crear una colección implícitamente dentro de una
  // transacción es la fuente #1 de flakiness identificada en el diseño.
  await model.init();
  return model;
}

describe("utils/withTransaction", () => {
  it("hace commit y devuelve el valor de retorno del callback", async () => {
    const Doc = await throwawayModel("WithTxDocCommit");

    const result = await withTransaction(async (session) => {
      await Doc.create([{ n: 42 }], { session });
      return "done";
    });

    expect(result).toBe("done");
    expect(await Doc.countDocuments()).toBe(1);
  });

  it("revierte todas las escrituras y propaga un AppError sin reintentar", async () => {
    const Doc = await throwawayModel("WithTxDocRollback");
    let calls = 0;

    await expect(
      withTransaction(async (session) => {
        calls += 1;
        await Doc.create([{ n: 1 }], { session });
        throw new AppError("boom", 400);
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: "boom" });

    expect(calls).toBe(1);
    expect(await Doc.countDocuments()).toBe(0);
  });

  it("reusa una sesión ya en transacción en vez de abrir una nueva", async () => {
    const Doc = await throwawayModel("WithTxDocReuse");
    const outerSession = await mongoose.startSession();
    outerSession.startTransaction();

    const result = await withTransaction(async (session) => {
      expect(session).toBe(outerSession);
      await Doc.create([{ n: 7 }], { session });
      return "inner-done";
    }, outerSession);

    expect(result).toBe("inner-done");
    expect(outerSession.inTransaction()).toBe(true);
    // Todavía no es visible fuera de la transacción externa sin comprometer:
    // si withTransaction hubiera abierto/cerrado la suya propia, esto ya sería 1.
    expect(await Doc.countDocuments()).toBe(0);

    await outerSession.commitTransaction();
    outerSession.endSession();
    expect(await Doc.countDocuments()).toBe(1);
  });

  it("cierra la sesión propia con endSession aunque el callback lance", async () => {
    const realSession = await mongoose.startSession();
    const endSessionSpy = vi.spyOn(realSession, "endSession");
    const startSessionSpy = vi
      .spyOn(mongoose, "startSession")
      .mockResolvedValueOnce(realSession);

    await expect(
      withTransaction(async () => {
        throw new AppError("boom", 400);
      }),
    ).rejects.toThrow("boom");

    expect(endSessionSpy).toHaveBeenCalledTimes(1);
    startSessionSpy.mockRestore();
  });
});
