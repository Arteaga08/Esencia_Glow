import path from "node:path";
import { defineConfig } from "vitest/config";

// Solo funciones puras (redirect seguro, reglas de contraseña, validaciones):
// no hay entorno de DOM ni de Next aquí a propósito.
export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
