"use client";

import { useState, type FormEvent } from "react";
import type { AdminOrder } from "@esencia-glow/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format-date";
import { useOrderNotes } from "./use-order-notes";

interface OrderNotesCardProps {
  orderId: string;
  onOrderUpdated: (order: AdminOrder) => void;
  onOrderChanged: () => void;
}

/** El backend nunca expone el cuerpo de las notas en `AdminOrder` (solo
 * `internalNotesCount`) — este bloque es el único lugar del panel donde se
 * leen, vía `GET /:id/notes` (Milestone 2.3b). */
function OrderNotesCard({ orderId, onOrderUpdated, onOrderChanged }: OrderNotesCardProps) {
  const { notes, loadError, saving, fieldError, setFieldError, addNote } = useOrderNotes(orderId, onOrderUpdated);
  const [draft, setDraft] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) {
      setFieldError("Escribe algo antes de guardar la nota.");
      return;
    }
    const ok = await addNote(draft.trim());
    if (ok) {
      setDraft("");
      onOrderChanged();
    }
  }

  return (
    <Card>
      <p className="mb-4 font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">
        Notas internas {notes ? `(${notes.length})` : ""}
      </p>

      {loadError ? (
        <ErrorState description={loadError} />
      ) : notes === null ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.length === 0 ? (
            <li className="text-body-sm text-muted-foreground">Este pedido todavía no tiene notas.</li>
          ) : (
            notes.map((note, index) => (
              <li key={`${note.at}-${index}`} className="border-b border-border pb-3 last:border-b-0 last:pb-0">
                <p className="text-body-sm text-muted-foreground-strong">
                  {note.author ? `${note.author.firstName} ${note.author.lastName}` : "Admin (cuenta eliminada)"} ·{" "}
                  {formatDateTime(note.at)}
                </p>
                <p className="mt-0.5 text-body text-foreground">{note.body}</p>
              </li>
            ))
          )}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
        <Textarea
          label="Nueva nota"
          placeholder="Cliente pidió cambiar el tono a Nude"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          error={fieldError ?? undefined}
          maxLength={2000}
        />
        <div>
          <Button type="submit" size="sm" loading={saving}>
            Agregar nota
          </Button>
        </div>
      </form>
    </Card>
  );
}

export { OrderNotesCard };
