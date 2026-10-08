const CHIP = "h-6 w-[38px] rounded-sm border border-border";
const WORDMARK = { fontFamily: "Arial, Helvetica, sans-serif", fontWeight: 700 } as const;

/** Marcas de tarjeta que acepta el cobro (Stripe México), como fichas chicas. */
function CardBrands() {
  return (
    <ul aria-label="Tarjetas aceptadas" className="flex gap-2">
      <li>
        <svg viewBox="0 0 38 24" role="img" aria-label="Visa" className={CHIP}>
          <rect width="38" height="24" fill="#fff" />
          <text x="19" y="16.5" textAnchor="middle" fontSize="11" fontStyle="italic" fill="#1434CB" style={WORDMARK}>
            VISA
          </text>
        </svg>
      </li>
      <li>
        <svg viewBox="0 0 38 24" role="img" aria-label="Mastercard" className={CHIP}>
          <rect width="38" height="24" fill="#fff" />
          <circle cx="15" cy="12" r="7" fill="#EB001B" />
          <circle cx="23" cy="12" r="7" fill="#F79E1B" />
          <path d="M19 6.25a7 7 0 0 1 0 11.5 7 7 0 0 1 0-11.5Z" fill="#FF5F00" />
        </svg>
      </li>
      <li>
        <svg viewBox="0 0 38 24" role="img" aria-label="American Express" className={CHIP}>
          <rect width="38" height="24" fill="#006FCF" />
          <text x="19" y="15.5" textAnchor="middle" fontSize="8" fill="#fff" style={WORDMARK}>
            AMEX
          </text>
        </svg>
      </li>
    </ul>
  );
}

export { CardBrands };
