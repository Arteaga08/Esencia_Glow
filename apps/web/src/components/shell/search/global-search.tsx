"use client";

import { MagnifyingGlass, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useDebouncedValue } from "../../inventory/use-debounced-value";
import { Skeleton } from "../../ui/skeleton";
import { flattenResults, type SearchItem } from "./search-items";
import { SearchResultRow } from "./search-result-row";
import { GLOBAL_SEARCH_MIN_LENGTH, useGlobalSearch, type SearchGroup } from "./use-global-search";

const GROUP_LABELS = { order: "Pedidos", customer: "Clientes", product: "Productos" } as const;
const NOTE = "px-3 py-2 text-body-sm text-muted-foreground-strong";

/**
 * Buscador de la barra superior: pedidos (número, comprador, teléfono), clientes
 * (nombre, correo) y productos (nombre, SKU) en un solo campo. Es un combobox:
 * las flechas recorren los resultados, Enter abre el resaltado y Escape cierra.
 * En móvil solo se ve la lupa; al tocarla el campo ocupa todo el ancho de la barra.
 */
function GlobalSearch() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const term = useDebouncedValue(text.trim().replace(/\s+/g, " "));
  const typedEnough = text.trim().length >= GLOBAL_SEARCH_MIN_LENGTH;
  const { results, loading } = useGlobalSearch(term);
  const items = flattenResults(results);
  const waiting = typedEnough && (loading || term !== text.trim().replace(/\s+/g, " "));
  const empty = typedEnough && !waiting && items.length === 0;
  const allFailed = results.orders.failed && results.customers.failed && results.products.failed;
  const activeItem = items[highlighted];

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function close() {
    setOpen(false);
    setMobileOpen(false);
  }

  function choose(item: SearchItem) {
    close();
    setText("");
    router.push(item.href);
  }

  function handleChange(value: string) {
    setText(value);
    setHighlighted(0);
    setOpen(true);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      close();
      return;
    }
    if (items.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlighted((index) => (index + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((index) => (index - 1 + items.length) % items.length);
    } else if (event.key === "Enter" && activeItem && open) {
      event.preventDefault();
      choose(activeItem);
    }
  }

  function openMobile() {
    setMobileOpen(true);
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function renderGroup(kind: SearchItem["kind"], group: SearchGroup<unknown>) {
    const groupItems = items.filter((item) => item.kind === kind);
    if (groupItems.length === 0 && !group.failed) return null;
    return (
      <li key={kind} role="presentation">
        <p className="px-3 pb-1 pt-2 font-mono text-label uppercase text-muted-foreground-strong">{GROUP_LABELS[kind]}</p>
        {group.failed ? (
          <p className={NOTE}>No pudimos buscar en {GROUP_LABELS[kind].toLowerCase()}.</p>
        ) : (
          <ul role="presentation">
            {groupItems.map((item) => (
              <li key={item.id} role="presentation">
                <Link
                  id={`${listId}-${item.id}`}
                  role="option"
                  aria-selected={item.id === activeItem?.id}
                  href={item.href}
                  tabIndex={-1}
                  onMouseEnter={() => setHighlighted(items.indexOf(item))}
                  onClick={(event) => {
                    event.preventDefault();
                    choose(item);
                  }}
                  className={`flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2 ${item.id === activeItem?.id ? "bg-muted" : ""}`}
                >
                  <SearchResultRow item={item} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <div
      ref={rootRef}
      className={mobileOpen ? "absolute inset-x-0 top-0 z-30 flex h-16 items-center bg-surface px-4" : "relative"}
    >
      <button
        type="button"
        onClick={openMobile}
        aria-label="Buscar en el panel"
        className="cursor-pointer rounded-md p-2 text-muted-foreground-strong hover:bg-muted hover:text-foreground sm:hidden"
        hidden={mobileOpen}
      >
        <MagnifyingGlass size={20} weight="regular" aria-hidden="true" />
      </button>

      <div
        className={`${mobileOpen ? "flex w-full" : "hidden sm:flex"} items-center gap-2 rounded-md border border-border-strong bg-input px-3 py-1.5 focus-within:border-primary-action`}
      >
        <MagnifyingGlass size={16} weight="regular" aria-hidden="true" className="shrink-0 text-muted-foreground-strong" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label="Buscar pedidos, clientes o productos"
          aria-expanded={open && typedEnough}
          aria-controls={listId}
          aria-activedescendant={activeItem ? `${listId}-${activeItem.id}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          value={text}
          maxLength={80}
          placeholder="EG-1042, ana@correo.com, sérum…"
          onChange={(event) => handleChange(event.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full min-w-0 bg-transparent text-body text-foreground outline-none placeholder:text-muted-foreground sm:w-64"
        />
        {text ? (
          <button
            type="button"
            aria-label="Borrar búsqueda"
            onClick={() => {
              setText("");
              inputRef.current?.focus();
            }}
            className="cursor-pointer text-muted-foreground-strong hover:text-foreground"
          >
            <X size={14} aria-hidden="true" />
          </button>
        ) : null}
        {mobileOpen ? (
          <button type="button" onClick={close} className="cursor-pointer pl-1 text-body-sm text-foreground sm:hidden">
            Cerrar
          </button>
        ) : null}
      </div>

      {open && typedEnough ? (
        <div
          className={`${mobileOpen ? "left-4 right-4 top-14" : "right-0 top-full"} absolute z-30 mt-2 max-h-[70vh] overflow-y-auto rounded-md border border-border-strong bg-surface p-1 shadow-overlay sm:w-[28rem]`}
          style={{ "--surface-bg": "var(--color-surface)" } as React.CSSProperties}
        >
          {waiting ? (
            <div aria-hidden="true" className="flex flex-col gap-2 p-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-5 w-3/5" />
            </div>
          ) : allFailed ? (
            <p role="alert" className={NOTE}>
              No pudimos buscar en este momento. Intenta de nuevo.
            </p>
          ) : empty ? (
            <p className={NOTE}>No encontramos nada con «{term}». Prueba con un número de pedido, un correo o el nombre de un producto.</p>
          ) : (
            <ul id={listId} role="listbox" aria-label="Resultados">
              {renderGroup("order", results.orders)}
              {renderGroup("customer", results.customers)}
              {renderGroup("product", results.products)}
            </ul>
          )}
          <p role="status" className="sr-only">
            {!waiting && typedEnough ? `${items.length} resultados` : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export { GlobalSearch };
