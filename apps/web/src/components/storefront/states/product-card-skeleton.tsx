import { SkeletonBlock } from "./skeleton-block";

/**
 * Silueta de `ShelfCard`: foto 4:5 (o cuadrada si es `compact`), marca, nombre
 * con precio, presentación y una línea de resumen (la compacta no la lleva).
 * Mismas proporciones que la tarjeta real para que al llegar los datos nada se
 * mueva. Reutilizable por el catálogo.
 */
function ProductCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex h-full flex-col">
      <SkeletonBlock className={`w-full ${compact ? "aspect-square" : "aspect-[4/5]"}`} />
      <div className="pt-4">
        <SkeletonBlock className="mb-2 h-3 w-16" />
        <div className="flex items-baseline justify-between gap-3">
          <SkeletonBlock className="h-5 w-3/5" />
          <SkeletonBlock className="h-5 w-14" />
        </div>
        <SkeletonBlock className="mt-2 h-4 w-24" />
        {compact ? null : <SkeletonBlock className="mt-2 h-4 w-4/5" />}
      </div>
    </div>
  );
}

export { ProductCardSkeleton };
