/**
 * Vistas y estados de las tres propuestas de acceso y Mi Cuenta (Milestone
 * 3.5). Son las mismas en A, B y C: lo que cambia es la composición.
 */
const AUTH_VIEWS = ["ingresar", "crear", "correo", "verificar", "recuperar", "restablecer"] as const;
const ACCOUNT_VIEWS = ["inicio", "perfil", "direcciones", "pedidos", "suscripcion", "facturacion", "guardados"] as const;

type AuthView = (typeof AUTH_VIEWS)[number];
type AccountView = (typeof ACCOUNT_VIEWS)[number];
type PreviewView = AuthView | AccountView;

const PREVIEW_VIEWS: readonly PreviewView[] = [...AUTH_VIEWS, ...ACCOUNT_VIEWS];

function isAuthView(view: PreviewView): view is AuthView {
  return (AUTH_VIEWS as readonly string[]).includes(view);
}

const VIEW_LABELS: Record<PreviewView, string> = {
  ingresar: "Ingresar",
  crear: "Crear cuenta",
  correo: "Revisa tu correo",
  verificar: "Verificar",
  recuperar: "Recuperar",
  restablecer: "Restablecer",
  inicio: "Inicio",
  perfil: "Perfil",
  direcciones: "Direcciones",
  pedidos: "Pedidos",
  suscripcion: "Suscripción",
  facturacion: "Facturación",
  guardados: "Guardados",
};

interface StateOption {
  key: string;
  label: string;
}

/** Estados alternativos por vista (`?estado=`). La vista base no lleva ninguno. */
const VIEW_STATES: Record<PreviewView, StateOption[]> = {
  ingresar: [
    { key: "vacio", label: "Campos vacíos" },
    { key: "incorrecto", label: "Credenciales incorrectas" },
    { key: "sinverificar", label: "Correo sin verificar" },
    { key: "limite", label: "Demasiados intentos" },
    { key: "enviando", label: "Enviando" },
  ],
  crear: [
    { key: "errores", label: "Errores por campo" },
    { key: "debil", label: "Contraseña débil" },
    { key: "nocoincide", label: "No coincide" },
    { key: "terminos", label: "Sin términos" },
    { key: "enviando", label: "Enviando" },
  ],
  correo: [
    { key: "reenviado", label: "Reenviado" },
    { key: "espera", label: "En espera" },
  ],
  verificar: [
    { key: "incorrecta", label: "Contraseña incorrecta" },
    { key: "listo", label: "Listo" },
    { key: "vencido", label: "Enlace vencido" },
  ],
  recuperar: [
    { key: "invalido", label: "Correo inválido" },
    { key: "enviado", label: "Enviado" },
  ],
  restablecer: [
    { key: "errores", label: "Errores" },
    { key: "vencido", label: "Enlace vencido" },
    { key: "listo", label: "Listo" },
  ],
  inicio: [{ key: "sinsuscripcion", label: "Sin suscripción" }],
  perfil: [
    { key: "editando", label: "Editando" },
    { key: "error", label: "Error" },
    { key: "guardado", label: "Guardado" },
    { key: "contrasena", label: "Cambiar contraseña" },
  ],
  direcciones: [
    { key: "vacia", label: "Vacía" },
    { key: "formulario", label: "Formulario" },
    { key: "tope", label: "Tope de 5" },
  ],
  pedidos: [
    { key: "vacia", label: "Vacía" },
    { key: "detalle", label: "Detalle" },
    { key: "oxxo", label: "Ficha OXXO" },
  ],
  suscripcion: [
    { key: "pausada", label: "Pausada" },
    { key: "cancelacion", label: "Cancelación" },
    { key: "pagofallido", label: "Pago fallido" },
    { key: "sin", label: "Sin suscripción" },
  ],
  facturacion: [
    { key: "capturado", label: "Capturado" },
    { key: "editando", label: "Editando" },
  ],
  guardados: [
    { key: "vacia", label: "Vacía" },
    { key: "agotado", label: "Agotado" },
  ],
};

export { AUTH_VIEWS, ACCOUNT_VIEWS, PREVIEW_VIEWS, VIEW_LABELS, VIEW_STATES, isAuthView };
export type { AuthView, AccountView, PreviewView, StateOption };
