"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Ticket } from "@phosphor-icons/react";
import { CouponKind, type AdminCoupon } from "@esencia-glow/shared";
import { Badge } from "@/components/ui/badge";
import { getButtonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, type TableColumn } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useDebouncedValue } from "@/components/inventory/use-debounced-value";
import { CouponStatusCell } from "@/components/coupons/coupon-status-cell";
import { useCouponList } from "@/components/coupons/use-coupon-list";
import { apiRequest, ApiRequestError } from "@/lib/api";
import { ADMIN_ROUTES } from "@/lib/admin-routes";
import { describeCouponDiscount, describeCouponUsage, describeCouponValidity } from "@/lib/coupon-labels";

const ITEM_LABEL = { singular: "cupón", plural: "cupones" };

const KIND_OPTIONS = [
  { value: "", label: "Todos" },
  { value: CouponKind.PUBLIC, label: "Públicos" },
  { value: CouponKind.PERSONAL, label: "Personales" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "active", label: "Activados" },
  { value: "inactive", label: "Desactivados" },
];

/**
 * Milestone 3.7 — Cupones: tabla densa (mismo patrón que Clientes). Los
 * públicos se publican fuera de la tienda con límite de personas y de usos por
 * clienta; los personales nacen de "Dar cupón" en el detalle de una clienta.
 * Un cupón creado no se edita: solo se activa o desactiva con el interruptor,
 * y si falla el error se queda en su renglón.
 */
export default function CouponsPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [kind, setKind] = useState<CouponKind | null>(null);
  const [status, setStatus] = useState<"active" | "inactive" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const { items, meta, setPage, loadError, retry, replaceItem } = useCouponList({ search: debouncedSearch, kind, status });
  const isFiltered = Boolean(debouncedSearch || kind || status);

  async function handleToggle(coupon: AdminCoupon, isActive: boolean) {
    setBusyId(coupon.id);
    setRowErrors((current) => ({ ...current, [coupon.id]: "" }));
    try {
      const response = await apiRequest<AdminCoupon>(`/api/v1/admin/coupons/${coupon.id}`, { method: "PATCH", authenticated: true, body: { isActive } });
      replaceItem(response.data);
    } catch (error) {
      const message = error instanceof ApiRequestError ? error.message : "No pudimos cambiar el estado. Inténtalo de nuevo.";
      setRowErrors((current) => ({ ...current, [coupon.id]: message }));
      toast({ variant: "error", title: "No se pudo cambiar el cupón", description: coupon.code });
    } finally {
      setBusyId(null);
    }
  }

  const columns: TableColumn<AdminCoupon>[] = [
    {
      header: "Código",
      render: (row) => (
        <div>
          <span className="block font-mono text-data text-foreground">{row.code}</span>
          {row.assignedUser ? (
            <Link href={ADMIN_ROUTES.customer(row.assignedUser.id)} className="block text-body-sm text-muted-foreground-strong hover:underline focus-visible:underline">
              {row.assignedUser.firstName} {row.assignedUser.lastName}
            </Link>
          ) : row.description ? (
            <span className="block text-body-sm text-muted-foreground-strong">{row.description}</span>
          ) : null}
          {rowErrors[row.id] ? <span className="block text-body-sm text-destructive-action">{rowErrors[row.id]}</span> : null}
        </div>
      ),
    },
    {
      header: "Clase",
      render: (row) => <Badge color={row.kind === CouponKind.PUBLIC ? "primary" : "neutral"}>{row.kind === CouponKind.PUBLIC ? "Público" : "Personal"}</Badge>,
    },
    { header: "Descuento", render: (row) => describeCouponDiscount(row) },
    { header: "Uso", render: (row) => describeCouponUsage(row) },
    { header: "Vigencia", render: (row) => describeCouponValidity(row) },
    { header: "Estado", render: (row) => <CouponStatusCell coupon={row} busy={busyId === row.id} onToggle={handleToggle} /> },
  ];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-page-title text-foreground">Cupones</h2>
          <p className="text-body text-muted-foreground-strong">
            Los públicos se comparten fuera de la tienda. Para dar uno personal, entra al detalle de una clienta.
          </p>
        </div>
        <Link href={ADMIN_ROUTES.couponNew} className={getButtonClassName("primary")}>
          <Plus size={16} aria-hidden="true" />
          Nuevo cupón
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-start gap-4">
        <div className="w-72">
          <Input label="Buscar" placeholder="Busca por código, por ejemplo BIENVENIDA" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="w-44">
          <Select label="Clase" value={kind ?? ""} onChange={(value) => setKind((value || null) as CouponKind | null)} options={KIND_OPTIONS} />
        </div>
        <div className="w-44">
          <Select label="Estado" value={status ?? ""} onChange={(value) => setStatus((value || null) as "active" | "inactive" | null)} options={STATUS_OPTIONS} />
        </div>
      </div>

      <Card className="p-0">
        {loadError ? (
          <div className="p-6">
            <ErrorState description={loadError} onRetry={retry} />
          </div>
        ) : items === null ? (
          <div className="flex flex-col gap-2 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title={isFiltered ? "Sin resultados" : "Todavía no hay cupones"}
            description={isFiltered ? "Ningún cupón coincide con esos filtros." : "Crea el primero con «Nuevo cupón», o dale uno a una clienta desde su detalle."}
          />
        ) : (
          <div className="p-2">
            <Table columns={columns} rows={items} rowKey={(row) => row.id} />
          </div>
        )}
      </Card>

      {meta ? <Pagination meta={meta} onPageChange={setPage} itemLabel={ITEM_LABEL} /> : null}
    </div>
  );
}
