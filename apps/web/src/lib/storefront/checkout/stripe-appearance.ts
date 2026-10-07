import type { Appearance } from "@stripe/stripe-js";

/**
 * Aspecto del campo de tarjeta. Stripe lo dibuja en un iframe que no hereda
 * nuestro CSS, y su API no entiende `oklch`: son los mismos tokens de
 * `styles/tokens.css` convertidos a hex (foreground, input, border-strong,
 * primary-action, destructive-action, muted-foreground).
 */
const STRIPE_APPEARANCE: Appearance = {
  theme: "stripe",
  variables: {
    colorPrimary: "#b33e5d",
    colorBackground: "#ffffff",
    colorText: "#161616",
    colorTextSecondary: "#a18e84",
    colorDanger: "#b81228",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    borderRadius: "6px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": { border: "1px solid #948a84", boxShadow: "none" },
    ".Input:focus": { border: "1px solid #b33e5d", boxShadow: "0 0 0 1px #b33e5d" },
    ".Input--invalid": { border: "1px solid #b81228", boxShadow: "none" },
    ".Label": { fontSize: "13px" },
  },
};

export { STRIPE_APPEARANCE };
