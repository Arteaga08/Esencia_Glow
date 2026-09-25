import { Schema } from "mongoose";

/**
 * Contenido editorial (Milestone 2.2.1, extendido a `Bundle` en 2.2.3):
 * ingredientes, pasos de rutina, modo de uso y beneficios. Cada bloque es una
 * lista ordenada de `{ title, text }` — nunca texto libre — para que el
 * storefront pinte viñeta/numeración y el título en negrita sin parsear
 * nada. Los cuatro bloques son opcionales y viven embebidos en el documento
 * dueño (no hay CRUD propio ni referencias externas: se reemplazan
 * completos, igual que `Bundle.items`). Un paquete se vende como un producto
 * más en el storefront y necesita la misma vitrina editorial que `Product`.
 */

interface ProductContentItemAttrs {
  title: string;
  text: string;
}

interface ProductContentAttrs {
  ingredients: ProductContentItemAttrs[];
  routineSteps: ProductContentItemAttrs[];
  usage: ProductContentItemAttrs[];
  benefits: ProductContentItemAttrs[];
}

const productContentItemSchema = new Schema<ProductContentItemAttrs>(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    text: { type: String, required: true, trim: true, maxlength: 400 },
  },
  { _id: false },
);

const productContentSchema = new Schema<ProductContentAttrs>(
  {
    ingredients: { type: [productContentItemSchema], default: [] },
    routineSteps: { type: [productContentItemSchema], default: [] },
    usage: { type: [productContentItemSchema], default: [] },
    benefits: { type: [productContentItemSchema], default: [] },
  },
  { _id: false },
);

export { productContentSchema, productContentItemSchema };
export type { ProductContentAttrs, ProductContentItemAttrs };
