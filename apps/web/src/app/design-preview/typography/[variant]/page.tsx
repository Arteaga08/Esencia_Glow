import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Bricolage_Grotesque,
  Marcellus,
  Young_Serif,
  Zen_Maru_Gothic,
} from "next/font/google";

// Vista previa desechable: 5 propuestas de tipografía para reemplazar PT Mono.
// Todas conservan Schibsted Grotesk para el cuerpo y las etiquetas.
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], weight: "variable", display: "swap" });
const youngSerif = Young_Serif({ subsets: ["latin"], weight: "400", display: "swap" });
const marcellus = Marcellus({ subsets: ["latin"], weight: "400", display: "swap" });
const zenMaru = Zen_Maru_Gothic({ subsets: ["latin"], weight: ["500", "700"], display: "swap" });

type Variant = {
  name: string;
  idea: string;
  display: CSSProperties;
  section: CSSProperties;
  card: CSSProperties;
};

const SANS = "var(--font-sans)";

const variants: Record<string, Variant> = {
  a: {
    name: "A · Bricolage Grotesque",
    idea: "Sans con carácter: trazos algo irregulares, cálida y moderna. Oración normal, sin mayúsculas.",
    display: { fontFamily: bricolage.style.fontFamily, fontWeight: 700, fontSize: "clamp(3rem, 2rem + 5vw, 5.5rem)", lineHeight: 0.95, letterSpacing: "-0.03em" },
    section: { fontFamily: bricolage.style.fontFamily, fontWeight: 600, fontSize: "clamp(1.5rem, 1.2rem + 1vw, 2rem)", lineHeight: 1.1, letterSpacing: "-0.02em" },
    card: { fontFamily: bricolage.style.fontFamily, fontWeight: 600, fontSize: "1.25rem", lineHeight: 1.2, letterSpacing: "-0.01em" },
  },
  b: {
    name: "B · Young Serif",
    idea: "Serif suave y robusta, de cartel de farmacia antigua. Redondeada, no fina ni de revista.",
    display: { fontFamily: youngSerif.style.fontFamily, fontWeight: 400, fontSize: "clamp(3rem, 2rem + 5vw, 5.5rem)", lineHeight: 1, letterSpacing: "-0.01em" },
    section: { fontFamily: youngSerif.style.fontFamily, fontWeight: 400, fontSize: "clamp(1.5rem, 1.2rem + 1vw, 2rem)", lineHeight: 1.1 },
    card: { fontFamily: youngSerif.style.fontFamily, fontWeight: 400, fontSize: "1.25rem", lineHeight: 1.2 },
  },
  c: {
    name: "C · Marcellus en mayúsculas",
    idea: "Romana inscripcional: conserva la voz de «etiqueta de frasco» en mayúsculas espaciadas, pero elegante en vez de máquina de escribir.",
    display: { fontFamily: marcellus.style.fontFamily, fontWeight: 400, fontSize: "clamp(2.75rem, 1.8rem + 4.5vw, 5rem)", lineHeight: 1, letterSpacing: "0.12em", textTransform: "uppercase" },
    section: { fontFamily: marcellus.style.fontFamily, fontWeight: 400, fontSize: "clamp(1.25rem, 1.1rem + 0.6vw, 1.5rem)", lineHeight: 1.25, letterSpacing: "0.12em", textTransform: "uppercase" },
    card: { fontFamily: marcellus.style.fontFamily, fontWeight: 400, fontSize: "1.125rem", lineHeight: 1.3, letterSpacing: "0.08em", textTransform: "uppercase" },
  },
  d: {
    name: "D · Zen Maru Gothic",
    idea: "Gótica redondeada japonesa: terminaciones suaves, guiño a K-beauty, amable y limpia.",
    display: { fontFamily: zenMaru.style.fontFamily, fontWeight: 700, fontSize: "clamp(3rem, 2rem + 5vw, 5.5rem)", lineHeight: 1, letterSpacing: "-0.01em" },
    section: { fontFamily: zenMaru.style.fontFamily, fontWeight: 700, fontSize: "clamp(1.5rem, 1.2rem + 1vw, 2rem)", lineHeight: 1.15 },
    card: { fontFamily: zenMaru.style.fontFamily, fontWeight: 500, fontSize: "1.25rem", lineHeight: 1.25 },
  },
  e: {
    name: "E · Solo Schibsted Grotesk",
    idea: "Una sola familia con contraste de peso y tamaño. Sin fuente extra, la más ligera y coherente con el panel.",
    display: { fontFamily: SANS, fontWeight: 600, fontSize: "clamp(3rem, 2rem + 5vw, 5.5rem)", lineHeight: 0.95, letterSpacing: "-0.04em" },
    section: { fontFamily: SANS, fontWeight: 600, fontSize: "clamp(1.5rem, 1.2rem + 1vw, 2rem)", lineHeight: 1.1, letterSpacing: "-0.025em" },
    card: { fontFamily: SANS, fontWeight: 600, fontSize: "1.25rem", lineHeight: 1.2, letterSpacing: "-0.01em" },
  },
};

// Etiquetas, botones y datos: Schibsted en mayúsculas con tracking, igual en las 5.
const label: CSSProperties = { fontFamily: SANS, fontWeight: 500, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" };

const colorBox: CSSProperties = { border: "1px solid var(--color-border-strong)", borderRadius: 8, padding: "18px 24px", background: "var(--color-background)" };

function generateStaticParams() {
  return Object.keys(variants).map((variant) => ({ variant }));
}

async function TypographyPreview({ params }: { params: Promise<{ variant: string }> }) {
  const { variant } = await params;
  const v = variants[variant];
  if (!v) notFound();

  return (
    <main style={{ background: "var(--color-background)", color: "var(--color-foreground)", minHeight: "100vh", fontFamily: SANS }}>
      <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "12px 48px", background: "var(--color-foreground)", color: "var(--color-background)", fontSize: 13 }}>
        {Object.entries(variants).map(([key, item]) => (
          <Link key={key} href={`/design-preview/typography/${key}`} style={{ padding: "6px 12px", borderRadius: 999, background: key === variant ? "var(--color-primary)" : "transparent", color: key === variant ? "var(--color-foreground)" : "inherit", cursor: "pointer" }}>
            {item.name}
          </Link>
        ))}
      </nav>

      <section style={{ background: "var(--color-secondary)", padding: "64px 48px 72px" }}>
        <p style={{ ...label, color: "var(--color-muted-foreground-strong)", margin: 0 }}>Inicio / Kits</p>
        <h1 style={{ ...v.display, margin: "28px 0 24px" }}>Kits</h1>
        <p style={{ fontSize: 16, margin: 0, maxWidth: "62ch" }}>Rutinas completas en un solo paquete, con un precio pensado para el conjunto.</p>
        <p style={{ fontSize: 13, margin: "20px 0 0", color: "var(--color-muted-foreground-strong)", maxWidth: "62ch" }}>{v.idea}</p>
      </section>

      <section style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 48px", borderBottom: "1px solid var(--color-border)" }}>
        <span style={{ ...colorBox, ...label, padding: "14px 22px" }}>Precio ⌄</span>
        <span style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <span style={{ fontSize: 14, color: "var(--color-muted-foreground-strong)" }}>10 kits</span>
          <span style={{ ...colorBox, padding: "14px 22px", fontSize: 14 }}><span style={label}>Ordenar</span>&nbsp;&nbsp;Lo más nuevo ⌄</span>
        </span>
      </section>

      <section style={{ padding: "56px 48px 24px" }}>
        <h2 style={{ ...v.section, margin: "0 0 28px" }}>Más vendidos</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
          {[
            { tag: "Vegano", bg: "var(--color-badge-sage)", fg: "var(--color-badge-sage-foreground)", title: "Kit Glow Diario", price: "$890" },
            { tag: "Recomendado", bg: "var(--color-primary)", fg: "var(--color-foreground)", title: "Kit Piel Radiante", price: "$1,240" },
            { tag: "Novedad", bg: "var(--color-badge-sand)", fg: "var(--color-badge-sand-foreground)", title: "Kit Noche Reparadora", price: "$1,090" },
          ].map((item) => (
            <article key={item.title}>
              <div style={{ position: "relative", aspectRatio: "4 / 5", background: "var(--color-muted)", borderRadius: 8 }}>
                <span style={{ ...label, position: "absolute", top: 16, left: 16, padding: "6px 12px", borderRadius: 999, background: item.bg, color: item.fg }}>{item.tag}</span>
              </div>
              <h3 style={{ ...v.card, margin: "16px 0 6px" }}>{item.title}</h3>
              <p style={{ margin: 0, fontSize: 14 }}>{item.price} <span style={{ color: "var(--color-muted-foreground-strong)" }}>MXN</span></p>
            </article>
          ))}
        </div>
        <button type="button" style={{ ...label, marginTop: 36, padding: "16px 28px", borderRadius: 999, border: 0, background: "var(--color-primary-action)", color: "var(--color-primary-foreground)", cursor: "pointer" }}>
          Ver todos los kits
        </button>
      </section>
    </main>
  );
}

export { generateStaticParams };
export default TypographyPreview;
