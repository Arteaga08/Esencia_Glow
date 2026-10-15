import type { AdminHomeOfferBanner, AdminHomePageCovers, HomePageCoverKey } from "@esencia-glow/shared";
import type { HeroImageDraft } from "./hero-form-value";

/**
 * Páginas con foto de encabezado. `sale` (/ofertas) se guarda en la sección
 * del banner de oferta (`offerBanner.images.page`), que ya no es un bloque del
 * home; las demás, en `pageCovers`.
 */
type PageCoverSlot = HomePageCoverKey | "sale";

/** Las páginas con foto de encabezado, en el orden en que se muestran en el editor. */
const PAGE_COVERS: { key: PageCoverSlot; label: string; href: string }[] = [
  { key: "bestsellers", label: "Más vendidos", href: "/mas-vendidos" },
  { key: "kits", label: "Kits", href: "/kits" },
  { key: "sale", label: "Ofertas", href: "/ofertas" },
];

type PageCoversFormValue = Record<PageCoverSlot, HeroImageDraft>;

function toFormValue(section: AdminHomePageCovers, offerBanner: AdminHomeOfferBanner): PageCoversFormValue {
  return {
    kits: { existing: section.images.kits, removed: false },
    bestsellers: { existing: section.images.bestsellers, removed: false },
    sale: { existing: offerBanner.images.page, removed: false },
  };
}

/** Huella de lo mostrado: sirve para saber si hay cambios sin guardar. */
function fingerprint(value: PageCoversFormValue): string {
  return JSON.stringify(
    PAGE_COVERS.map(({ key }) => ({
      file: value[key].file ? `${value[key].file!.name}:${value[key].file!.size}` : null,
      removed: value[key].removed,
    })),
  );
}

export { PAGE_COVERS, toFormValue, fingerprint };
export type { PageCoversFormValue, PageCoverSlot };
