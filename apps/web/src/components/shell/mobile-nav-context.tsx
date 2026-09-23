"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface MobileNavContextValue {
  open: boolean;
  openNav: () => void;
  closeNav: () => void;
  toggleNav: () => void;
}

const MobileNavContext = createContext<MobileNavContextValue | null>(null);

function MobileNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const value = useMemo<MobileNavContextValue>(
    () => ({
      open,
      openNav: () => setOpen(true),
      closeNav: () => setOpen(false),
      toggleNav: () => setOpen((current) => !current),
    }),
    [open],
  );

  return <MobileNavContext.Provider value={value}>{children}</MobileNavContext.Provider>;
}

function useMobileNav(): MobileNavContextValue {
  const context = useContext(MobileNavContext);
  if (!context) {
    throw new Error("useMobileNav debe usarse dentro de <MobileNavProvider>.");
  }
  return context;
}

export { MobileNavProvider, useMobileNav };
