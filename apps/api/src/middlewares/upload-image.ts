import multer, { MulterError } from "multer";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "../utils/app-error.js";
import { ALLOWED_IMAGE_MIMES } from "../utils/image-signature.js";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 8;

/**
 * `memoryStorage` es obligatorio: la validación por magic bytes y `sharp`
 * necesitan el buffer completo, y nunca se escribe a disco (evita path
 * traversal por nombre de archivo — el `originalname` del cliente no se usa
 * en ningún lado). El whitelist de mimetype aquí es solo el filtro barato de
 * multer; la verdad sobre el contenido la decide `detectImageMime` en
 * upload.service.ts sobre el buffer real.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: MAX_FILES,
    fields: 12,
    fieldSize: 2_000,
    parts: 24,
  },
  fileFilter(_req, file, callback) {
    if (!ALLOWED_IMAGE_MIMES.includes(file.mimetype as never)) {
      callback(new AppError("Formato de imagen no soportado. Usa JPG, PNG o WEBP.", 400));
      return;
    }
    callback(null, true);
  },
});

/** Traduce un fallo de multer a un AppError con el status HTTP correcto — un upload gordo o mal formado nunca es un 500. */
function translateUploadError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return new AppError("Cada imagen debe pesar máximo 5 MB", 413);
    }
    return new AppError("Demasiadas imágenes o campo de archivo inesperado", 400);
  }

  return new AppError("No se pudo procesar el archivo enviado", 400);
}

function uploadImageArray(field: string, maxCount: number): RequestHandler {
  const handler = upload.array(field, maxCount);
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, (error: unknown) => {
      if (error) {
        next(translateUploadError(error));
        return;
      }
      next();
    });
  };
}

function uploadSingleImage(field: string): RequestHandler {
  const handler = upload.single(field);
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, (error: unknown) => {
      if (error) {
        next(translateUploadError(error));
        return;
      }
      next();
    });
  };
}

export { uploadImageArray, uploadSingleImage };
