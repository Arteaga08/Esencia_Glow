import { ArrowUpRight, WhatsappLogo } from "@phosphor-icons/react";
import { NetworkIcon } from "@/components/storefront/home/social/network-link";
import { WHATSAPP_HREF } from "@/lib/storefront/contact";
import { SOCIAL_NETWORKS } from "@/lib/storefront/social-feed";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * Pie fijo del menú móvil: WhatsApp de asesoría como acción principal (botón
 * rosa a lo ancho) y las redes centradas debajo, solo icono.
 */
function MobileMenuFooter() {
  return (
    <div className="border-t border-border bg-blush px-4 pb-4 pt-4">
      <a
        href={WHATSAPP_HREF}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex min-h-14 items-center gap-3 rounded-full bg-primary pl-5 pr-4 text-subtitle text-foreground transition-colors duration-[var(--duration-base)] ease-out-quart hover:bg-primary-hover active:bg-primary-active motion-reduce:transition-none ${focusRing}`}
      >
        <WhatsappLogo size={26} aria-hidden="true" />
        Asesoría por WhatsApp
        <ArrowUpRight size={20} aria-hidden="true" className="ml-auto" />
        <span className="sr-only"> (se abre en otra pestaña)</span>
      </a>
      <ul className="mt-3 flex items-center justify-center gap-4">
        {SOCIAL_NETWORKS.map((network) => (
          <li key={network.key}>
            <a
              href={network.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={network.label}
              className={`flex size-12 items-center justify-center rounded-full text-foreground transition-colors duration-[var(--duration-base)] ease-out-quart hover:text-primary-action motion-reduce:transition-none ${focusRing}`}
            >
              <NetworkIcon network={network} size={30} />
              <span className="sr-only"> (se abre en otra pestaña)</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export { MobileMenuFooter };
