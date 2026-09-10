import Joi from "joi";

/**
 * Params y bodies compartidos por las rutas de recurso (producto, categoría)
 * y de imagen. `objectId` es el mismo patrón en todos: 24 hex, required.
 */
const objectId = Joi.string().hex().length(24);

const objectIdParamSchema = Joi.object({
  id: objectId.required().messages({
    "string.length": "Id inválido",
    "string.hex": "Id inválido",
  }),
});

const slugParamSchema = Joi.object({
  slug: Joi.string().trim().lowercase().max(80).required(),
});

const variantParamsSchema = Joi.object({
  id: objectId.required(),
  variantId: objectId.required(),
});

const imageParamsSchema = Joi.object({
  id: objectId.required(),
  imageId: objectId.required(),
});

// Campo de texto de multer para el/los archivo(s): "images" (array) o
// "image" (single). El alt aplica a todas las imágenes de este envío —
// cubre el caso común (una imagen, o varias sin distinguir alt por archivo).
const uploadImagesBodySchema = Joi.object({
  alt: Joi.string().trim().max(200).allow(""),
});

const reorderImagesSchema = Joi.object({
  imageIds: Joi.array().items(objectId.required()).min(1).required().messages({
    "array.min": "Debes enviar al menos un id de imagen",
  }),
});

export {
  objectIdParamSchema,
  slugParamSchema,
  variantParamsSchema,
  imageParamsSchema,
  uploadImagesBodySchema,
  reorderImagesSchema,
};
