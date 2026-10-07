---
name: Esencia Glow — Dashboard
description: Sistema de diseño del panel administrativo — preciso, confiable, editorial-suave.
colors:
  background: "oklch(0.9859 0.0076 48.6568)"
  foreground: "oklch(0.2 0 0)"
  surface: "oklch(1.0000 0 0)"
  surface-foreground: "oklch(0.2 0 0)"
  primary: "oklch(0.7508 0.1610 2.6024)"
  primary-hover: "oklch(0.71 0.1610 2.6024)"
  primary-active: "oklch(0.67 0.1610 2.6024)"
  primary-action: "oklch(0.5367 0.1530 7.7575)"
  primary-foreground: "oklch(1.0000 0 0)"
  secondary: "oklch(0.9449 0.0110 54.4941)"
  secondary-foreground: "oklch(0.2 0 0)"
  muted: "oklch(0.9687 0.0086 44.8919)"
  muted-foreground: "oklch(0.6608 0.0272 49.5764)"
  muted-foreground-strong: "oklch(0.50 0.0272 49.5764)"
  accent: "oklch(0.9239 0.0415 1.1045)"
  accent-foreground: "oklch(0.5367 0.1530 7.7575)"
  accent-foreground-strong: "oklch(0.50 0.1530 7.7575)"
  destructive: "oklch(0.6256 0.1933 23.0261)"
  destructive-action: "oklch(0.50 0.1933 23.0261)"
  destructive-action-hover: "oklch(0.45 0.1933 23.0261)"
  destructive-foreground: "oklch(0.9921 0.0017 325.5900)"
  border: "oklch(0.9138 0.0146 50.7928)"
  border-strong: "oklch(0.64 0.0146 50.7928)"
  input: "oklch(1.0000 0 0)"
  ring: "oklch(0.5367 0.1530 7.7575)"
typography:
  display:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  page-title:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  section-title:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  subtitle:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  body-sm:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "PT Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0.06em"
  data:
    fontFamily: "PT Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  none: "0px"
  sm: "4px"
  md: "6px"
  lg: "8px"
  full: "999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
  10: "40px"
  12: "48px"
  16: "64px"
  20: "80px"
components:
  button-primary:
    backgroundColor: "{colors.primary-action}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-primary-disabled:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.muted-foreground}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-destructive:
    backgroundColor: "{colors.destructive-action}"
    textColor: "{colors.destructive-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  input-default:
    backgroundColor: "{colors.input}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "9px 12px"
  input-error:
    textColor: "{colors.destructive-action}"
  badge:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.muted-foreground-strong}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "3px 10px"
  nav-item:
    textColor: "{colors.muted-foreground-strong}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  nav-item-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.foreground}"
---

# Design System: Esencia Glow — Dashboard

## 1. Overview

**Creative North Star: "La Bitácora de Esencia Glow"**

El panel se piensa como el cuaderno de bitácora de una botica: cada pantalla es un registro
preciso de lo que pasa en el negocio, no un escaparate. La voz tipográfica lo declara desde el
primer trazo — PT Mono en cada dato, SKU, precio y etiqueta se alinea solo, como una columna de
libro mayor; Schibsted Grotesk lleva la conversación humana (títulos, texto corrido) con calidez
contenida. El rosa de la marca aparece como aparecería un listón en un cuaderno real: marca lo que
importa ahora mismo — una acción primaria, un ítem activo — y desaparece en todo lo demás. La
estructura es plana y editorial: bordes de un pixel dividen la página como líneas de una hoja
rayada, nunca sombras decorativas fingiendo profundidad.

Esto rechaza explícitamente lo que `PRODUCT.md` nombra como anti-referencia: la fila de métricas
heroicas, la rejilla de tarjetas idénticas, las franjas de color decorativas, la tarjeta de upsell
con degradado y el asistente de IA con esfera. Ninguna pantalla del panel se apoya en esos recursos
para parecer "terminada" — se apoya en que el dato correcto esté donde se necesita.

**Paleta de la clienta (2026-10-07).** Los colores, radios y sombras vienen del tema que eligió la
clienta (rosa sobre crema) y aplican a la tienda y al panel por igual. Dos decisiones de Manuel
sobre ese tema: el texto principal es tinta negra (`oklch(0.2 0 0)`), no el café del archivo, y el
fondo suave del storefront (`blush`: header, hero, secciones) usa su beige, no un rosa. Su tema trae
un solo tono por rol; los tokens `*-hover`, `*-active`, `*-action` y `*-strong` son derivados
(mismo croma y matiz, menos luminosidad) hasta pasar AA. La tipografía del tema no se adoptó.

**Key Characteristics:**
- Datos y etiquetas en PT Mono; conversación humana en Schibsted Grotesk. Nunca se mezclan roles.
- Plano por default; sombra solo en lo que literalmente flota sobre el contenido (menú, popover,
  modal, toast).
- El rosa es un acento que se gana su lugar: una acción primaria, un estado activo, nunca un fondo
  grande.
- Todo estado (carga, error, vacío, deshabilitado, sin permiso) se diseña explícitamente — nunca se
  improvisa en el momento de construir la pantalla.

## 2. Colors

La paleta es cálida y casi neutra — crema de fondo, beige de apoyo y tinta negra — con un rosa vivo
como único color de marca y un rosa claro para la atención. Ningún color decorativo aparece salvo
por los roles documentados abajo.

### Primary
- **Rosa de marca** (`oklch(0.7508 0.1610 2.6024)`, ≈ `#ff7ea5`): **fondo del botón primario**,
  chip de estado "activo", resaltado de fila seleccionada, fondo del ítem de navegación activo.
  Nunca lleva texto blanco encima (2.39:1 — ver Regla del Listón). Con texto tinta (`foreground`)
  da 7.57:1, y así es como se usa siempre. Tampoco sirve como borde ni como texto sobre el fondo
  (2.29:1): para eso está el Rosa Acción.
- **Rosa Acción** (`oklch(0.5367 0.1530 7.7575)`, ≈ `#b33e5d`, token `primary-action`; es el
  `accent-foreground` del tema): el rosa llevado a fuerza de trazo — anillo de foco, borde de input
  enfocado, texto de énfasis sobre fondo claro. Contra el fondo de página da 5.35:1; con texto
  blanco encima, 5.58:1.

### Secondary
- **Beige** (`oklch(0.9449 0.0110 54.4941)`, ≈ `#f3ebe6`): estado "pagado" / "entregado" /
  confirmaciones positivas discretas, y fondo suave del storefront (`blush`). Su texto
  (`secondary-foreground`) es la tinta, 15.37:1. **Ya no es un color propio de "éxito":** se
  distingue del badge neutro (`muted`) solo por un paso de tono, así que un estado positivo debe
  apoyarse en su texto o su ícono, nunca solo en el color.

### Tertiary
- **Rosa claro** (`oklch(0.9239 0.0415 1.1045)`, ≈ `#ffdbe4`): estado "pendiente" / "atención
  requerida" (inventario bajo, ventana de inscripción por cerrar). El `accent-foreground` del tema
  (`oklch(0.5367 0.1530 7.7575)`) da 4.38:1 sobre él — pasa para texto grande/etiqueta pero no para
  cuerpo. Para texto de cuerpo usar `accent-foreground-strong` (`oklch(0.50 0.1530 7.7575)`,
  ≈ `#a73253`, 5.13:1).

### Destructive
- **Rojo** (`oklch(0.6256 0.1933 23.0261)`, ≈ `#e5484d`): solo como fondo suave al 40 % de los
  estados negativos. Con texto blanco da 3.91:1, por eso no es fondo de botón.
- **Rojo Acción** (`oklch(0.50 0.1933 23.0261)`, ≈ `#b81228`, token derivado
  `destructive-action`): fondo del botón destructivo (blanco a 6.65:1), texto y borde de error.
  Está a solo 20° de matiz del rosa de marca: un error nunca se comunica solo con color, siempre
  lleva su ícono `WarningCircle` y su mensaje.

### Neutral
- **Fondo** (`oklch(0.9859 0.0076 48.6568)`, ≈ `#fff9f6`): lienzo de página, crema.
- **Superficie** (`oklch(1.0000 0 0)`): tarjetas, tabla, popover, modal, relleno de input — blanco
  puro, un paso más claro que el fondo para que la superficie se distinga sin sombra.
- **Tinta** (`oklch(0.2 0 0)`, ≈ `#161616`): texto principal. 17.36:1 sobre fondo,
  18.10:1 sobre superficie.
- **Tinta tenue** (`oklch(0.6608 0.0272 49.5764)`, ≈ `#a18e84`, token `muted-foreground`): texto
  secundario de bajo compromiso — placeholder, texto deshabilitado, metadatos decorativos donde
  WCAG no exige contraste. Da 3.00–3.13:1 según la superficie: **no usar en texto de cuerpo que
  deba leerse siempre**.
- **Tinta tenue fuerte** (`oklch(0.50 0.0272 49.5764)`, ≈ `#715f56`, token derivado
  `muted-foreground-strong`): la misma tinta tenue, oscurecida con margen de lectura cómoda (no
  solo el mínimo legal) para texto de cuerpo real — ayuda de campo, fecha secundaria, conteo,
  cualquier descripción que alguien deba leer siempre. 5.80:1 sobre fondo, 6.05:1 sobre
  superficie, 5.14:1 sobre el beige.
- **Borde susurro** (`oklch(0.9138 0.0146 50.7928)`, ≈ `#ebe0da`, token `border`): 1.24–1.30:1
  contra fondo/superficie — deliberadamente casi invisible. Solo para separar agrupaciones donde el
  espaciado ya comunica la división (grupos del sidebar, filas de tabla alternas).
- **Borde estructural** (`oklch(0.64 0.0146 50.7928)`, ≈ `#948a84`, token derivado
  `border-strong`): 3.24–3.38:1 contra fondo/superficie, el mínimo AA para límites de control no
  textuales (input, tabla, botón secundario, tarjeta). Es el borde por default de cualquier
  contenedor que necesite leerse como contenedor.

### Named Rules
**La Regla del Listón.** El rosa marca una sola cosa a la vez por vista: la acción primaria o el
ítem activo de navegación. Nunca es el fondo de una sección completa ni el color de más de un
elemento simultáneo en la misma pantalla — como un listón, señala un lugar, no tiñe el libro.

**La Regla de las Dos Tintas.** Todo texto secundario usa `muted-foreground` (tenue) o
`muted-foreground-strong` (tenue fuerte) según si el contenido es decorativo/exento de WCAG
(placeholder, disabled) o texto real que alguien debe poder leer siempre. Nunca se decide a ojo.

## 3. Typography

**Display / Título / Cuerpo:** Schibsted Grotesk (con `ui-sans-serif, system-ui, sans-serif` de
respaldo).
**Etiqueta / Dato:** PT Mono (con `ui-monospace, SFMono-Regular, Menlo, monospace` de respaldo).

**Character:** Schibsted Grotesk lleva la voz humana — títulos con algo de carácter editorial,
cuerpo legible sin pretensión. PT Mono lleva el registro — nombres de campo, cifras, SKU, estados;
su métrica fija hace que las columnas de una tabla de inventario o de precios se alineen solas, sin
tabulación manual. Los dos roles nunca se mezclan dentro del mismo elemento: una etiqueta no lleva
Schibsted, un párrafo no lleva PT Mono.

**Confirmado contra la API de Google Fonts, no de memoria:** PT Mono solo existe en peso 400, sin
itálica — cualquier `font-weight` distinto de 400 cae en la misma cara regular. Por eso
`font-synthesis: none` es obligatorio en el `<html>` del proyecto: sin esa regla, el navegador
engordaría sintéticamente cada `<strong>`/`<th>` que caiga en PT Mono, deformando los trazos.
Schibsted Grotesk sí tiene 400/500/600 reales, verificados igual.

### Hierarchy
- **Display** (600, 36px, línea 1.15, `-0.01em`): la única cifra que un vistazo debe capturar antes
  que cualquier otra cosa en la pantalla — el total de un pedido en su detalle, el monto de un
  reembolso a confirmar. No es un patrón de KPI recurrente; aparece una vez por vista, cuando de
  verdad hay un número que manda.
- **Título de página** (600, 28px, línea 1.2, `-0.01em`): el nombre de la sección — "Productos",
  "Pedidos", "Suscripciones" — siempre en la misma posición del layout.
- **Título de sección** (600, 20px, línea 1.25): encabezado de un bloque dentro de la página
  (dentro del detalle de un pedido: "Artículos", "Envío", "Pagos").
- **Subtítulo** (500, 16px, línea 1.4): dato secundario con peso propio — el nombre de un producto
  dentro de una fila expandida, un subtítulo de tarjeta.
- **Cuerpo** (400, 14px, línea 1.55, tope 65–75ch): texto corrido — descripciones, notas,
  confirmaciones. El peso 400 de Schibsted es el piso de legibilidad del sistema.
- **Cuerpo pequeño** (400, 13px, línea 1.5): ayuda de campo, texto de apoyo bajo un input, nota al
  pie de una tabla.
- **Etiqueta** (PT Mono 400, 12px, línea 1.3, `+0.06em`, MAYÚSCULAS): nombre de campo, encabezado de
  columna de tabla, ítem de navegación, texto de badge. La caja alta y el tracking hacen el trabajo
  de énfasis que el peso no puede dar en una fuente de un solo peso.
- **Dato** (PT Mono 400, 14px, línea 1.4, `tabular-nums`): SKU, precio, cantidad, fecha corta,
  cualquier cifra que deba alinearse en columna.

### Named Rules
**La Regla del Peso Único.** PT Mono nunca simula un peso que no tiene. Cualquier énfasis dentro de
un dato (un SKU crítico, un stock en cero) se logra con color (`destructive-action`) o con la
etiqueta de estado que lo acompaña, nunca con `font-weight: 700` sobre PT Mono.

## 4. Elevation

El sistema es plano en reposo: la separación entre bloques la dan el espaciado y el borde
estructural de 1px, nunca una sombra. La sombra existe únicamente como señal de que algo se
despegó del flujo normal de la página — un menú desplegado, un popover, un modal, un toast — y
usa la tinta del sistema a baja opacidad, nunca el rosa de marca (una sombra rosa difusa lee como
decoración, no como profundidad real).

### Shadow Vocabulary
- **overlay** (`box-shadow: 0 2px 10px 0 oklch(0 0 0 / 0.03), 0 2px 4px -1px oklch(0 0 0 / 0.03)`):
  menú de select, dropdown, popover, tooltip. Sombra apenas perceptible (la del tema de la clienta), borde de 1px `border-strong` incluido en la misma
  superficie.
- **modal** (`box-shadow: 0 2px 10px 0 oklch(0 0 0 / 0.03), 0 8px 10px -1px oklch(0 0 0 / 0.03)`):
  diálogo modal, hoja lateral (sheet), toast. Igual de tenue: lo que separa a un modal de la página
  es su borde `border-strong` y el scrim, no la sombra.

### Named Rules
**La Regla de lo que Flota.** Si un elemento no se despega físicamente del documento (no es un
overlay, no aparece sobre otro contenido), no lleva sombra. Punto. Una tarjeta en reposo se separa
con `border-strong`, nunca con `box-shadow`. Los botones también quedan dentro de esta regla: su
hover es un cambio de color, no una elevación — ver Components → Buttons.

## 5. Components

### Buttons
- **Forma:** esquinas suavizadas (`rounded.md`, 6px); nunca el `rounded.full` de 999px salvo en
  badges y avatares.
- **Primario:** fondo `primary` (Rosa de marca, `#ff7ea5`), texto **tinta** (`foreground`, 7.57:1),
  padding `10px 16px`, tipografía Cuerpo (Schibsted 400, 14px). Lo único prohibido es vestirlo de
  texto blanco (2.39:1, ilegible), que es justo como viene en el tema original. *Hover:* rosa un
  paso más oscuro (`primary-hover`, tinta a 6.51:1). *Focus-visible:* anillo de 2px en `ring`
  (`primary-action`) con 2px de offset — nunca `outline: none` sin reemplazo. *Active:*
  `primary-active` (tinta a 5.58:1),
  sin desplazamiento de layout (nunca `transform: scale` que mueva el contenido vecino). *Loading:*
  el label se reemplaza por un spinner de 16px en el mismo tono de texto, el botón mantiene su
  ancho (se fija con `min-width` calculado en reposo) para que el layout no salte, y queda
  `aria-busy="true"` + `disabled`. *Disabled:* fondo `muted`, texto `muted-foreground`, cursor
  `not-allowed`, sin hover ni focus ring.
- **Secundario:** fondo `surface`, texto `foreground`, borde `border-strong` de 1px. Mismos estados
  hover/focus/active/loading/disabled que el primario, pero el hover oscurece el borde en vez del
  fondo (`border-strong` → tinta) y el fondo gana un tinte de `muted` al 40%.
- **Fantasma:** sin fondo ni borde en reposo, texto `foreground`. *Hover:* fondo `muted`. Se usa
  para acciones secundarias dentro de una fila de tabla o una barra de herramientas, nunca como
  botón primario de una pantalla.
- **Destructivo:** fondo `destructive-action` (`#b81228`), texto blanco; *hover:* `destructive-action-hover`. Misma anatomía de estados
  que el primario. Siempre exige el paso de confirmación que manda `PRODUCT.md` — el botón
  destructivo nunca ejecuta la acción directamente, abre la confirmación.

### Inputs / Fields (incluye textarea)
**Etiqueta de muesca (notched label).** La etiqueta del campo no vive arriba del input como bloque
aparte — se recorta sobre la línea del borde, como la pestaña de una ficha de bitácora. Encaja con
el norte creativo del sistema mejor que una etiqueta flotante convencional: es literalmente una
pestaña de archivo sobre el borde de una tarjeta.

- **Estilo:** fondo `input`, borde `border-strong` de 1.5px (un cuarto de punto más grueso que el
  borde estándar de 1px del resto del sistema — la muesca necesita ese peso extra para leerse como
  intencional, no como un borde perdido), `rounded.md`, padding `11px 12px`, tipografía Cuerpo. La
  etiqueta es un `<label>` posicionado en `absolute`, centrado sobre la línea superior del borde
  (`top: -9px`), con `padding: 0 4px` y tipografía Etiqueta (PT Mono, mayúsculas, `muted-foreground-strong`).
- **Solución al problema de la muesca (resuelto, no solo advertido):** el fondo del `<label>` tiene
  que tapar la línea del borde detrás de él, y ese fondo cambia según dónde viva el campo (página
  vs. tarjeta vs. modal). En vez de que cada instancia del input reciba una prop de "en qué
  superficie estoy", cada componente que *define* una superficie (`body`, `Card`, `Modal`, `Popover`)
  declara una custom property `--surface-bg` en su propio root con el color que le corresponde
  (`background`, `surface`, etc.), y el `<label>` del input simplemente usa
  `background: var(--surface-bg, var(--color-background))` — el fallback cubre el caso de que el
  campo se use suelto sin ningún contenedor que la declare. Como las custom properties de CSS
  heredan en cascada, ningún prop-drilling ni contexto de React hace falta: el label hereda el valor
  correcto del ancestro más cercano que lo definió. Esto **solo funciona porque el sistema prohíbe
  gradientes y glassmorphism** (Do's and Don'ts) — toda superficie es un color plano, así que
  `var(--surface-bg)` siempre tiene un valor sólido que copiar. La única disciplina que exige hacia
  adelante: **todo componente nuevo que introduzca una superficie debe declarar `--surface-bg`** —
  se agrega como regla en Do's and Don'ts para que no se olvide al construir `apps/web`.
- **Focus:** el borde y la etiqueta cambian juntos a `primary-action` (5.35:1 contra el fondo,
  medido) — sin halo adicional, el color compartido entre borde y etiqueta ya comunica el estado.
  Transición de 120ms en `border-color`/`color`, `ease-out-quart`.
- **Error:** borde y etiqueta en `destructive-action` (6.38:1 contra el fondo, medido), texto de
  ayuda debajo en el mismo tono (13px, Cuerpo pequeño), ícono Phosphor `WarningCircle` de 16px al
  inicio del mensaje.
- **Disabled:** borde `border` (el susurro, no el estructural), etiqueta y fondo en `muted`/
  `muted-foreground`, cursor `not-allowed` — un campo deshabilitado no necesita leerse como límite
  activo ni llevar la etiqueta con el mismo peso que uno editable.
- **Readonly:** fondo `surface` en vez de `input`, borde y etiqueta se quedan en su tono de reposo
  (`border-strong`/`muted-foreground-strong`) sin reaccionar al foco, cursor `default` — distinto de
  disabled porque el valor sí se puede seleccionar/copiar.

### Select / Combobox
- **Cerrado:** misma anatomía que un input, con un ícono Phosphor `CaretDown` de 16px al final que
  gira 180° al abrir (transición de `transform`, nunca de `top`/`height`).
- **Abierto:** el menú es un overlay (`shadow.overlay`, `rounded.md`, borde `border-strong`),
  ancla al ancho del control, máximo 320px de alto con scroll propio.
- **Opción resaltada** (hover/teclado): fondo `muted`.
- **Opción seleccionada:** fondo `primary` (el rosa de marca) con un ícono Phosphor
  `Check` de 16px al final, texto `foreground` (nunca blanco sobre `primary` — ver Regla del
  Listón).
- **Vacía:** cuando no hay resultados, el menú muestra un mensaje de Cuerpo pequeño en
  `muted-foreground-strong`, centrado, sin ícono decorativo.

### Checkbox / Radio / Switch
- **Checkbox / Radio:** 18×18px, borde `border-strong` en reposo, `rounded.sm` (checkbox) o
  circular (radio). Marcado: fondo `primary-action`, marca blanca (check o punto). Foco: mismo
  halo de 2px que los inputs. Disabled: opacidad 50%, sin importar el estado marcado.
- **Switch:** pista de 36×20px, `rounded.full`, fondo `muted` apagado / `primary-action` activo;
  perilla blanca de 16px con la sombra `overlay` reducida al 50% para que se lea sobre la pista.
  Transición de `background-color` y de la posición de la perilla (`transform: translateX`, nunca
  `left`).

### Table
- **Encabezado:** fila con fondo `surface`, texto Etiqueta (PT Mono, mayúsculas), borde inferior
  `border-strong`. Columnas numéricas alineadas a la derecha desde el encabezado.
- **Fila:** borde inferior `border` (el susurro — el ritmo de la tabla ya comunica la separación).
  *Hover:* fondo `muted` al 50%. Selección: fondo `primary` suave.
- **Celda de dato:** tipografía Dato (PT Mono, `tabular-nums`) para toda cifra — precio, cantidad,
  SKU, fecha corta.

### Badge
- **Estilo:** `rounded.full`, padding `3px 10px`, tipografía Etiqueta. Fondo `muted` +
  `muted-foreground-strong` por default (estado neutro); `secondary` + `secondary-foreground` para
  estados positivos (pagado, entregado); `accent` + `accent-foreground-strong` para estados de
  atención (pendiente, stock bajo); `destructive` (suave, no `destructive-action`) +
  `destructive-action` como texto para estados negativos (cancelado, fallido) — el fondo se queda
  suave, el texto lleva el peso del contraste.

### Tabs
- **Estilo:** fila de Etiquetas sobre un borde inferior `border`. El tab activo gana un borde
  inferior de 2px en `primary-action` y texto `foreground`; los inactivos usan
  `muted-foreground-strong`. Sin fondo de pastilla — el borde inferior es la única señal de estado,
  consistente con la filosofía de bordes sobre sombras.

### Tooltip
- **Estilo:** fondo `foreground` (tinta oscura), texto `background` (invertido), `rounded.sm`,
  padding `4px 8px`, tipografía Cuerpo pequeño, sombra `overlay`. Aparece con retraso de 400ms,
  desaparece sin retraso.

### Modal / Dialog
- **Estilo:** superficie `surface`, `rounded.lg`, sombra `modal`, borde `border-strong` de 1px,
  padding `24px`. Fondo de la página cubierto por un scrim de tinta al 40% de opacidad, sin blur
  (el sistema no usa glassmorphism). El foco queda atrapado dentro del modal mientras está abierto y
  vuelve al elemento que lo abrió al cerrarlo.

### Toast
- **Estilo:** superficie `surface`, `rounded.md`, sombra `modal`, borde-izquierdo NO — nunca una
  franja lateral de color (prohibición explícita); el estado (éxito/error/info) se comunica con un
  ícono Phosphor de 20px al inicio del toast, no con el borde. Se apila desde una esquina fija,
  máximo 3 visibles a la vez.

### Page States
- **Carga:** skeleton — bloques de `muted` con `rounded` equivalente al contenido real que
  reemplazan, animación de opacidad sutil (0.6↔1, 1.4s, ease-in-out, nunca un spinner de página
  completa salvo en la primera carga de sesión).
- **Vacío:** ícono Phosphor de 32px en `muted-foreground`, título Subtítulo, una línea de Cuerpo
  pequeño explicando por qué está vacío, y si aplica, un botón secundario de acción (nunca primario
  — un estado vacío no es el momento de empujar la acción más agresiva).
- **Error:** mismo layout que vacío, ícono `WarningCircle` en `destructive-action`, con un botón
  secundario de "Reintentar" cuando la operación es reintentable.
- **Sin permisos:** ícono `LockSimple`, mensaje explícito de qué rol se necesita — hoy no aplica
  (un solo operador) pero el estado se diseña desde ahora para no improvisarlo cuando haya roles.

### Shell (sidebar + barra superior)
- **Sidebar:** ancho fijo 260px expandido / 72px colapsado (transición de `width`, 200ms
  ease-out-quart). Grupos con encabezado en Etiqueta (`muted-foreground-strong`), separados por
  `spacing.6` (24px) de aire, nunca por una línea divisoria — el espaciado ya agrupa. Ítem de
  navegación: `nav-item` en reposo, `nav-item-active` (fondo `primary` suave + texto `foreground`)
  para la ruta actual — nunca un borde lateral de color para marcar el activo (prohibición
  explícita: franja lateral). El grupo de Gestión queda anclado al fondo del sidebar,
  visualmente separado del resto por `spacing.8` (32px) de aire.
- **Barra superior:** fondo `surface`, borde inferior `border`, altura 64px. Campo de búsqueda normal
  (sin paleta de comandos ⌘K — se quitó del sistema en el Milestone 2.1: no hay todavía suficientes
  destinos para justificarla) al centro, notificaciones y cuenta a la derecha. Búsqueda y
  notificaciones se **colocan pero quedan inertes** hasta que su sección tenga datos reales que
  buscar o pendientes que mostrar — un control deshabilitado que dice "Próximamente" es honesto; uno
  que aparenta funcionar sin hacerlo no lo es (PRODUCT.md, principio 3). Sin toggle de tema (solo
  claro), sin asistente de IA decorativo.
- **Región de contenido:** título de página (Título de página) + acciones alineadas a la derecha en
  la misma fila, `spacing.6` (24px) de margen respecto al borde del shell.

### Iconography (Phosphor)
- **Peso:** `regular` en todo el sistema — nunca mezclar `regular` con `bold`/`fill` en la misma
  vista. `fill` se reserva exclusivamente para el estado "seleccionado" de un ícono interactivo
  (por ejemplo, un ícono de favorito ya marcado).
- **Tamaño:** 16px dentro de texto/controles (inputs, badges, tabs), 20px en toasts y botones de
  barra de herramientas, 32px en estados de página vacíos/error.
- **Color:** nunca color propio — heredan `currentColor` del texto que acompañan. Un ícono de
  estado de error es rojo porque está dentro de un contenedor `destructive-action`, no porque el
  ícono en sí tenga un color fijo. **Única excepción deliberada:** el Destello — ver el componente
  de firma más abajo.

### Destello (signature component)
El isotipo de Esencia Glow lleva una chispa de cuatro puntas junto al wordmark. Su equivalente más
cercano en Phosphor **no** es `Sparkle` (el ícono de cuatro brillos con cruces pequeñas): ese glifo
es hoy el atajo visual universal de "función de IA" en cualquier producto — usarlo sería importar el
cliché exacto que este sistema evita. El destello del sistema es `StarFour`, una sola estrella de
cuatro puntas cóncavas — más cercana al isotipo real, sin la connotación de "magia de IA".

- **Color:** `accent-foreground-strong` (el mismo rosa profundo que ya usa el sistema para
  atención — 6.26:1 contra fondo, 6.53:1 contra superficie, medido). Es la única excepción a "los
  íconos nunca llevan color propio": el destello es un **activo de marca decorativo**, no un ícono
  funcional de UI, y no convive con controles interactivos.
- **Peso:** `regular` (contorno) como remate discreto junto a un título o wordmark; `fill` (sólido)
  para el momento aislado y más grande — un estado vacío bien resuelto, una confirmación de "listo"
  después de una acción larga (pedido creado, suscripción activada).
- **Tamaño:** 12–16px como remate junto a texto; 24–32px como flourish aislado.
- **Disciplina de uso — la misma Regla del Listón que gobierna el rosa:** el destello marca un
  momento, no decora cada tarjeta. Uno por vista, como máximo, y nunca dentro de una tabla, un
  formulario o cualquier superficie de trabajo repetitivo — ahí es ruido, no acento. Su lugar
  natural es el wordmark del sidebar/login y los remates de marca del storefront (Milestone 3,
  register `brand`); dentro del dashboard (register `product`, "preciso y sobrio") su única
  aparición esperada es el lockup del logo — ni siquiera en los estados vacíos, que ya tienen su
  propio ícono Phosphor neutro documentado en Page States.

### Spacing rhythm
Base 4px (`spacing.1`). El ritmo no es uniforme: `spacing.2`–`spacing.3` (8–12px) entre elementos
que pertenecen al mismo grupo visual (label + input, ícono + texto); `spacing.4`–`spacing.6`
(16–24px) entre bloques dentro de una misma tarjeta o sección; `spacing.8`+ (32px+) entre secciones
independientes de una página. El padding interno de una tarjeta es `spacing.6` (24px); el de un
botón, `10px 16px` (no está en la escala de 4px porque el peso vertical de un botón necesita medio
paso extra para no verse apretado con Schibsted Grotesk 400).

## 6. Do's and Don'ts

### Do:
- **Do** usar PT Mono exclusivamente en dato, etiqueta y navegación; Schibsted Grotesk en todo lo
  demás. Nunca mezclar los dos roles dentro del mismo elemento.
- **Do** usar `border-strong` (3:1 contra fondo/superficie, medido) en cualquier borde que funcione
  como límite de un control — input, tabla, tarjeta, botón secundario.
- **Do** reservar la sombra (`overlay`/`modal`) exclusivamente para lo que se despega del documento:
  menú, popover, modal, toast, tooltip. Todo lo demás es plano.
- **Do** usar `primary-action` (no `primary`) en cualquier superficie sólida con texto blanco
  encima — es el único par rosa/blanco del sistema que pasa AA (5.58:1, medido).
- **Do** declarar `--surface-bg` en la raíz de todo componente que defina una superficie (`body`,
  `Card`, `Modal`, `Popover`) con su color real — el `<label>` del input de muesca (y cualquier
  elemento futuro que necesite "saber" en qué superficie vive) depende de esa cascada para tapar
  su fondo correctamente.
- **Do** diseñar explícitamente los seis estados de cada control interactivo (default, hover,
  focus-visible, active, loading/error, disabled) antes de dar por terminado un componente.
- **Do** citar el mismo texto de las anti-referencias de `PRODUCT.md` cuando se rechace un patrón,
  para que la razón quede trazable entre los dos documentos.

### Don't:
- **Don't** poner texto blanco sobre `primary` (el rosa de marca) — mide 2.39:1, muy por
  debajo de AA. Usar `primary-action` o texto `foreground`.
- **Don't** usar el ícono `Sparkle` de Phosphor (cuatro brillos con cruces pequeñas) en ningún lugar
  del sistema — es el atajo visual genérico de "función de IA" en el diseño de producto actual. El
  destello del sistema es `StarFour`, más cercano al isotipo real de la marca.
- **Don't** repetir el destello en más de un lugar por vista, ni usarlo dentro de tablas,
  formularios o cualquier superficie de trabajo repetitivo — ver Regla del Listón.
- **Don't** usar franjas laterales de color (`border-left`/`border-right` mayor a 1px) en tarjetas,
  toasts, ítems de lista o el ítem activo del sidebar — ver Regla del Listón y la anti-referencia
  de "franjas de color decorativas" de `PRODUCT.md`.
- **Don't** construir la fila de cuatro KPI idénticos con número gigante + delta verde/rojo —
  plantilla de métrica heroica, anti-referencia explícita de `PRODUCT.md`.
- **Don't** responder a "necesito mostrar contenido" con una rejilla de tarjetas idénticas por
  reflejo — la mayoría del contenido de un dashboard es tabla, lista o detalle, no una tarjeta.
- **Don't** usar `rounded.full` (999px) fuera de badges y avatares — ni en botones ni en tarjetas.
- **Don't** usar degradados en texto (`background-clip: text`) ni glassmorphism decorativo en
  ninguna superficie.
- **Don't** usar un modal como primera respuesta a una interacción que cabe inline o en un panel
  lateral — agotar esa alternativa antes de abrir un modal.
- **Don't** dejar `font-weight` distinto de 400 sobre PT Mono sin `font-synthesis: none` activo —
  la fuente no tiene bold real, el navegador lo fabricaría mal.
- **Don't** usar rayas em en ningún copy del panel.
- **Don't** ofrecer un toggle de tema oscuro que no hace nada — el sistema es solo claro por ahora;
  los tokens `.dark` quedan documentados como reserva en el sidecar, no expuestos en la UI.
