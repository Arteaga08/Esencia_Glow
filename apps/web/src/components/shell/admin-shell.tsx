"use client";

import type { PublicUser } from "@esencia-glow/shared";
import type { ReactNode } from "react";
import { ToastProvider } from "../ui/toast";
import { MobileNavProvider } from "./mobile-nav-context";
import { MobileSidebarDrawer, Sidebar } from "./sidebar";
import { TopBar } from "./topbar";

/**
 * Composición del shell (DASHBOARD_GUIDELINES.md §1): ToastProvider →
 * MobileNavProvider → Sidebar + main(TopBar + contenido) + drawer móvil.
 */
function AdminShell({ user, children }: { user: PublicUser; children: ReactNode }) {
  return (
    <ToastProvider>
      <MobileNavProvider>
        <div className="flex h-dvh bg-background">
          <Sidebar />
          <MobileSidebarDrawer />
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <TopBar user={user} />
            <div className="flex-1 overflow-y-auto p-6">{children}</div>
          </main>
        </div>
      </MobileNavProvider>
    </ToastProvider>
  );
}

export { AdminShell };
