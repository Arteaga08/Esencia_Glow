"use client";

import { useEffect, useState } from "react";
import type { AccountDto, SavedAddress } from "@esencia-glow/shared";
import { accountRequest } from "../account-api";

type SavedAddressesState = { status: "loading" } | { status: "ready"; addresses: SavedAddress[] } | { status: "error" };

/**
 * Libreta de direcciones de la clienta (`GET /account`, máximo 5). Si no carga,
 * el paso de envío sigue funcionando capturando la dirección a mano.
 */
function useSavedAddresses(enabled: boolean): SavedAddressesState {
  const [state, setState] = useState<SavedAddressesState>({ status: "loading" });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    accountRequest<AccountDto>("/api/v1/account", { redirectOnFailure: false })
      .then((response) => {
        if (!cancelled) setState({ status: "ready", addresses: response.data.addresses });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return state;
}

export { useSavedAddresses };
export type { SavedAddressesState };
