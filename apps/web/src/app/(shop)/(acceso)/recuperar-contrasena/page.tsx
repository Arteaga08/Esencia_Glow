import type { Metadata } from "next";
import { ForgotForm } from "@/components/storefront/account/auth/forgot-form";

export const metadata: Metadata = { title: "Recuperar contraseña — Esencia Glow" };

export default function ForgotPasswordPage() {
  return <ForgotForm />;
}
