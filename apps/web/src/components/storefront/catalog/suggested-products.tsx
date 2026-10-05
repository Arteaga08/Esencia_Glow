"use client";

import { useEffect, useRef, useState } from "react";
import { readBrowsingSignals, recordBrowsing } from "@/lib/storefront/browsing-history";
import { pickSuggestions, type PickedSuggestions, type SuggestionPayload } from "@/lib/storefront/suggestion-picker";
import { SuggestedSection } from "./suggested-section";

interface SuggestedProductsProps {
  categorySlug: string;
  /** Marcas filtradas ahora mismo: filtrar por una marca cuenta como interés en ella. */
  activeBrands: string[];
  /** Productos ya visibles en la rejilla: no se sugieren de nuevo. */
  excludeIds: string[];
}

const TITLES: Record<PickedSuggestions["kind"], string> = {
  personalized: "Sugeridos para ti",
  bestsellers: "Más vendidos",
  newest: "Lo más nuevo",
};

/**
 * Bloque de sugeridos bajo el catálogo. Anota en el navegador la visita a la
 * categoría y las marcas filtradas, y con ese historial pide sugerencias. La
 * primera vez (sin historial) muestra los más vendidos. Se pinta solo cuando
 * ya hay tarjetas: está al final de la página, así que no mueve el contenido
 * que la clienta está viendo. Si la petición falla, simplemente no aparece.
 */
function SuggestedProducts({ categorySlug, activeBrands, excludeIds }: SuggestedProductsProps) {
  const [picked, setPicked] = useState<PickedSuggestions | null>(null);
  const countedBrands = useRef(new Set<string>());
  const brandsKey = activeBrands.join(",");
  const excludeKey = excludeIds.join(",");

  // Una visita por categoría abierta (no por cada cambio de filtro o de página).
  useEffect(() => {
    recordBrowsing({ category: categorySlug });
    countedBrands.current = new Set();
  }, [categorySlug]);

  useEffect(() => {
    // Cada marca cuenta una vez por visita, aunque se quite y se vuelva a poner.
    const newBrands = brandsKey ? brandsKey.split(",").filter((brand) => !countedBrands.current.has(brand)) : [];
    if (newBrands.length > 0) {
      newBrands.forEach((brand) => countedBrands.current.add(brand));
      recordBrowsing({ brands: newBrands });
    }

    const controller = new AbortController();
    const signals = readBrowsingSignals();
    const query = new URLSearchParams();
    if (signals.categories.length > 0) query.set("categorias", signals.categories.join(","));
    if (signals.brands.length > 0) query.set("marcas", signals.brands.join(","));

    fetch(`/api/storefront/suggestions?${query}`, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<SuggestionPayload>) : null))
      .then((payload) => {
        if (payload) setPicked(pickSuggestions(payload, excludeKey ? excludeKey.split(",") : []));
      })
      .catch(() => {
        // Sin sugerencias el catálogo sigue completo; no hay nada que avisar.
      });
    return () => controller.abort();
  }, [categorySlug, brandsKey, excludeKey]);

  if (!picked || picked.items.length === 0) return null;
  return <SuggestedSection title={TITLES[picked.kind]} items={picked.items} />;
}

export { SuggestedProducts };
