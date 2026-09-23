import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "../../../components/auth/login-form";
import { SilentRefreshGate } from "../../../components/auth/silent-refresh-gate";
import { getSession } from "../../../lib/session";

export const metadata: Metadata = {
  title: "Iniciar sesión — Esencia Glow",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  // Sesión ya válida (access_token vigente) → directo al panel; el guard de
  // (admin)/layout.tsx decide desde ahí si el rol tiene acceso.
  const session = await getSession();
  if (session) redirect("/");

  // Sin access_token válido no significa sin sesión: SilentRefreshGate
  // intenta un refresh silencioso antes de mostrar el formulario — ver su
  // comentario de cabecera para por qué esto vive en el navegador.
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <SilentRefreshGate>
        <LoginForm />
      </SilentRefreshGate>
    </div>
  );
}
