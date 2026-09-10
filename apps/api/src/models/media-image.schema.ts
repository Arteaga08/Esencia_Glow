import { Schema } from "mongoose";

/**
 * Subschema compartido por `Product.images[]` y `Category.image`. No exporta
 * un `model()` propio — no es una colección, vive embebido en su dueño.
 * `_id` (default de Mongoose) es la clave de direccionamiento de los
 * endpoints de imagen (`DELETE /:id/images/:imageId`): se prefiere sobre el
 * `publicId` de Cloudinary porque este último lleva "/" (carpeta) y es frágil
 * como path param. El orden de las imágenes lo da la posición en el array, no
 * un campo de orden — el endpoint de reorden manda la lista completa de ids.
 */
interface MediaImageAttrs {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  alt?: string;
}

const mediaImageSchema = new Schema<MediaImageAttrs>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
    format: { type: String, required: true },
    bytes: { type: Number, required: true, min: 0 },
    alt: { type: String, trim: true, maxlength: 200 },
  },
  { _id: true },
);

export { mediaImageSchema };
export type { MediaImageAttrs };
