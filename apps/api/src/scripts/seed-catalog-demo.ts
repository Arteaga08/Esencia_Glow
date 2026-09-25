import { pathToFileURL } from "node:url";
import { BadgeColor, BundleStatus, ProductChannel, ProductStatus } from "@esencia-glow/shared";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { Category } from "../models/category.model.js";
import { createCategory } from "../services/category.service.js";
import { createBadge } from "../services/badge.service.js";
import { createProduct, updateProduct, type CreateProductInput } from "../services/product.service.js";
import { createBundle, updateBundle } from "../services/bundle.service.js";

const FORCE_FLAG = "--force";

/**
 * Seed de catálogo de demostración (Milestone 2.2.3): 5 categorías raíz + 10
 * subcategorías, 5 badges, 20 productos con variantes/precio/contenido
 * editorial/inventario inicial, y 13 paquetes armados con esos productos —
 * suficientes para que Badges (límite 20) no pagine pero Bundles (límite 10)
 * sí, y para ver el listado de Productos con datos reales de un vistazo.
 *
 * SIN FOTOS a propósito (decisión de Manuel en esta sesión): las agrega él
 * mismo desde el panel — `ImageManager`/`PendingImagePicker` ya cubren esa
 * parte, un seed no puede adjuntar archivos reales de forma útil.
 *
 * Idempotente por omisión, no por sobrescritura: si la categoría raíz
 * "Limpieza" ya existe, el seed asume que ya corrió antes y no hace nada —
 * evita duplicar el catálogo en una segunda corrida por hábito. No hay modo
 * "borra y reseeed": limpiar el catálogo de prueba es una decisión manual
 * (Mongo Compass, `mongosh`, o las páginas de archivar del panel), no algo
 * que un script deba automatizar sobre una base de datos de desarrollo que
 * también puede tener otros datos reales de prueba.
 */

interface ContentItemSeed {
  title: string;
  text: string;
}

interface ContentSeed {
  ingredients?: ContentItemSeed[];
  routineSteps?: ContentItemSeed[];
  usage?: ContentItemSeed[];
  benefits?: ContentItemSeed[];
}

interface VariantSeed {
  key: string;
  sku: string;
  name: string;
  attributes?: { size?: string; shade?: string; volume?: string };
  price: number;
  listPrice?: number;
  weightGrams: number;
  dimensionsCm: { length: number; width: number; height: number };
  initialStock: number;
}

interface ProductSeed {
  key: string;
  name: string;
  description: string;
  shortDescription?: string;
  categoryKey: string;
  badgeKey?: string;
  status: ProductStatus;
  content?: ContentSeed;
  variants: VariantSeed[];
}

interface BundleItemSeed {
  productKey: string;
  variantKey: string;
  quantity: number;
}

interface BundleSeed {
  name: string;
  description: string;
  price: number;
  listPrice?: number;
  badgeKey?: string;
  status: BundleStatus;
  content?: ContentSeed;
  items: BundleItemSeed[];
}

/** 5 raíces × 2 subcategorías — dos niveles, mismo límite que
 * `assertDepthInvariant` en category.service.ts. */
const CATEGORY_TREE: { key: string; name: string; children: { key: string; name: string }[] }[] = [
  {
    key: "limpieza",
    name: "Limpieza",
    children: [
      { key: "limpiadores", name: "Limpiadores" },
      { key: "exfoliantes", name: "Exfoliantes" },
    ],
  },
  {
    key: "tratamiento",
    name: "Tratamiento",
    children: [
      { key: "suero", name: "Sueros" },
      { key: "contorno-ojos", name: "Contorno de Ojos" },
    ],
  },
  {
    key: "hidratacion",
    name: "Hidratación",
    children: [
      { key: "cremas", name: "Cremas" },
      { key: "brumas-aceites", name: "Brumas y Aceites" },
    ],
  },
  {
    key: "proteccion",
    name: "Protección",
    children: [{ key: "protector-solar", name: "Protector Solar" }],
  },
  {
    key: "cuerpo",
    name: "Cuerpo",
    children: [
      { key: "corporal", name: "Corporal" },
      { key: "manos-pies", name: "Manos y Pies" },
    ],
  },
];

const BADGES: { key: string; text: string; color: BadgeColor }[] = [
  { key: "nuevo", text: "Nuevo", color: BadgeColor.PRIMARY },
  { key: "mas-vendido", text: "Más vendido", color: BadgeColor.SUCCESS },
  { key: "edicion-limitada", text: "Edición limitada", color: BadgeColor.WARNING },
  { key: "vegano", text: "Vegano", color: BadgeColor.INFO },
  { key: "recomendado", text: "Recomendado", color: BadgeColor.NEUTRAL },
];

const DIM_SMALL = { length: 4, width: 4, height: 10 };
const DIM_MEDIUM = { length: 5, width: 5, height: 12 };
const DIM_JAR = { length: 6, width: 6, height: 6 };
const DIM_BOTTLE_LARGE = { length: 6, width: 6, height: 16 };

const PRODUCTS: ProductSeed[] = [
  {
    key: "limpiador-espuma",
    name: "Limpiador Espuma Suave",
    description:
      "Espuma de limpieza diaria con base suave sin sulfatos agresivos, para rostro. Retira maquillaje ligero y exceso de grasa sin dejar la piel tirante.",
    shortDescription: "Limpieza diaria sin dejar la piel tirante.",
    categoryKey: "limpiadores",
    badgeKey: "mas-vendido",
    status: ProductStatus.ACTIVE,
    content: {
      usage: [{ title: "Frecuencia", text: "Mañana y noche, sobre rostro húmedo." }],
      benefits: [{ title: "Sin sulfatos agresivos", text: "Limpia sin resecar ni dejar sensación tirante." }],
    },
    variants: [
      {
        key: "150ml",
        sku: "LIMP-ESP-150",
        name: "150ml",
        price: 28900,
        weightGrams: 180,
        dimensionsCm: DIM_MEDIUM,
        initialStock: 40,
      },
    ],
  },
  {
    key: "gel-purificante",
    name: "Gel Limpiador Purificante",
    description:
      "Gel de limpieza profunda con ácido salicílico en baja concentración, pensado para piel mixta a grasa y poros visibles.",
    categoryKey: "limpiadores",
    status: ProductStatus.ACTIVE,
    content: {
      benefits: [{ title: "Poros visiblemente más limpios", text: "Ácido salicílico en baja dosis, uso diario." }],
    },
    variants: [
      {
        key: "150ml",
        sku: "LIMP-GEL-150",
        name: "150ml",
        price: 25900,
        weightGrams: 175,
        dimensionsCm: DIM_MEDIUM,
        initialStock: 35,
      },
    ],
  },
  {
    key: "exfoliante-enzimatico",
    name: "Exfoliante Enzimático",
    description:
      "Exfoliante en gel con enzimas de papaya, sin partículas abrasivas — renueva la textura de la piel sin microdesgarros.",
    categoryKey: "exfoliantes",
    status: ProductStatus.ACTIVE,
    content: {
      ingredients: [{ title: "Enzima de papaya", text: "Disuelve células muertas sin fricción mecánica." }],
      usage: [{ title: "Frecuencia", text: "2 a 3 veces por semana, nunca a diario." }],
      benefits: [{ title: "Textura más uniforme", text: "Sin las microabrasiones de un exfoliante físico." }],
    },
    variants: [
      {
        key: "75ml",
        sku: "EXF-ENZ-075",
        name: "75ml",
        price: 32900,
        weightGrams: 120,
        dimensionsCm: DIM_SMALL,
        initialStock: 25,
      },
    ],
  },
  {
    key: "polvo-exfoliante-avena",
    name: "Polvo Exfoliante de Avena",
    description:
      "Polvo 100% natural a base de avena coloidal, se activa con agua — exfoliación suave para piel sensible.",
    categoryKey: "exfoliantes",
    badgeKey: "vegano",
    status: ProductStatus.ACTIVE,
    variants: [
      {
        key: "100g",
        sku: "EXF-AVE-100",
        name: "100g",
        price: 24900,
        weightGrams: 130,
        dimensionsCm: DIM_JAR,
        initialStock: 20,
      },
    ],
  },
  {
    key: "serum-vitamina-c",
    name: "Sérum Vitamina C",
    description:
      "Sérum antioxidante con vitamina C estabilizada al 15% — ilumina el tono y refuerza la barrera frente al daño ambiental diario.",
    shortDescription: "Ilumina el tono y refuerza la barrera cutánea.",
    categoryKey: "suero",
    badgeKey: "mas-vendido",
    status: ProductStatus.ACTIVE,
    content: {
      ingredients: [
        { title: "Vitamina C 15%", text: "Concentración estabilizada, antioxidante y despigmentante." },
        { title: "Ácido ferúlico", text: "Refuerza la estabilidad de la vitamina C frente a la luz." },
      ],
      routineSteps: [
        { title: "1. Limpieza", text: "Aplica sobre rostro limpio y seco." },
        { title: "2. Sérum", text: "3-4 gotas, masajea hasta absorber." },
        { title: "3. Protector solar", text: "Nunca lo omitas de día: la vitamina C fotosensibiliza." },
      ],
      usage: [{ title: "Momento del día", text: "Por la mañana, antes del protector solar." }],
      benefits: [
        { title: "Tono más uniforme", text: "Resultados visibles a partir de la cuarta semana de uso constante." },
      ],
    },
    variants: [
      {
        key: "30ml",
        sku: "SER-VITC-030",
        name: "30ml",
        price: 45900,
        listPrice: 52900,
        weightGrams: 90,
        dimensionsCm: DIM_SMALL,
        initialStock: 30,
      },
      {
        key: "15ml",
        sku: "SER-VITC-015",
        name: "15ml",
        price: 27900,
        weightGrams: 60,
        dimensionsCm: DIM_SMALL,
        initialStock: 20,
      },
    ],
  },
  {
    key: "serum-centella",
    name: "Sérum Calmante Centella",
    description: "Sérum ligero con extracto de centella asiática, para piel reactiva o post-procedimiento.",
    categoryKey: "suero",
    status: ProductStatus.ACTIVE,
    content: {
      ingredients: [{ title: "Centella asiática", text: "Calma la irritación visible sin sensación grasosa." }],
      benefits: [{ title: "Piel visiblemente más calmada", text: "Ideal después de un exfoliante o retinoides." }],
    },
    variants: [
      {
        key: "30ml",
        sku: "SER-CENT-030",
        name: "30ml",
        price: 39900,
        weightGrams: 90,
        dimensionsCm: DIM_SMALL,
        initialStock: 22,
      },
    ],
  },
  {
    key: "serum-niacinamida",
    name: "Sérum Niacinamida 10%",
    description: "Sérum con niacinamida al 10% y zinc, regula la producción de sebo y afina la apariencia del poro.",
    categoryKey: "suero",
    badgeKey: "nuevo",
    status: ProductStatus.ACTIVE,
    content: {
      ingredients: [{ title: "Niacinamida 10% + Zinc", text: "Regula sebo, afina poro, sin resecar." }],
      usage: [{ title: "Frecuencia", text: "Una vez al día, de preferencia por la noche." }],
    },
    variants: [
      {
        key: "30ml",
        sku: "SER-NIAC-030",
        name: "30ml",
        price: 34900,
        weightGrams: 90,
        dimensionsCm: DIM_SMALL,
        initialStock: 28,
      },
    ],
  },
  {
    key: "contorno-cafeina",
    name: "Contorno de Ojos Cafeína",
    description: "Gel-crema de contorno con cafeína, reduce la apariencia de bolsas y ojeras al despertar.",
    categoryKey: "contorno-ojos",
    status: ProductStatus.ACTIVE,
    variants: [
      {
        key: "15ml",
        sku: "CON-CAF-015",
        name: "15ml",
        price: 38900,
        weightGrams: 60,
        dimensionsCm: DIM_SMALL,
        initialStock: 18,
      },
    ],
  },
  {
    key: "contorno-refrescante",
    name: "Gel Contorno Refrescante",
    description: "Gel con aplicador de metal frío, efecto refrescante inmediato para la zona del contorno de ojos.",
    categoryKey: "contorno-ojos",
    status: ProductStatus.DRAFT,
    variants: [
      {
        key: "15ml",
        sku: "CON-REF-015",
        name: "15ml",
        price: 32900,
        weightGrams: 60,
        dimensionsCm: DIM_SMALL,
        initialStock: 0,
      },
    ],
  },
  {
    key: "crema-nocturna",
    name: "Crema Reparadora Nocturna",
    description:
      "Crema nocturna densa con ceramidas y péptidos — repara la barrera cutánea mientras duermes, para piel seca o madura.",
    shortDescription: "Repara la barrera cutánea durante la noche.",
    categoryKey: "cremas",
    badgeKey: "mas-vendido",
    status: ProductStatus.ACTIVE,
    content: {
      ingredients: [{ title: "Ceramidas + péptidos", text: "Refuerzan la barrera cutánea durante el descanso." }],
      usage: [{ title: "Frecuencia", text: "Todas las noches, en rostro y cuello." }],
      benefits: [{ title: "Piel más firme al despertar", text: "Uso constante recomendado por al menos 4 semanas." }],
    },
    variants: [
      {
        key: "50ml",
        sku: "CRE-NOCT-050",
        name: "50ml",
        price: 29900,
        listPrice: 34900,
        weightGrams: 140,
        dimensionsCm: DIM_JAR,
        initialStock: 26,
      },
    ],
  },
  {
    key: "crema-dia-ligera",
    name: "Crema Ligera de Día",
    description: "Crema hidratante de textura ligera, absorción rápida, base perfecta antes del protector solar.",
    categoryKey: "cremas",
    status: ProductStatus.ACTIVE,
    variants: [
      {
        key: "50ml",
        sku: "CRE-DIA-050",
        name: "50ml",
        price: 27900,
        weightGrams: 140,
        dimensionsCm: DIM_JAR,
        initialStock: 24,
      },
    ],
  },
  {
    key: "mascarilla-avena",
    name: "Mascarilla de Avena",
    description: "Mascarilla calmante de avena coloidal y miel, para piel sensible o irritada — uso semanal.",
    categoryKey: "cremas",
    status: ProductStatus.ACTIVE,
    variants: [
      {
        key: "75ml",
        sku: "MAS-AVE-075",
        name: "75ml",
        price: 34900,
        weightGrams: 110,
        dimensionsCm: DIM_SMALL,
        initialStock: 15,
      },
    ],
  },
  {
    key: "bruma-hidratante",
    name: "Bruma Hidratante",
    description: "Bruma facial de agua termal con ácido hialurónico, refresca y sella hidratación sobre el maquillaje.",
    categoryKey: "brumas-aceites",
    status: ProductStatus.ACTIVE,
    variants: [
      {
        key: "100ml",
        sku: "BRU-HID-100",
        name: "100ml",
        price: 16900,
        weightGrams: 130,
        dimensionsCm: DIM_MEDIUM,
        initialStock: 32,
      },
    ],
  },
  {
    key: "aceite-nutritivo",
    name: "Aceite Facial Nutritivo",
    description: "Aceite facial 100% de origen vegetal, sella la hidratación de la rutina nocturna en piel seca.",
    categoryKey: "brumas-aceites",
    badgeKey: "vegano",
    status: ProductStatus.ACTIVE,
    content: {
      ingredients: [{ title: "Mezcla vegetal en frío", text: "Rosa mosqueta, jojoba y argán, sin siliconas." }],
      usage: [{ title: "Último paso", text: "2-3 gotas al final de la rutina nocturna, sella la hidratación." }],
    },
    variants: [
      {
        key: "30ml",
        sku: "ACE-NUT-030",
        name: "30ml",
        price: 42900,
        weightGrams: 100,
        dimensionsCm: DIM_SMALL,
        initialStock: 16,
      },
    ],
  },
  {
    key: "protector-ligero",
    name: "Protector Solar Ligero FPS 50",
    description: "Protector solar FPS 50 de textura ligera, sin dejar tono blanquecino — uso diario bajo maquillaje.",
    shortDescription: "FPS 50 sin dejar tono blanquecino.",
    categoryKey: "protector-solar",
    status: ProductStatus.ACTIVE,
    content: {
      usage: [{ title: "Reaplicación", text: "Cada 3-4 horas con exposición solar directa." }],
      benefits: [{ title: "Sin tono blanquecino", text: "Se funde con la piel, compatible con maquillaje." }],
    },
    variants: [
      {
        key: "50ml",
        sku: "SPF-LIG-050",
        name: "50ml",
        price: 24900,
        weightGrams: 120,
        dimensionsCm: DIM_MEDIUM,
        initialStock: 38,
      },
    ],
  },
  {
    key: "protector-polvo",
    name: "Protector Solar en Polvo FPS 30",
    description: "Protector solar mineral en polvo compacto, ideal para retocar protección sobre el maquillaje ya puesto.",
    categoryKey: "protector-solar",
    badgeKey: "nuevo",
    status: ProductStatus.ACTIVE,
    variants: [
      {
        key: "8g",
        sku: "SPF-POL-008",
        name: "8g",
        price: 34900,
        weightGrams: 40,
        dimensionsCm: DIM_SMALL,
        initialStock: 12,
      },
    ],
  },
  {
    key: "crema-corporal-karite",
    name: "Crema Corporal Manteca de Karité",
    description: "Crema corporal densa de manteca de karité pura, para piel muy seca en codos, rodillas y talones.",
    categoryKey: "corporal",
    status: ProductStatus.ACTIVE,
    variants: [
      {
        key: "200ml",
        sku: "CORP-KAR-200",
        name: "200ml",
        price: 32900,
        weightGrams: 260,
        dimensionsCm: DIM_BOTTLE_LARGE,
        initialStock: 20,
      },
    ],
  },
  {
    key: "aceite-corporal-seco",
    name: "Aceite Corporal Seco",
    description: "Aceite corporal de absorción rápida, sin sensación grasosa — deja un ligero brillo natural.",
    categoryKey: "corporal",
    badgeKey: "vegano",
    status: ProductStatus.ACTIVE,
    variants: [
      {
        key: "100ml",
        sku: "CORP-SEC-100",
        name: "100ml",
        price: 38900,
        weightGrams: 150,
        dimensionsCm: DIM_MEDIUM,
        initialStock: 14,
      },
    ],
  },
  {
    key: "balsamo-labial",
    name: "Bálsamo Labial Reparador",
    description: "Bálsamo labial nutritivo con manteca de karité, repara labios agrietados o resecos.",
    categoryKey: "manos-pies",
    status: ProductStatus.ACTIVE,
    variants: [
      {
        key: "10g",
        sku: "BAL-LAB-010",
        name: "10g",
        price: 12900,
        weightGrams: 20,
        dimensionsCm: DIM_SMALL,
        initialStock: 45,
      },
    ],
  },
  {
    key: "crema-manos",
    name: "Crema de Manos Reparadora",
    description: "Crema de manos de absorción rápida, no deja residuo graso — ideal para uso frecuente durante el día.",
    categoryKey: "manos-pies",
    badgeKey: "recomendado",
    status: ProductStatus.ARCHIVED,
    variants: [
      {
        key: "75ml",
        sku: "MAN-REP-075",
        name: "75ml",
        price: 18900,
        weightGrams: 90,
        dimensionsCm: DIM_SMALL,
        initialStock: 0,
      },
    ],
  },
];

/**
 * 13 paquetes (Milestone 2.2.3) — más que el `PAGE_LIMIT` de 10 de la
 * sección de Paquetes, para poder ver la paginación en acción. Mezcla de
 * ahorro real, precio por encima de la suma (edición limitada), con/sin
 * badge, con/sin `listPrice`, y estados variados.
 */
const BUNDLES: BundleSeed[] = [
  {
    name: "Ritual Nocturno Completo",
    description: "Limpieza, tratamiento y sellado para la rutina de noche, en un solo paquete.",
    price: 89900,
    listPrice: 104700,
    badgeKey: "mas-vendido",
    status: BundleStatus.ACTIVE,
    content: {
      routineSteps: [
        { title: "1. Limpieza", text: "Limpiador espuma suave sobre rostro húmedo." },
        { title: "2. Tratamiento", text: "Sérum de vitamina C antes de que la piel absorba el agua." },
        { title: "3. Sellado", text: "Crema reparadora nocturna en rostro y cuello." },
      ],
      benefits: [{ title: "Ahorro real", text: "Los tres pasos esenciales de la rutina nocturna, en un solo pedido." }],
    },
    items: [
      { productKey: "limpiador-espuma", variantKey: "150ml", quantity: 1 },
      { productKey: "serum-vitamina-c", variantKey: "30ml", quantity: 1 },
      { productKey: "crema-nocturna", variantKey: "50ml", quantity: 1 },
    ],
  },
  {
    name: "Dúo Esencial",
    description: "Los dos básicos para empezar una rutina de skincare sin complicarte.",
    price: 42900,
    status: BundleStatus.ACTIVE,
    items: [
      { productKey: "limpiador-espuma", variantKey: "150ml", quantity: 1 },
      { productKey: "protector-ligero", variantKey: "50ml", quantity: 1 },
    ],
  },
  {
    name: "Kit Renovación Profunda",
    description: "Rutina completa de 6 pasos para retos de piel opaca y deshidratada.",
    price: 189900,
    listPrice: 231400,
    status: BundleStatus.ACTIVE,
    items: [
      { productKey: "limpiador-espuma", variantKey: "150ml", quantity: 1 },
      { productKey: "exfoliante-enzimatico", variantKey: "75ml", quantity: 1 },
      { productKey: "serum-vitamina-c", variantKey: "30ml", quantity: 1 },
      { productKey: "contorno-cafeina", variantKey: "15ml", quantity: 1 },
      { productKey: "crema-nocturna", variantKey: "50ml", quantity: 1 },
      { productKey: "protector-ligero", variantKey: "50ml", quantity: 2 },
    ],
  },
  {
    name: "Set de Viaje Mini",
    description: "Una sola pieza en tamaño de viaje, para probar antes de comprometerte al tamaño completo.",
    price: 14900,
    status: BundleStatus.DRAFT,
    items: [{ productKey: "bruma-hidratante", variantKey: "100ml", quantity: 1 }],
  },
  {
    name: "Colección Aniversario Edición Limitada Piel Sensible",
    description: "Edición limitada de aniversario, formulada para piel sensible y reactiva.",
    price: 89900,
    badgeKey: "edicion-limitada",
    status: BundleStatus.ACTIVE,
    items: [
      { productKey: "serum-centella", variantKey: "30ml", quantity: 1 },
      { productKey: "mascarilla-avena", variantKey: "75ml", quantity: 1 },
    ],
  },
  {
    name: "Ritual Matutino",
    description: "Los dos pasos de la mañana: limpieza ligera y protección solar.",
    price: 47900,
    listPrice: 53800,
    status: BundleStatus.ARCHIVED,
    items: [
      { productKey: "gel-purificante", variantKey: "150ml", quantity: 1 },
      { productKey: "protector-ligero", variantKey: "50ml", quantity: 1 },
    ],
  },
  {
    name: "Trío Hidratación",
    description: "Refuerzo de hidratación para las tres capas de la piel: limpieza, sérum y bruma.",
    price: 74900,
    status: BundleStatus.ACTIVE,
    items: [
      { productKey: "limpiador-espuma", variantKey: "150ml", quantity: 1 },
      { productKey: "serum-vitamina-c", variantKey: "15ml", quantity: 1 },
      { productKey: "bruma-hidratante", variantKey: "100ml", quantity: 2 },
    ],
  },
  {
    name: "Paquete Básico",
    description: "Dos aliados de tratamiento para empezar a resolver textura irregular.",
    price: 39900,
    status: BundleStatus.DRAFT,
    items: [
      { productKey: "exfoliante-enzimatico", variantKey: "75ml", quantity: 1 },
      { productKey: "mascarilla-avena", variantKey: "75ml", quantity: 1 },
    ],
  },
  {
    name: "Kit Antiedad Contorno y Sérum",
    description: "Sérum de niacinamida y contorno de ojos con cafeína, para una rutina de firmeza.",
    price: 69900,
    listPrice: 73800,
    badgeKey: "nuevo",
    status: BundleStatus.ACTIVE,
    items: [
      { productKey: "serum-niacinamida", variantKey: "30ml", quantity: 1 },
      { productKey: "contorno-cafeina", variantKey: "15ml", quantity: 1 },
    ],
  },
  {
    name: "Ritual Corporal Nutritivo",
    description: "Crema y aceite corporal para piel muy seca, de la ducha a la cama.",
    price: 62900,
    status: BundleStatus.ACTIVE,
    items: [
      { productKey: "crema-corporal-karite", variantKey: "200ml", quantity: 1 },
      { productKey: "aceite-corporal-seco", variantKey: "100ml", quantity: 1 },
    ],
  },
  {
    name: "Set Labios y Manos",
    description: "Los dos básicos de bolsa: bálsamo labial y crema de manos.",
    price: 24900,
    badgeKey: "recomendado",
    status: BundleStatus.ACTIVE,
    items: [
      { productKey: "balsamo-labial", variantKey: "10g", quantity: 1 },
      { productKey: "crema-manos", variantKey: "75ml", quantity: 1 },
    ],
  },
  {
    name: "Protección Total FPS",
    description: "Protector solar de rostro más protector en polvo para retocar sobre el maquillaje.",
    price: 54900,
    listPrice: 59800,
    status: BundleStatus.ACTIVE,
    items: [
      { productKey: "protector-ligero", variantKey: "50ml", quantity: 1 },
      { productKey: "protector-polvo", variantKey: "8g", quantity: 1 },
    ],
  },
  {
    name: "Kit Piel Nueva",
    description: "Exfoliante enzimático, sérum de vitamina C y aceite nutritivo — renovación de principio a fin.",
    price: 99900,
    badgeKey: "vegano",
    status: BundleStatus.ACTIVE,
    items: [
      { productKey: "exfoliante-enzimatico", variantKey: "75ml", quantity: 1 },
      { productKey: "serum-vitamina-c", variantKey: "15ml", quantity: 1 },
      { productKey: "aceite-nutritivo", variantKey: "30ml", quantity: 1 },
    ],
  },
];

interface SeedCatalogDemoResult {
  outcome: "seeded" | "skipped";
  categories: number;
  badges: number;
  products: number;
  bundles: number;
}

/**
 * Núcleo sin `connectDatabase()`/`disconnectDatabase()` propios (mismo
 * criterio que `seed-admin.ts`): opera sobre la conexión ya activa.
 */
async function seedCatalogDemo(): Promise<SeedCatalogDemoResult> {
  const alreadySeeded = await Category.exists({ slug: "limpieza" });
  if (alreadySeeded) {
    logger.warn("El catálogo de demo ya existe (categoría 'limpieza' encontrada) — el seed no hace nada.");
    return { outcome: "skipped", categories: 0, badges: 0, products: 0, bundles: 0 };
  }

  const categoryIdByKey = new Map<string, string>();
  for (const root of CATEGORY_TREE) {
    const rootDoc = await createCategory({ name: root.name });
    categoryIdByKey.set(root.key, rootDoc._id.toString());
    for (const child of root.children) {
      const childDoc = await createCategory({ name: child.name, parentId: rootDoc._id.toString() });
      categoryIdByKey.set(child.key, childDoc._id.toString());
    }
  }
  const categoryCount = categoryIdByKey.size;

  const badgeIdByKey = new Map<string, string>();
  for (const badge of BADGES) {
    const badgeDoc = await createBadge({ text: badge.text, color: badge.color });
    badgeIdByKey.set(badge.key, badgeDoc._id.toString());
  }

  const productRefByKey = new Map<string, { productId: string; variantIdByKey: Map<string, string> }>();
  for (const product of PRODUCTS) {
    const categoryId = categoryIdByKey.get(product.categoryKey);
    if (!categoryId) throw new Error(`Categoría desconocida en el seed: ${product.categoryKey}`);

    const input: CreateProductInput = {
      name: product.name,
      description: product.description,
      shortDescription: product.shortDescription,
      categoryId,
      badgeId: product.badgeKey ? (badgeIdByKey.get(product.badgeKey) ?? null) : null,
      channel: ProductChannel.STORE,
      content: product.content,
      variants: product.variants.map((variant) => ({
        sku: variant.sku,
        name: variant.name,
        attributes: variant.attributes ?? {},
        price: variant.price,
        ...(variant.listPrice !== undefined ? { listPrice: variant.listPrice } : {}),
        weightGrams: variant.weightGrams,
        dimensionsCm: variant.dimensionsCm,
        isActive: true,
        initialStock: variant.initialStock,
      })),
    };

    const doc = await createProduct(input);
    if (product.status !== ProductStatus.DRAFT) {
      await updateProduct(doc._id.toString(), { status: product.status });
    }

    const variantIdByKey = new Map<string, string>();
    for (const [index, variant] of product.variants.entries()) {
      const savedVariant = doc.variants[index];
      if (savedVariant) variantIdByKey.set(variant.key, savedVariant._id.toString());
    }
    productRefByKey.set(product.key, { productId: doc._id.toString(), variantIdByKey });
  }

  for (const bundle of BUNDLES) {
    const items = bundle.items.map((item) => {
      const ref = productRefByKey.get(item.productKey);
      if (!ref) throw new Error(`Producto desconocido en el seed de paquetes: ${item.productKey}`);
      const variantId = ref.variantIdByKey.get(item.variantKey);
      if (!variantId) {
        throw new Error(`Variante desconocida en el seed de paquetes: ${item.productKey}/${item.variantKey}`);
      }
      return { productId: ref.productId, variantId, quantity: item.quantity };
    });

    const doc = await createBundle({
      name: bundle.name,
      description: bundle.description,
      price: bundle.price,
      ...(bundle.listPrice !== undefined ? { listPrice: bundle.listPrice } : {}),
      badgeId: bundle.badgeKey ? (badgeIdByKey.get(bundle.badgeKey) ?? null) : null,
      content: bundle.content,
      items,
    });
    if (bundle.status !== BundleStatus.DRAFT) {
      await updateBundle(doc._id.toString(), { status: bundle.status });
    }
  }

  return {
    outcome: "seeded",
    categories: categoryCount,
    badges: badgeIdByKey.size,
    products: productRefByKey.size,
    bundles: BUNDLES.length,
  };
}

/** Entrypoint de CLI: `pnpm --filter api seed:catalog [--force en producción]`. */
async function main(): Promise<void> {
  if (env.isProduction && !process.argv.includes(FORCE_FLAG)) {
    throw new Error(`Seed rehusado en producción. Pasa ${FORCE_FLAG} si de verdad quieres correrlo aquí.`);
  }

  await connectDatabase();
  try {
    const result = await seedCatalogDemo();
    if (result.outcome === "skipped") {
      logger.info("Seed de catálogo de demo: ya existía, no se tocó nada.");
    } else {
      logger.info(result, "Seed de catálogo de demo completado");
    }
  } finally {
    await disconnectDatabase();
  }
}

const isMainModule =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      logger.error({ err: error }, "Fallo el seed de catálogo de demo");
      process.exit(1);
    });
}

export { seedCatalogDemo };
