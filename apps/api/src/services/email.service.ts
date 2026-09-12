import { env } from "../config/env.js";
import { sendEmail } from "./mail-provider.js";
import { renderTransactionalEmail } from "./email-layout.js";

/**
 * Plantillas de correo transaccional del flujo de auth — migradas al shell
 * compartido (§8 del plan de 1.6.3): mismo copy y las mismas firmas
 * exportadas que antes de 1.6.3 (los spies de `auth.routes.test.ts` siguen
 * funcionando sin tocar ese archivo). El envío es best-effort y no
 * bloqueante (ver `mail-provider.ts`) — un fallo aquí nunca revierte el
 * registro ni el reset.
 */

function verificationUrl(token: string): string {
  return `${env.clientUrl}/verificar-correo?token=${token}`;
}

function resetUrl(token: string): string {
  return `${env.clientUrl}/restablecer-contrasena?token=${token}`;
}

async function sendVerificationEmail(to: string, token: string): Promise<void> {
  await sendEmail({
    to,
    subject: "Confirma tu correo — Esencia Glow",
    html: renderTransactionalEmail({
      preheader: "Confirma tu correo para activar tu cuenta.",
      title: "Gracias por registrarte en Esencia Glow",
      paragraphs: ["Confirma tu correo para activar tu cuenta."],
      button: { label: "Confirmar mi correo", url: verificationUrl(token) },
      disclaimer: "Este enlace vence en 24 horas. Si tú no creaste esta cuenta, ignora este mensaje.",
    }),
  });
}

async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  await sendEmail({
    to,
    subject: "Restablece tu contraseña — Esencia Glow",
    html: renderTransactionalEmail({
      preheader: "Recibimos una solicitud para restablecer tu contraseña.",
      title: "Restablece tu contraseña",
      paragraphs: ["Recibimos una solicitud para restablecer tu contraseña."],
      button: { label: "Restablecer mi contraseña", url: resetUrl(token) },
      disclaimer:
        "Este enlace vence en 15 minutos. Si tú no lo solicitaste, ignora este mensaje — tu contraseña actual sigue funcionando.",
    }),
  });
}

async function sendPasswordChangedNotice(to: string): Promise<void> {
  await sendEmail({
    to,
    subject: "Tu contraseña cambió — Esencia Glow",
    html: renderTransactionalEmail({
      preheader: "Tu contraseña se actualizó correctamente.",
      title: "Tu contraseña cambió",
      paragraphs: ["Tu contraseña se actualizó correctamente."],
      disclaimer: "Si no reconoces este cambio, contáctanos de inmediato.",
    }),
  });
}

export { sendVerificationEmail, sendPasswordResetEmail, sendPasswordChangedNotice };
