import { createHash } from "node:crypto";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { AppError } from "../utils/app-error.js";

/**
 * Revisa la contraseña contra Pwned Passwords con k-anonymity: solo viajan los
 * 5 primeros caracteres del SHA-1 (nunca la contraseña ni el hash completo) y
 * el match del sufijo se hace aquí. `Add-Padding` hace que todas las
 * respuestas tengan tamaño parecido y las filas de relleno traen conteo 0.
 *
 * Falla ABIERTO: si el servicio no responde, no se bloquea el registro de
 * nadie por una dependencia externa caída (se deja un warning). Es una
 * defensa adicional, no la barrera principal de la política de contraseñas.
 */

const RANGE_URL = "https://api.pwnedpasswords.com/range";
const REQUEST_TIMEOUT_MS = 2000;

type BreachChecker = (password: string) => Promise<boolean>;

async function isPasswordBreached(password: string): Promise<boolean> {
  const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  try {
    const response = await fetch(`${RANGE_URL}/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      logger.warn({ status: response.status }, "Pwned Passwords respondió con error; se omite la revisión");
      return false;
    }
    const body = await response.text();
    return body.split(/\r?\n/).some((line) => {
      const [lineSuffix, count] = line.split(":");
      return lineSuffix?.trim() === suffix && Number(count) > 0;
    });
  } catch (error) {
    logger.warn({ err: error }, "Pwned Passwords no disponible; se omite la revisión");
    return false;
  }
}

/** Seam de pruebas: en NODE_ENV=test no se sale a internet salvo que un test lo pida. */
let testOverride: BreachChecker | "unset" = "unset";

function __setPasswordBreachCheckerForTests(checker: BreachChecker | "unset"): void {
  if (!env.isTest) {
    throw new Error("__setPasswordBreachCheckerForTests solo puede usarse en NODE_ENV=test");
  }
  testOverride = checker;
}

function resolveChecker(): BreachChecker {
  if (env.isTest) return testOverride === "unset" ? async () => false : testOverride;
  return isPasswordBreached;
}

/** Lanza 400 si la contraseña aparece en filtraciones conocidas. */
async function assertPasswordNotBreached(password: string): Promise<void> {
  if (await resolveChecker()(password)) {
    throw new AppError("Esa contraseña apareció en filtraciones de datos. Elige una distinta.", 400);
  }
}

export { isPasswordBreached, assertPasswordNotBreached, __setPasswordBreachCheckerForTests };
