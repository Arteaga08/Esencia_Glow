import { sendEmail } from "../config/resend.js";
import { env } from "../config/env.js";

/**
 * Plantillas de correo transaccional del flujo de auth. Texto visible al
 * usuario en español; el envío es best-effort y no bloqueante (ver
 * config/resend.ts) — un fallo aquí nunca revierte el registro ni el reset.
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
    html: `
      <p>Gracias por registrarte en Esencia Glow.</p>
      <p>Confirma tu correo para activar tu cuenta:</p>
      <p><a href="${verificationUrl(token)}">Confirmar mi correo</a></p>
      <p>Este enlace vence en 24 horas. Si tú no creaste esta cuenta, ignora este mensaje.</p>
    `,
  });
}

async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  await sendEmail({
    to,
    subject: "Restablece tu contraseña — Esencia Glow",
    html: `
      <p>Recibimos una solicitud para restablecer tu contraseña.</p>
      <p><a href="${resetUrl(token)}">Restablecer mi contraseña</a></p>
      <p>Este enlace vence en 15 minutos. Si tú no lo solicitaste, ignora este mensaje —
      tu contraseña actual sigue funcionando.</p>
    `,
  });
}

async function sendPasswordChangedNotice(to: string): Promise<void> {
  await sendEmail({
    to,
    subject: "Tu contraseña cambió — Esencia Glow",
    html: `
      <p>Tu contraseña se actualizó correctamente.</p>
      <p>Si no reconoces este cambio, contáctanos de inmediato.</p>
    `,
  });
}

export { sendVerificationEmail, sendPasswordResetEmail, sendPasswordChangedNotice };
