import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KitDetail } from "@/components/storefront/kit/kit-detail";
import { ErrorState } from "@/components/ui/error-state";
import { getKit, getKitAvailability } from "@/lib/storefront/kit";
import { toKitView } from "@/lib/storefront/kit-view";

interface KitPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: KitPageProps): Promise<Metadata> {
  const { slug } = await params;
  const lookup = await getKit(slug);
  if (lookup.kind !== "found") return { title: "Kit no encontrado" };

  const { bundle } = lookup;
  const image = bundle.images[0] ?? bundle.items.find((item) => item.image)?.image;
  return {
    title: `${bundle.name} | Esencia Glow`,
    description: bundle.description,
    openGraph: image ? { images: [{ url: image.url, width: image.width, height: image.height }] } : undefined,
  };
}

/**
 * Detalle de un kit: galería, compra y lo que incluye. Si el slug no existe
 * es un 404; si el API no responde se muestra un error, no un 404.
 */
export default async function KitPage({ params }: KitPageProps) {
  const { slug } = await params;
  const [lookup, available] = await Promise.all([getKit(slug), getKitAvailability(slug)]);

  if (lookup.kind === "not-found") notFound();
  if (lookup.kind === "error") {
    return (
      <main className="mx-auto max-w-shell px-4 pt-32 pb-20 md:px-8 xl:px-12">
        <ErrorState title="No pudimos cargar el kit" description="Intenta de nuevo en unos minutos." />
      </main>
    );
  }

  return <KitDetail kit={toKitView(lookup.bundle, available)} />;
}
