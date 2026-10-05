import Link from "next/link";
import { CTA_SECONDARY } from "./_kit/styles";

const PROPOSALS = [
  {
    key: "a",
    title: "A. Página partida y barra lateral",
    description: "Formulario a la izquierda y foto del hero a la derecha. Mi cuenta con barra lateral rosa en la sección activa y tarjetas de lectura con Editar. En móvil, rejilla de accesos.",
  },
  {
    key: "b",
    title: "B. Columna de bitácora y pestañas",
    description: "Acceso en una sola columna angosta, sin foto ni tarjeta, con títulos en voz mono. Mi cuenta abre con un resumen y navega con pestañas; el contenido va en renglones con reglas.",
  },
  {
    key: "c",
    title: "C. Tarjeta con pestañas e índice",
    description: "Una tarjeta sobre rosa suave con Ya tengo cuenta / Soy nueva. Mi cuenta es un índice de renglones grandes y cada sección abre en su propia pantalla, pensada primero para el celular.",
  },
];

const ENTRIES = [
  { view: "ingresar", label: "Ingresar" },
  { view: "crear", label: "Crear cuenta" },
  { view: "inicio", label: "Mi cuenta" },
  { view: "suscripcion", label: "Suscripción" },
];

/** Índice de las tres propuestas de acceso y Mi cuenta (Milestone 3.5). Se borra al elegir una. */
export default function AccountPreviewIndex() {
  return (
    <main className="mx-auto max-w-shell px-4 pt-28 pb-20 md:px-8 xl:px-12">
      <h1 className="text-page-title text-foreground md:text-display">Acceso y Mi cuenta</h1>
      <p className="mt-2 max-w-[60ch] text-body text-foreground/80">
        Tres propuestas con datos de ejemplo. Las mismas 13 pantallas en cada una: ingresar, crear cuenta, revisa tu correo, verificar, recuperar, restablecer y las siete secciones de Mi cuenta. Los formularios validan de verdad; abajo de cada propuesta hay una barra para saltar a cualquier pantalla o estado.
      </p>
      <ul className="mt-10 grid gap-10 lg:grid-cols-3">
        {PROPOSALS.map((proposal) => (
          <li key={proposal.key} className="flex flex-col gap-4 border-t border-border-strong pt-6">
            <h2 className="text-section-title text-foreground">{proposal.title}</h2>
            <p className="text-body text-foreground/80">{proposal.description}</p>
            <div className="flex flex-wrap gap-2">
              {ENTRIES.map((entry) => (
                <Link key={entry.view} href={`/design-preview/account/${proposal.key}?vista=${entry.view}`} className={`${CTA_SECONDARY} !h-11 !px-4`}>
                  {entry.label}
                </Link>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
