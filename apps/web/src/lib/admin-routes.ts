/**
 * Rutas del panel. El panel vive físicamente bajo `/admin` (sin `basePath`),
 * así que todo `href`/`redirect`/`router.push` hacia él lleva el prefijo.
 * Este mapa es la única fuente: ninguna pantalla escribe un `"/admin/..."` a
 * mano, de modo que un typo de sección o un `href` sin prefijo falla en
 * `tsc` en vez de llegar a un 404. Los query strings se agregan en el punto
 * de uso (`${ADMIN_ROUTES.orders}?group=action`).
 */
const ADMIN_HOME_PATH = "/admin";
const ADMIN_LOGIN_PATH = `${ADMIN_HOME_PATH}/login`;

const ADMIN_ROUTES = {
  home: ADMIN_HOME_PATH,
  login: ADMIN_LOGIN_PATH,
  orders: `${ADMIN_HOME_PATH}/orders`,
  order: (id: string) => `${ADMIN_HOME_PATH}/orders/${id}`,
  shipments: `${ADMIN_HOME_PATH}/shipments`,
  inventory: `${ADMIN_HOME_PATH}/inventory`,
  homeContent: `${ADMIN_HOME_PATH}/home-content`,
  products: `${ADMIN_HOME_PATH}/products`,
  productNew: `${ADMIN_HOME_PATH}/products/new`,
  product: (id: string) => `${ADMIN_HOME_PATH}/products/${id}`,
  categories: `${ADMIN_HOME_PATH}/categories`,
  category: (id: string) => `${ADMIN_HOME_PATH}/categories/${id}`,
  bundles: `${ADMIN_HOME_PATH}/bundles`,
  bundleNew: `${ADMIN_HOME_PATH}/bundles/new`,
  bundle: (id: string) => `${ADMIN_HOME_PATH}/bundles/${id}`,
  badges: `${ADMIN_HOME_PATH}/badges`,
  plans: `${ADMIN_HOME_PATH}/subscriptions/plans`,
  planNew: `${ADMIN_HOME_PATH}/subscriptions/plans/new`,
  plan: (id: string) => `${ADMIN_HOME_PATH}/subscriptions/plans/${id}`,
  editions: `${ADMIN_HOME_PATH}/subscriptions/editions`,
  editionNew: `${ADMIN_HOME_PATH}/subscriptions/editions/new`,
  edition: (id: string) => `${ADMIN_HOME_PATH}/subscriptions/editions/${id}`,
  accounts: `${ADMIN_HOME_PATH}/subscriptions/accounts`,
  account: (id: string) => `${ADMIN_HOME_PATH}/subscriptions/accounts/${id}`,
  customers: `${ADMIN_HOME_PATH}/customers`,
  customer: (id: string) => `${ADMIN_HOME_PATH}/customers/${id}`,
  settings: `${ADMIN_HOME_PATH}/settings`,
} as const;

export { ADMIN_HOME_PATH, ADMIN_LOGIN_PATH, ADMIN_ROUTES };
