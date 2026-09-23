"use client";

import type { PublicUser } from "@esencia-glow/shared";
import { CaretDown, SignOut } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../../lib/api";
import { useToast } from "../ui/toast";

function AccountMenu({ user }: { user: PublicUser }) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await apiRequest("/api/v1/auth/logout", { method: "POST", authenticated: true });
      router.replace("/login");
      router.refresh();
    } catch {
      toast({
        variant: "error",
        title: "No se pudo cerrar la sesión",
        description: "Intenta de nuevo en un momento.",
      });
      setLoggingOut(false);
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-body text-foreground hover:bg-muted"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-sans text-body-sm font-medium text-foreground">
          {user.firstName.charAt(0).toUpperCase()}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block leading-tight">
            {user.firstName} {user.lastName}
          </span>
        </span>
        <CaretDown size={16} weight="regular" aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-56 rounded-md border border-border-strong bg-surface p-1 shadow-overlay"
          style={{ "--surface-bg": "var(--color-surface)" } as React.CSSProperties}
        >
          <div className="px-3 py-2">
            <p className="truncate text-body text-foreground">{user.email}</p>
          </div>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            disabled={loggingOut}
            aria-busy={loggingOut}
            className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-body text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:text-muted-foreground"
          >
            <SignOut size={16} weight="regular" aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      ) : null}
    </div>
  );
}

export { AccountMenu };
