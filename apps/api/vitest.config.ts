import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./tests/setup.ts"],
    // Un replica set de un nodo tarda ~2-4s más en arrancar que un standalone,
    // y los tests de concurrencia de inventario ejercitan reintentos reales de
    // transacción (WriteConflict) bajo Promise.allSettled.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Cada archivo levanta su propio `mongod --replSet` (tests/setup.ts) para
    // soportar transacciones. Sin tope, Vitest lanza un fork por archivo (28+
    // procesos mongod a la vez) y la contención de CPU/IO produce timeouts
    // esporádicos en tests que corren en <1s de forma aislada — no es un bug
    // de los tests, es recursos. 4 forks balancea velocidad de la suite
    // contra estabilidad en máquinas/CI con menos núcleos que archivos.
    poolOptions: {
      forks: {
        maxForks: 4,
      },
    },
  },
});
