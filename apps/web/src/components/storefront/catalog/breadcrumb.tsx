import Link from "next/link";

interface BreadcrumbItem {
  name: string;
  /** Sin `href` es la página actual. */
  href?: string;
}

const LINK_FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** Migas de pan: Inicio / ... / página actual (que no es enlace). */
function Breadcrumb({ trail, className = "" }: { trail: BreadcrumbItem[]; className?: string }) {
  const items: BreadcrumbItem[] = [{ name: "Inicio", href: "/" }, ...trail];

  return (
    <nav aria-label="Migas de pan" className={className}>
      <ol className="flex flex-wrap items-center gap-2 text-label font-mono uppercase tracking-[0.08em] text-muted-foreground-strong">
        {items.map((item, index) => (
          <li key={item.name} className="flex items-center gap-2">
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href ? (
              <Link href={item.href} className={`hover:text-foreground ${LINK_FOCUS}`}>
                {item.name}
              </Link>
            ) : (
              <span aria-current="page" className="text-foreground">
                {item.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export { Breadcrumb };
export type { BreadcrumbItem };
