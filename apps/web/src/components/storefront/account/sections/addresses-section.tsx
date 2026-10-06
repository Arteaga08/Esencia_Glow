"use client";

import { MapPin } from "@phosphor-icons/react";
import { useState } from "react";
import { MAX_ADDRESSES, type AccountDto, type SavedAddress } from "@esencia-glow/shared";
import { Badge } from "@/components/ui/badge";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { accountRequest } from "@/lib/storefront/account-api";
import { classifyError } from "@/lib/storefront/auth-errors";
import { formatPhone } from "../shared/dates";
import { Block, Item, ItemList, Notice } from "../shared/frame";
import { CTA_DISABLED, CTA_PRIMARY, CTA_SECONDARY, ROW_ACTION } from "../shared/styles";
import { AddressForm } from "./address-form";

type View = { kind: "list" } | { kind: "form"; address?: SavedAddress };

interface AddressItemProps {
  address: SavedAddress;
  busy: boolean;
  onEdit: () => void;
  onMakeDefault: () => void;
  onDelete: () => void;
}

function AddressItem({ address, busy, onEdit, onMakeDefault, onDelete }: AddressItemProps) {
  const street = [address.street, address.exteriorNumber, address.interiorNumber].filter(Boolean).join(" ");

  return (
    <Item className="flex flex-col gap-3">
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
        {address.references ? <p className="text-body-sm text-muted-foreground-strong">{address.references}</p> : null}
        <p className="mt-1 font-mono text-data text-muted-foreground-strong">{formatPhone(address.phone)}</p>
      </address>
      <div className="-mx-1 mt-auto flex flex-wrap items-center gap-x-3">
        <button type="button" onClick={onEdit} disabled={busy} className={ROW_ACTION}>
          Editar
        </button>
        {address.isDefault ? null : (
          <button type="button" onClick={onMakeDefault} disabled={busy} className={ROW_ACTION}>
            Hacer principal
          </button>
        )}
        <button type="button" onClick={onDelete} disabled={busy} className={ROW_ACTION}>
          Eliminar
        </button>
      </div>
    </Item>
  );
}

/** Libreta de direcciones: lista, vacía, formulario de alta/edición y tope de 5. */
function AddressesSection({ initial }: { initial: SavedAddress[] }) {
  const [addresses, setAddresses] = useState(initial);
  const [view, setView] = useState<View>({ kind: "list" });
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<SavedAddress | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /** Cada cambio vuelve a leer la libreta: el servidor decide cuál es la principal. */
  async function reload() {
    const result = await accountRequest<AccountDto>("/api/v1/account");
    setAddresses(result.data.addresses);
  }

  async function handleSaved(message: string) {
    await reload().catch(() => undefined);
    setView({ kind: "list" });
    setNotice({ tone: "success", text: message });
  }

  async function handleMakeDefault(address: SavedAddress) {
    setBusy(true);
    setNotice(null);
    try {
      await accountRequest(`/api/v1/account/addresses/${address.id}/default`, { method: "POST" });
      // La mutación ya se aplicó: si la relectura falla, ajusta la lista en local.
      await reload().catch(() => setAddresses((current) => current.map((item) => ({ ...item, isDefault: item.id === address.id }))));
      setNotice({ tone: "success", text: `“${address.label}” es ahora tu dirección principal.` });
    } catch (caught) {
      setNotice({ tone: "danger", text: classifyError(caught).message });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    setBusy(true);
    setDeleteError(null);
    try {
      const deletedId = toDelete.id;
      await accountRequest(`/api/v1/account/addresses/${deletedId}`, { method: "DELETE" });
      // La baja ya se aplicó: si la relectura falla, quita la dirección en local.
      await reload().catch(() => setAddresses((current) => current.filter((item) => item.id !== deletedId)));
      setNotice({ tone: "success", text: "Eliminamos la dirección." });
      setToDelete(null);
    } catch (caught) {
      setDeleteError(classifyError(caught).message);
    } finally {
      setBusy(false);
    }
  }

  if (view.kind === "form") {
    return (
      <Block title={view.address ? "Editar dirección" : "Nueva dirección"}>
        <AddressForm
          address={view.address}
          isFirst={addresses.length === 0}
          onSaved={() => handleSaved(view.address ? "Guardamos los cambios de la dirección." : "Guardamos tu dirección.")}
          onCancel={() => setView({ kind: "list" })}
        />
      </Block>
    );
  }

  const full = addresses.length >= MAX_ADDRESSES;
  const add = () => {
    setNotice(null);
    setView({ kind: "form" });
  };

  if (addresses.length === 0) {
    return (
      <>
        {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
        <EmptyState
          icon={MapPin}
          title="Aún no tienes direcciones"
          description="Guarda una y la verás lista al pagar, sin volver a escribirla."
          action={
            <button type="button" onClick={add} className={CTA_SECONDARY}>
              Agregar dirección
            </button>
          }
        />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-label uppercase text-muted-foreground-strong">
          {addresses.length} de {MAX_ADDRESSES} direcciones
        </p>
        {full ? (
          <span className={CTA_DISABLED} aria-disabled="true">
            Agregar dirección
          </span>
        ) : (
          <button type="button" onClick={add} className={CTA_PRIMARY}>
            Agregar dirección
          </button>
        )}
      </div>
      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
      {full ? <Notice tone="warning">Llegaste al máximo de {MAX_ADDRESSES} direcciones. Elimina una para poder agregar otra.</Notice> : null}
      <ItemList columns>
        {addresses.map((address) => (
          <AddressItem
            key={address.id}
            address={address}
            busy={busy}
            onEdit={() => {
              setNotice(null);
              setView({ kind: "form", address });
            }}
            onMakeDefault={() => handleMakeDefault(address)}
            onDelete={() => {
              setDeleteError(null);
              setToDelete(address);
            }}
          />
        ))}
      </ItemList>

      <ConfirmModal
        open={toDelete !== null}
        title="Eliminar dirección"
        confirmLabel="Eliminar"
        variant="destructive"
        loading={busy}
        error={deleteError}
        onCancel={() => setToDelete(null)}
        onConfirm={handleDelete}
      >
        <p className="text-body text-foreground/80">
          Vas a eliminar “{toDelete?.label}”.{toDelete?.isDefault && addresses.length > 1 ? " Otra de tus direcciones pasará a ser la principal." : ""} Tus pedidos anteriores no cambian.
        </p>
      </ConfirmModal>
    </div>
  );
}

export { AddressesSection };
