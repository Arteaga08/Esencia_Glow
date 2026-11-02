import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Piezas del texto legal: cláusula numerada, párrafo, lista, tabla y enlace a
 * otra página legal. Mantienen la misma tipografía en las cinco páginas.
 */

interface LegalClauseProps {
  number: number;
  title: string;
  children: ReactNode;
}

function LegalClause({ number, title, children }: LegalClauseProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-section-title text-foreground">
        {number}. {title}
      </h2>
      {children}
    </section>
  );
}

function LegalParagraph({ children }: { children: ReactNode }) {
  return <p className="text-body text-foreground/85">{children}</p>;
}

function LegalList({ items, ordered = false }: { items: ReactNode[]; ordered?: boolean }) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={`flex flex-col gap-2 pl-5 text-body text-foreground/85 ${ordered ? "list-decimal" : "list-disc"}`}>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </Tag>
  );
}

interface LegalTableProps {
  caption: string;
  headers: string[];
  rows: string[][];
}

/** Tabla con desplazamiento horizontal propio para que no ensanche la página en móvil. */
function LegalTable({ caption, headers, rows }: LegalTableProps) {
  return (
    <div className="overflow-x-auto rounded-md border border-border-strong">
      <table className="w-full min-w-[32rem] border-collapse text-left text-body-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted">
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col" className="px-4 py-3 font-medium text-foreground">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-t border-border-strong">
              {row.map((cell, index) => (
                <td key={index} className="px-4 py-3 align-top text-foreground/85">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="text-foreground underline decoration-border-strong underline-offset-4 transition-colors duration-[var(--duration-fast)] hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {children}
    </Link>
  );
}

export { LegalClause, LegalLink, LegalList, LegalParagraph, LegalTable };
