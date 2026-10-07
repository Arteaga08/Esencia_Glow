import { ShelfBlock } from "../home/shelf/shelf-block";
import { StateView } from "./state-view";

/**
 * Contenido del 404 de la tienda: el mensaje y, debajo, el estante real de más
 * vendidos. Si el API cae, `ShelfBlock` no pinta nada y queda solo la banda.
 */
function NotFoundPage() {
  return <StateView kind="not-found" extra={<ShelfBlock />} />;
}

export { NotFoundPage };
