// @ts-check
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import baseConfig from "../../eslint.config.js";

/**
 * ESLint (flat config) usa el config MÁS CERCANO al cwd, no los combina con
 * el de la raíz automáticamente — por eso este archivo reimporta
 * `baseConfig` (reglas de TS del monorepo) y le suma las de Next, que ya
 * vienen en formato flat (arreglo) desde `eslint-config-next` — sin
 * `FlatCompat`, que es solo para configs legacy de verdad.
 */
export default [...baseConfig, ...nextCoreWebVitals, ...nextTypescript];
