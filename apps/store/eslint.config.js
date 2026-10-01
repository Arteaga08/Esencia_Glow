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
 *
 * `eslint-config-next/core-web-vitals` YA trae su propio `@typescript-eslint`
 * empaquetado (su entrada `next/typescript`); sumarle además
 * `eslint-config-next/typescript` y el `...tseslint.configs.recommended` de
 * `baseConfig` deja TRES instancias distintas del mismo plugin registradas
 * bajo la misma clave — ESLint 9 lo rechaza con
 * `ConfigError: Cannot redefine plugin "@typescript-eslint"` (bug preexistente,
 * ya estaba en `main` antes de esta sesión). Se filtran del `baseConfig` las
 * entradas que registran plugins (las de `tseslint.configs.recommended`) y
 * se conservan solo `ignores` y las reglas propias del monorepo — Next ya
 * aporta su propio TypeScript recomendado.
 */
const baseWithoutPlugins = baseConfig.filter((entry) => !entry.plugins);

export default [...baseWithoutPlugins, ...nextCoreWebVitals, ...nextTypescript];
