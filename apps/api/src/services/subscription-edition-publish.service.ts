import { EditionStatus, ProductChannel, ProductStatus } from "@esencia-glow/shared";
import { Product } from "../models/product.model.js";
import {
  SubscriptionEdition,
  type SubscriptionEditionDocument,
} from "../models/subscription-edition.model.js";
import { AppError } from "../utils/app-error.js";
import { getEditionDocument } from "./subscription-edition.service.js";

/**
 * Publicación/despublicación de una `SubscriptionEdition` — separado de
 * subscription-edition.service.ts por el tope de ~250 líneas por archivo
 * (precedente `order-admin.service.ts` / `order-admin-status.service.ts`).
 *
 * Invariantes que solo se exigen AQUÍ, no en cada `PATCH` de items: curar en
 * `DRAFT` no debe fallar porque un producto todavía esté en borrador — la
 * caja tiene que estar lista para venderse recién al publicar.
 */
async function assertPublishable(edition: SubscriptionEditionDocument): Promise<void> {
  if (edition.items.length === 0) {
    throw new AppError("La edición necesita al menos un producto para publicarse.", 400);
  }

  const productIds = [...new Set(edition.items.map((item) => item.productId.toString()))];
  const products = await Product.find({ _id: { $in: productIds } }).select("variants channel status").lean();
  const productById = new Map(products.map((product) => [product._id.toString(), product]));

  for (const item of edition.items) {
    const product = productById.get(item.productId.toString());
    if (!product) {
      throw new AppError(`El producto ${item.productId.toString()} ya no existe`, 400);
    }
    if (product.channel !== ProductChannel.SUBSCRIPTION) {
      throw new AppError(`El producto ${item.productId.toString()} no es exclusivo de suscripción`, 400);
    }
    if (product.status !== ProductStatus.ACTIVE) {
      throw new AppError(`El producto ${item.productId.toString()} no está activo`, 400);
    }
    const variant = product.variants.find((v) => v._id.toString() === item.variantId.toString());
    if (!variant || !variant.isActive) {
      throw new AppError(`La variante ${item.variantId.toString()} ya no está disponible`, 400);
    }
  }
}

/**
 * Claim atómico, nunca read-then-write: la condición `status: DRAFT` y la
 * escritura viajan en el mismo `findOneAndUpdate`. Dos publicaciones
 * concurrentes de la MISMA edición: una gana, la otra recibe 409 sin pisar
 * `publishedAt`.
 */
async function publishEdition(id: string, adminId: string): Promise<SubscriptionEditionDocument> {
  const edition = await getEditionDocument(id);
  if (edition.status === EditionStatus.PUBLISHED) {
    throw new AppError("Esta edición ya está publicada.", 409);
  }
  await assertPublishable(edition);

  const claimed = await SubscriptionEdition.findOneAndUpdate(
    { _id: id, status: EditionStatus.DRAFT },
    { $set: { status: EditionStatus.PUBLISHED, publishedAt: new Date(), publishedBy: adminId } },
    { new: true },
  );
  if (claimed) return claimed;

  await getEditionDocument(id); // 404 si desapareció entre la lectura y el claim
  throw new AppError("Esta edición ya está publicada.", 409);
}

/** Solo si no hay `firstBilledAt`: una vez que la edición generó un cobro
 * real (1.7.2), despublicarla dejaría ese cobro sin edición que lo respalde. */
async function unpublishEdition(id: string): Promise<SubscriptionEditionDocument> {
  const updated = await SubscriptionEdition.findOneAndUpdate(
    { _id: id, status: EditionStatus.PUBLISHED, firstBilledAt: { $exists: false } },
    { $set: { status: EditionStatus.DRAFT }, $unset: { publishedAt: 1, publishedBy: 1 } },
    { new: true },
  );
  if (updated) return updated;

  const edition = await getEditionDocument(id);
  if (edition.status !== EditionStatus.PUBLISHED) {
    throw new AppError("Esta edición no está publicada.", 409);
  }
  throw new AppError("No puedes despublicar una edición que ya generó un cobro.", 409);
}

export { publishEdition, unpublishEdition };
