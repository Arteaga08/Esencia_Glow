import { NetworkIcon } from "@/components/storefront/home/social/network-link";
import { SOCIAL_NETWORKS } from "@/lib/storefront/social-feed";

/** Redes del footer: solo icono, con objetivo táctil de 44px. */
function FooterSocial({ tone = "light" }: { tone?: "light" | "dark" }) {
  const color = tone === "dark" ? "text-background hover:text-primary" : "text-foreground hover:text-primary-action";

  return (
    <ul className="flex items-center gap-1">
      {SOCIAL_NETWORKS.map((network) => (
        <li key={network.key}>
          <a
            href={network.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={network.label}
            className={`flex h-11 w-11 items-center justify-center rounded-md transition-colors duration-[var(--duration-base)] ease-out-quart focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none ${color}`}
          >
            <NetworkIcon network={network} size={22} />
            <span className="sr-only"> (se abre en otra pestaña)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export { FooterSocial };
