import { describe, expect, it } from "vitest";
import { runWithDeadline } from "../../src/utils/run-with-deadline.js";

class TimeoutError extends Error {}

describe("utils/runWithDeadline", () => {
  it("devuelve el valor cuando la operación termina a tiempo", async () => {
    const value = await runWithDeadline(async () => 42, 1000, () => new TimeoutError("tarde"));
    expect(value).toBe(42);
  });

  it("le entrega a la operación una señal que aún no está abortada", async () => {
    let seen: AbortSignal | undefined;
    await runWithDeadline(
      async (signal) => {
        seen = signal;
      },
      1000,
      () => new TimeoutError("tarde"),
    );
    expect(seen).toBeInstanceOf(AbortSignal);
    expect(seen!.aborted).toBe(false);
  });

  it("una operación que NUNCA responde (ignora la señal) rechaza con el error de timeout", async () => {
    await expect(runWithDeadline(() => new Promise(() => {}), 30, () => new TimeoutError("tarde"))).rejects.toBeInstanceOf(
      TimeoutError,
    );
  });

  it("aborta la señal al vencer el deadline", async () => {
    let signal: AbortSignal | undefined;
    await runWithDeadline(
      (s) => {
        signal = s;
        return new Promise(() => {});
      },
      30,
      () => new TimeoutError("tarde"),
    ).catch(() => undefined);
    expect(signal!.aborted).toBe(true);
  });

  it("si la operación rechaza CON OTRO ERROR justo al abortar, gana el error de timeout (la causa real es el tiempo)", async () => {
    const error = await runWithDeadline(
      (signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("abortado por el adapter")));
        }),
      30,
      () => new TimeoutError("tarde"),
    ).catch((e) => e);
    expect(error).toBeInstanceOf(TimeoutError);
  });

  it("un error de la operación ANTES del deadline se propaga tal cual", async () => {
    const boom = new Error("falla real");
    await expect(runWithDeadline(async () => Promise.reject(boom), 1000, () => new TimeoutError("tarde"))).rejects.toBe(boom);
  });

  it("pasa la causa original al construir el error de timeout", async () => {
    let received: unknown = "sin llamar";
    await runWithDeadline(
      (signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("causa")));
        }),
      30,
      (cause) => {
        received = cause;
        return new TimeoutError("tarde");
      },
    ).catch(() => undefined);
    expect(received).toBeInstanceOf(Error);
    expect((received as Error).message).toBe("causa");
  });
});
