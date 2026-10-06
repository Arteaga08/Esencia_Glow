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
    colorPrimary: "#9f5f6d",
    colorBackground: "#fffdfe",
    colorText: "#5d4037",
    colorTextSecondary: "#9e7e88",
    colorDanger: "#b84c58",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    borderRadius: "6px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": { border: "1px solid #a58a91", boxShadow: "none" },
    ".Input:focus": { border: "1px solid #9f5f6d", boxShadow: "0 0 0 1px #9f5f6d" },
    ".Input--invalid": { border: "1px solid #b84c58", boxShadow: "none" },
    ".Label": { fontSize: "13px" },
  },
};

export { STRIPE_APPEARANCE };
