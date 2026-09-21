import type { HomeSectionKey } from "@esencia-glow/shared";
import { HomeContent, type HomeContentAttrs } from "../models/home-content.model.js";
import { AppError } from "../utils/app-error.js";
import { isDuplicateKeyError } from "../utils/duplicate-key-error.js";

const HOME_CONTENT_ID = "home";

/**
 * Cambio a UNA sección: `set`/`unset` van con rutas relativas a la sección
 * (`"text"`, `"slides"`, `"slides.$[slide].images.desktop"`) y `arrayFilters`
 * solo se pasa si alguna ruta usa un identificador de filtro.
 */
interface SectionWrite {
  set?: Record<string, unknown>;
  unset?: string[];
  arrayFilters?: Record<string, unknown>[];
}

/** Tope de reintentos del choque de INSERT del singleton en una primera escritura. */
const MAX_FIRST_WRITE_ATTEMPTS = 3;

const STALE_SECTION_MESSAGE =
  "Otra persona editó esta sección mientras la tenías abierta. Recarga para ver los cambios antes de guardar.";

/** Lectura cruda del singleton. `null` si nadie lo ha escrito: un GET nunca lo crea. */
async function readHomeContent(): Promise<HomeContentAttrs | null> {
  return HomeContent.findById(HOME_CONTENT_ID).lean<HomeContentAttrs>();
}

/**
 * Única primitiva de escritura del home: compare-and-swap sobre la versión de
 * UNA sección.
 *
 * El filtro exige `<sección>.version == expectedVersion` (o "no existe" si es
 * 0) y el `$set` sube esa versión en +1. Solo la PRIMERA escritura de una
 * sección (versión 0) usa upsert, porque el singleton puede no existir aún:
 * si la sección ya se escribió, el filtro no matchea, el upsert intenta
 * insertar el `_id` fijo y Mongo responde E11000 — ese choque ES la señal de
 * "escritura vieja". No hay reintento automático de Mongo que lo esconda: el
 * filtro lleva un predicado extra (`<sección>.version`) además del `_id`, así
 * que no cumple la condición de reintento de upsert (cubierto por test
 * concurrente).
 *
 * Toda escritura con versión >= 1 va SIN upsert: "sin match" (`null`) es la
 * señal de versión vieja. Es obligatorio para las rutas con `arrayFilters`
 * (imágenes por slide), donde un upsert sin match no da E11000 sino un error
 * de path posicional.
 *
 * Solo toca rutas de su propia sección — nunca reemplaza el documento — así
 * que dos secciones distintas se editan en paralelo sin pisarse.
 */
async function writeSection(
  section: HomeSectionKey,
  expectedVersion: number,
  write: SectionWrite,
): Promise<HomeContentAttrs> {
  const set: Record<string, unknown> = {
    [`${section}.version`]: expectedVersion + 1,
    [`${section}.updatedAt`]: new Date(),
  };
  for (const [path, value] of Object.entries(write.set ?? {})) {
    set[`${section}.${path}`] = value;
  }

  const update: Record<string, unknown> = { $set: set };
  if (write.unset && write.unset.length > 0) {
    update.$unset = Object.fromEntries(write.unset.map((path) => [`${section}.${path}`, ""]));
  }

  const versionFilter = expectedVersion === 0 ? { $exists: false } : expectedVersion;

  for (let attempt = 1; ; attempt += 1) {
    try {
      const updated = await HomeContent.findOneAndUpdate(
        { _id: HOME_CONTENT_ID, [`${section}.version`]: versionFilter },
        update,
        {
          upsert: expectedVersion === 0,
          new: true,
          ...(write.arrayFilters ? { arrayFilters: write.arrayFilters } : {}),
        },
      ).lean<HomeContentAttrs>();
      if (!updated) throw new AppError(STALE_SECTION_MESSAGE, 409);
      return updated;
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;

      // E11000 en una primera escritura tiene DOS causas. (a) La sección ya
      // existe: escritura vieja -> 409. (b) El singleton no existía y otra
      // primera escritura de OTRA sección ganó el INSERT del `_id` fijo: nadie
      // editó ESTA sección, así que se reintenta — ahora el documento existe y
      // el filtro matchea sin insertar. Se distingue RELEYENDO, nunca
      // inspeccionando la forma del error (mismo criterio que 1.7.2a).
      const raceOnSingletonInsert =
        expectedVersion === 0 &&
        attempt < MAX_FIRST_WRITE_ATTEMPTS &&
        currentVersion(await readHomeContent(), section) === 0;
      if (!raceOnSingletonInsert) throw new AppError(STALE_SECTION_MESSAGE, 409);
    }
  }
}

/** Versión actual de una sección (0 si nunca se escribió), para el pre-chequeo barato. */
function currentVersion(doc: HomeContentAttrs | null, section: HomeSectionKey): number {
  return doc?.[section]?.version ?? 0;
}

/** Pre-chequeo barato de versión: 409 si la sección ya no está en la versión que el admin leyó. */
function assertVersionMatches(doc: HomeContentAttrs | null, section: HomeSectionKey, version: number): void {
  if (currentVersion(doc, section) !== version) throw new AppError(STALE_SECTION_MESSAGE, 409);
}

export { HOME_CONTENT_ID, readHomeContent, writeSection, currentVersion, assertVersionMatches };
export type { SectionWrite };
