import type { AdminHomePageCovers, HomePageCoverKey } from "@esencia-glow/shared";
import type { HeroImageDraft } from "./hero-form-value";

/** Las páginas con foto de encabezado, en el orden en que se muestran en el editor. */
const PAGE_COVERS: { key: HomePageCoverKey; label: string; href: string }[] = [
  { key: "bestsellers", label: "Más vendidos", href: "/mas-vendidos" },
  { key: "kits", label: "Kits", href: "/kits" },
];

type PageCoversFormValue = Record<HomePageCoverKey, HeroImageDraft>;

function toFormValue(section: AdminHomePageCovers): PageCoversFormValue {
  return {
    kits: { existing: section.images.kits, removed: false },
    bestsellers: { existing: section.images.bestsellers, removed: false },
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
export type { PageCoversFormValue };
