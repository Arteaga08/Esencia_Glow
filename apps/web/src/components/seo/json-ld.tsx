import { serializeJsonLd, type JsonLd } from "@/lib/seo/json-ld";

interface JsonLdScriptProps {
  data: JsonLd;
}

/** Inserta datos estructurados de schema.org para los buscadores. No pinta nada. */
function JsonLdScript({ data }: JsonLdScriptProps) {
  // `serializeJsonLd` escapa `<`, así que el contenido no puede cerrar la etiqueta.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}

export { JsonLdScript };
