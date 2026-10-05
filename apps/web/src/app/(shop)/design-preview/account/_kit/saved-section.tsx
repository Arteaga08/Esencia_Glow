import Image from "next/image";
import Link from "next/link";
import { Heart } from "@phosphor-icons/react/ssr";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoneyMXN } from "@/lib/format-money";
import type { DemoProduct } from "./fixture";
import { Item, ItemList, Thumb, type Tone } from "./frame";
import { CTA_DISABLED, CTA_PRIMARY, CTA_SECONDARY, ROW_ACTION } from "./styles";

const MAX_SAVED = 50;

interface SavedSectionProps {
  tone: Tone;
  state: string | null;
  saved: DemoProduct[];
}

function Price({ product }: { product: DemoProduct }) {
  return (
    <p className="flex items-baseline gap-2 font-mono text-data text-foreground">
      {formatMoneyMXN(product.priceCents)}
      {product.listPriceCents ? <span className="text-muted-foreground-strong line-through">{formatMoneyMXN(product.listPriceCents)}</span> : null}
    </p>
  );
}

function BuyButton({ product, className }: { product: DemoProduct; className: string }) {
  return product.available ? (
    <button type="button" className={`${CTA_PRIMARY} ${className}`}>
      Agregar al carrito
    </button>
  ) : (
    <span className={`${CTA_DISABLED} ${className}`} aria-disabled="true">
      Agotado
    </span>
  );
}

/** Tarjeta con foto grande (A). */
function SavedCard({ product }: { product: DemoProduct }) {
  return (
    <li className="flex flex-col rounded-md border border-border-strong bg-surface p-3">
      <div className={`relative aspect-[4/5] overflow-hidden rounded-md bg-muted ${product.available ? "" : "opacity-60"}`}>
        {product.image ? (
          <Image src={product.image.url} alt="" fill sizes="(min-width: 1280px) 20vw, (min-width: 640px) 33vw, 50vw" className="object-cover" />
        ) : (
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center font-mono text-section-title text-muted-foreground-strong">
            {product.name.charAt(0)}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 px-1 pt-3">
        {product.brand ? <p className="font-mono text-label uppercase text-muted-foreground-strong">{product.brand}</p> : null}
        <p className="text-body text-foreground">{product.name}</p>
        <p className="text-body-sm text-muted-foreground-strong">{product.variantLabel}</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <Price product={product} />
          {product.available ? null : <Badge color="warning">Sin existencias</Badge>}
        </div>
        <BuyButton product={product} className="mt-3 !h-11 w-full" />
        <button type="button" className={`${ROW_ACTION} mt-1 gap-1.5 self-start`}>
          <Heart size={16} weight="fill" aria-hidden="true" />
          Quitar de guardados
        </button>
      </div>
    </li>
  );
}

/** Renglón con miniatura (B y C). */
function SavedRow({ tone, product }: { tone: Tone; product: DemoProduct }) {
  return (
    <Item tone={tone} className="flex items-center gap-4">
      <Thumb product={product} className="h-24 w-[76px]" sizes="76px" />
      <div className="min-w-0 flex-1">
        {product.brand ? <p className="font-mono text-label uppercase text-muted-foreground-strong">{product.brand}</p> : null}
        <p className="truncate text-body text-foreground">{product.name}</p>
        <p className="text-body-sm text-muted-foreground-strong">{product.variantLabel}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3">
          <Price product={product} />
          {product.available ? null : <Badge color="warning">Sin existencias</Badge>}
        </div>
        <button type="button" className={`${ROW_ACTION} -ml-1 gap-1.5`}>
          <Heart size={16} weight="fill" aria-hidden="true" />
          Quitar
        </button>
      </div>
      <BuyButton product={product} className="hidden !h-11 sm:inline-flex" />
    </Item>
  );
}

/** Guardados: lista, vacía y con un producto agotado. */
function SavedSection({ tone, state, saved }: SavedSectionProps) {
  if (state === "vacia") {
    return (
      <EmptyState
        icon={Heart}
        title="No has guardado nada"
        description="Toca el corazón en cualquier producto para tenerlo aquí cuando quieras volver a verlo."
        action={
          <Link href="/" className={CTA_SECONDARY}>
            Explorar la tienda
          </Link>
        }
      />
    );
  }

  // El estado base muestra todo disponible; `agotado` deja uno sin existencias.
  const items = saved.map((product, index) => ({ ...product, available: state === "agotado" ? index !== 1 : true }));

  return (
    <div className="flex flex-col gap-5">
      <p className="font-mono text-label uppercase text-muted-foreground-strong">
        {items.length} de {MAX_SAVED} guardados
      </p>
      {tone === "card" ? (
        <ul className="grid grid-cols-2 gap-4 xl:grid-cols-3">
          {items.map((product) => (
            <SavedCard key={product.id} product={product} />
          ))}
        </ul>
      ) : (
        <ItemList tone={tone}>
          {items.map((product) => (
            <SavedRow key={product.id} tone={tone} product={product} />
          ))}
        </ItemList>
      )}
    </div>
  );
}

export { SavedSection };
