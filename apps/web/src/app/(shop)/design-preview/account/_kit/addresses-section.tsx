import Link from "next/link";
import { MapPin } from "@phosphor-icons/react/ssr";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AddressForm } from "./address-form";
import { formatPhone } from "./dates";
import type { DemoAddress } from "./fixture";
import { Item, ItemList, Notice, type Tone } from "./frame";
import { previewHref } from "./preview-state";
import { CTA_DISABLED, CTA_PRIMARY, CTA_SECONDARY, ROW_ACTION, SURFACE_VARS } from "./styles";

const MAX_ADDRESSES = 5;

interface AddressesSectionProps {
  tone: Tone;
  state: string | null;
  base: string;
  addresses: DemoAddress[];
}

function AddressItem({ tone, address }: { tone: Tone; address: DemoAddress }) {
  const street = [address.street, address.exteriorNumber, address.interiorNumber].filter(Boolean).join(" ");

  return (
    <Item tone={tone} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{address.label}</Badge>
        {address.isDefault ? <Badge color="primary">Principal</Badge> : null}
      </div>
      <address className="text-body not-italic text-foreground">
        <p className="font-medium">{address.fullName}</p>
        <p className="text-foreground/80">{street}</p>
        <p className="text-foreground/80">
          {address.neighborhood}, {address.city}, {address.state}, {address.postalCode}
        </p>
        <p className="mt-1 font-mono text-data text-muted-foreground-strong">{formatPhone(address.phone)}</p>
      </address>
      <div className="-mx-1 mt-auto flex flex-wrap items-center gap-x-3">
        <button type="button" className={ROW_ACTION}>
          Editar
        </button>
        {address.isDefault ? null : (
          <button type="button" className={ROW_ACTION}>
            Hacer principal
          </button>
        )}
        <button type="button" className={ROW_ACTION}>
          Eliminar
        </button>
      </div>
    </Item>
  );
}

/** Libreta de direcciones: lista, vacía, formulario y tope de 5. */
function AddressesSection({ tone, state, base, addresses }: AddressesSectionProps) {
  const list = previewHref(base, "direcciones");
  const add = previewHref(base, "direcciones", "formulario");

  if (state === "formulario") {
    return (
      <div className={tone === "card" ? "rounded-md border border-border-strong bg-surface p-5 md:p-6" : ""} style={tone === "card" ? SURFACE_VARS : undefined}>
        <h2 className="mb-5 text-section-title text-foreground">Nueva dirección</h2>
        <AddressForm saveHref={list} cancelHref={list} />
      </div>
    );
  }

  if (state === "vacia") {
    return (
      <EmptyState
        icon={MapPin}
        title="Aún no tienes direcciones"
        description="Guarda una y la verás lista al pagar, sin volver a escribirla."
        action={
          <Link href={add} className={CTA_SECONDARY}>
            Agregar dirección
          </Link>
        }
      />
    );
  }

  const full = state === "tope";
  const shown = full ? addresses.slice(0, MAX_ADDRESSES) : addresses.slice(0, 2);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-label uppercase text-muted-foreground-strong">
          {shown.length} de {MAX_ADDRESSES} direcciones
        </p>
        {full ? (
          <span className={CTA_DISABLED} aria-disabled="true">
            Agregar dirección
          </span>
        ) : (
          <Link href={add} className={CTA_PRIMARY}>
            Agregar dirección
          </Link>
        )}
      </div>
      {full ? <Notice tone="warning">Llegaste al máximo de {MAX_ADDRESSES} direcciones. Elimina una para poder agregar otra.</Notice> : null}
      <ItemList tone={tone} columns>
        {shown.map((address) => (
          <AddressItem key={address.id} tone={tone} address={address} />
        ))}
      </ItemList>
    </div>
  );
}

export { AddressesSection };
