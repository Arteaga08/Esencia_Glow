import { AuditLog } from "./audit-log.model.js";
import { Bundle } from "./bundle.model.js";
import { Category } from "./category.model.js";
import { Inventory } from "./inventory.model.js";
import { Product } from "./product.model.js";
import { Session } from "./session.model.js";
import { Settings } from "./settings.model.js";
import { StockReservation } from "./stock-reservation.model.js";
import { User } from "./user.model.js";
import { VerificationToken } from "./verification-token.model.js";

/**
 * Barrel de todos los modelos registrados en Mongoose. Existe para que
 * `tests/setup.ts` pueda forzar la creación de colecciones e índices
 * (`model.init()`) ANTES de que corra cualquier test — Mongoose los crea de
 * forma perezosa, y crear una colección o construir un índice dentro de una
 * transacción no está permitido. Sin este barrel, el primer test que abra
 * una transacción sobre una colección nueva falla con un error de Mongo que
 * no tiene nada que ver con el código bajo prueba.
 *
 * También es el gancho para `syncIndexes()` como paso de CD (ver
 * config/db.ts) una vez que `autoIndex` se apague en producción.
 */
const models = [
  AuditLog,
  Bundle,
  Category,
  Inventory,
  Product,
  Session,
  Settings,
  StockReservation,
  User,
  VerificationToken,
];

export { models };
