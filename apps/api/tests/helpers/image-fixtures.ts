import sharp from "sharp";

/**
 * Genera buffers de imagen en tiempo de test — cero binarios versionados.
 */
async function pngBuffer(width = 20, height = 20): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

/** JPEG con EXIF (orientación + GPS simulado) para probar que el pipeline lo elimina. */
async function jpegWithExifBuffer(): Promise<Buffer> {
  const base = await sharp({
    create: { width: 30, height: 20, channels: 3, background: { r: 0, g: 255, b: 0 } },
  })
    .jpeg()
    .toBuffer();

  return sharp(base)
    .withExifMerge({
      IFD0: { Make: "TestCam" },
      GPS: { GPSLatitude: "19/1,25/1,0/1" },
    })
    .jpeg()
    .toBuffer();
}

function notAnImageBuffer(): Buffer {
  return Buffer.from("esto no es una imagen, es texto plano disfrazado");
}

export { pngBuffer, jpegWithExifBuffer, notAnImageBuffer };
