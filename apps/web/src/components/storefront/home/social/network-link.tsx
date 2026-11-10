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

/**
 * Botón a una red: mismo estilo que "Ver todo" del resto del home. Los tres van
 * siempre en una sola fila: en pantallas de menos de 430px no caben con icono
 * (~390px contra 328px útiles en un teléfono de 360px), así que ahí el icono se
 * oculta y queda solo el nombre.
 */
function NetworkLink({ network }: { network: SocialNetwork }) {
  return (
    <a
      href={network.href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${VIEW_ALL_BUTTON} min-h-11 gap-2 whitespace-nowrap`}
    >
      <span className="hidden min-[430px]:contents">
        <NetworkIcon network={network} />
      </span>
      {network.label}
      <span className="sr-only"> (se abre en otra pestaña)</span>
    </a>
  );
}

export { NetworkIcon, NetworkLink };
