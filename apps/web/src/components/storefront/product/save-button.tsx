"use client";

import { Star } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { WishlistMembership } from "@esencia-glow/shared";
import { ApiRequestError } from "@/lib/api";
import { accountRequest } from "@/lib/storefront/account-api";
import { classifyError } from "@/lib/storefront/auth-errors";
import { clearAnonymous, isKnownAnonymous, markAnonymous } from "@/lib/storefront/session-hint";
import { FOCUS } from "./product-styles";

interface SaveButtonProps {
  productId: string;
  slug: string;
  name: string;
  /** `lg` acompaña al botón de agregar dominante (14). */
  size?: "md" | "lg";
}

type SaveState = "unknown" | "unsaved" | "saved";

// La ficha es pública: si la sesión no se puede recuperar, este botón decide
// (estrella vacía / mandar a ingresar con regreso aquí), no `accountRequest`.
const QUIET = { redirectOnFailure: false } as const;

/**
 * Estrella de "guardar" de la ficha de producto (Mi cuenta → Guardados). Sin
 * sesión no pide nada al API de entrada (ver `session-hint`). Con el access
 * token vencido refresca en silencio (`accountRequest`): solo si el refresco
 * también falla se marca anónima y, al tocarla, manda a ingresar con
 * `?redirect=` de regreso a este producto.
 */
function SaveButton({ productId, slug, name, size = "md" }: SaveButtonProps) {
  const router = useRouter();
  const [state, setState] = useState<SaveState>("unknown");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    // Sin sesión ya conocida no se pregunta al API (ver `session-hint`).
    const lookup: Promise<SaveState> = isKnownAnonymous()
      ? Promise.resolve("unsaved")
      : accountRequest<WishlistMembership>(`/api/v1/account/wishlist?itemId=${productId}`, QUIET)
          .then((result): SaveState => {
            clearAnonymous();
            return result.data.saved ? "saved" : "unsaved";
          })
          .catch((error: unknown): SaveState => {
            // 401 que sobrevivió al refresco = sin sesión; 403 = una cuenta del equipo (no tiene guardados). Ambos: estrella vacía.
            if (error instanceof ApiRequestError && error.status === 401) markAnonymous();
            return "unsaved";
          });

    void lookup.then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  function goToLogin() {
    router.push(`/ingresar?redirect=${encodeURIComponent(`/producto/${slug}`)}`);
  }

  async function handleClick() {
    if (busy || state === "unknown") return;
    setBusy(true);
    setMessage("");
    try {
      if (state === "saved") {
        await accountRequest(`/api/v1/account/wishlist/product/${productId}`, { method: "DELETE", ...QUIET });
        setState("unsaved");
        setMessage("Quitado de guardados");
      } else {
        await accountRequest("/api/v1/account/wishlist", { method: "POST", body: { itemType: "product", itemId: productId }, ...QUIET });
        setState("saved");
        setMessage("Guardado en tu cuenta");
      }
    } catch (caught) {
      const failure = classifyError(caught);
      if (failure.kind === "unauthorized") {
        markAnonymous();
        goToLogin();
      } else {
        setMessage(failure.message);
      }
    } finally {
      setBusy(false);
    }
  }

  const saved = state === "saved";
  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || state === "unknown"}
        aria-pressed={saved}
        aria-label={saved ? `Quitar ${name} de guardados` : `Guardar ${name}`}
        className={`flex ${size === "lg" ? "size-14" : "size-12"} shrink-0 cursor-pointer items-center justify-center rounded-md border border-border-strong bg-surface text-foreground transition-[background-color,transform] duration-[var(--duration-base)] ease-out-quart hover:bg-muted active:scale-[0.96] disabled:cursor-wait disabled:opacity-60 motion-reduce:active:scale-100 ${FOCUS}`}
      >
        <Star size={22} weight={saved ? "fill" : "regular"} aria-hidden="true" />
      </button>
      <span role="status" className="sr-only">
        {message}
      </span>
    </>
  );
}

export { SaveButton };
