import { FacebookLogo, InstagramLogo, TiktokLogo } from "@phosphor-icons/react/dist/ssr";
import type { ComponentType } from "react";
import { VIEW_ALL_BUTTON } from "@/components/storefront/home/shelf/shelf-button-styles";
import type { SocialNetwork, SocialNetworkKey } from "@/lib/storefront/social-feed";

const ICONS: Record<SocialNetworkKey, ComponentType<{ size?: number; "aria-hidden"?: boolean }>> = {
  instagram: InstagramLogo,
  tiktok: TiktokLogo,
  facebook: FacebookLogo,
};

/** Icono de la red (Phosphor, `currentColor`). */
function NetworkIcon({ network, size = 18 }: { network: SocialNetwork; size?: number }) {
  const Icon = ICONS[network.key];
  return <Icon size={size} aria-hidden={true} />;
}

/** Botón a una red: mismo estilo que "Ver todo" del resto del home. */
function NetworkLink({ network }: { network: SocialNetwork }) {
  return (
    <a
      href={network.href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${VIEW_ALL_BUTTON} min-h-11 gap-2`}
    >
      <NetworkIcon network={network} />
      {network.label}
      <span className="sr-only"> (se abre en otra pestaña)</span>
    </a>
  );
}

export { NetworkIcon, NetworkLink };
