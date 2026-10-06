"use client";

import Image from "next/image";
import Link from "next/link";
import { Star } from "@phosphor-icons/react";
import { useState } from "react";
import { MAX_WISHLIST_ITEMS, type WishlistItem } from "@esencia-glow/shared";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoneyMXN } from "@/lib/format-money";
import { accountRequest } from "@/lib/storefront/account-api";
import { classifyError } from "@/lib/storefront/auth-errors";
import { Notice } from "../shared/frame";
import { CTA_PRIMARY, CTA_SECONDARY, ROW_ACTION } from "../shared/styles";

interface SavedCardProps {
  item: WishlistItem;
  removing: boolean;
  onRemove: () => void;
}

function SavedCard({ item, removing, onRemove }: SavedCardProps) {
  return (
    <li className="flex flex-col rounded-md border border-border-strong bg-surface p-3">
      <Link href={`/producto/${item.slug}`} className="block">
        <div className={`relative aspect-[4/5] overflow-hidden rounded-md bg-muted ${item.available ? "" : "opacity-60"}`}>
          {item.image ? (
            <Image src={item.image.url} alt="" fill sizes="(min-width: 1280px) 20vw, (min-width: 640px) 33vw, 50vw" className="object-cover" />
          ) : (
            <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center font-mono text-section-title text-muted-foreground-strong">
              {item.name.charAt(0)}
            </span>
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-1 px-1 pt-3">
        {item.brand ? <p className="font-mono text-label uppercase text-muted-foreground-strong">{item.brand}</p> : null}
        <p className="text-body text-foreground">{item.name}</p>
        {item.variantLabel ? <p className="text-body-sm text-muted-foreground-strong">{item.variantLabel}</p> : null}
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="flex items-baseline gap-2 font-mono text-data text-foreground">
            {formatMoneyMXN(item.priceCents)}
            {item.listPriceCents ? <span className="text-muted-foreground-strong line-through">{formatMoneyMXN(item.listPriceCents)}</span> : null}
          </p>
          {item.available ? null : <Badge color="warning">Sin existencias</Badge>}
        </div>
        <Link href={`/producto/${item.slug}`} className={`${CTA_PRIMARY} mt-3 !h-11 w-full`}>
          Ver producto
        </Link>
        <button type="button" onClick={onRemove} disabled={removing} className={`${ROW_ACTION} mt-1 gap-1.5 self-start`}>
          <Star size={16} weight="fill" aria-hidden="true" />
          {removing ? "Quitando…" : "Quitar de guardados"}
        </button>
      </div>
    </li>
  );
}

/** Guardados: tarjetas con foto, o estado vacío. Quitar es inmediato; se guarda desde la ficha de producto. */
function SavedSection({ initial }: { initial: WishlistItem[] }) {
  const [items, setItems] = useState(initial);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove(item: WishlistItem) {
    setRemovingId(item.itemId);
    setError(null);
    try {
      await accountRequest(`/api/v1/account/wishlist/${item.itemType}/${item.itemId}`, { method: "DELETE" });
      setItems((current) => current.filter((candidate) => candidate.itemId !== item.itemId));
    } catch (caught) {
      setError(classifyError(caught).message);
    } finally {
      setRemovingId(null);
    }
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Star}
        title="No has guardado nada"
        description="Toca la estrella en cualquier producto para tenerlo aquí cuando quieras volver a verlo."
        action={
          <Link href="/" className={CTA_SECONDARY}>
            Explorar la tienda
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="font-mono text-label uppercase text-muted-foreground-strong">
        {items.length} de {MAX_WISHLIST_ITEMS} guardados
      </p>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <ul className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        {items.map((item) => (
          <SavedCard key={item.itemId} item={item} removing={removingId === item.itemId} onRemove={() => handleRemove(item)} />
        ))}
      </ul>
    </div>
  );
}

export { SavedSection };
