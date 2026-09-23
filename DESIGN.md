---
name: Esencia Glow — Dashboard
description: Sistema de diseño del panel administrativo — preciso, confiable, editorial-suave.
colors:
  background: "oklch(0.9873 0.0069 354.7893)"
  foreground: "oklch(0.4015 0.0436 37.9587)"
  surface: "oklch(1.0000 0 0)"
  surface-foreground: "oklch(0.4015 0.0436 37.9587)"
  primary: "oklch(0.8502 0.0851 6.1876)"
  primary-action: "oklch(0.56 0.0851 6.1876)"
  primary-foreground: "oklch(1.0000 0 0)"
  secondary: "oklch(0.8747 0.0544 172.6283)"
  secondary-foreground: "oklch(0.3821 0.0407 166.3004)"
  muted: "oklch(0.9706 0.0124 358.7577)"
  muted-foreground: "oklch(0.6265 0.0418 357.7265)"
  muted-foreground-strong: "oklch(0.50 0.0418 357.7265)"
  accent: "oklch(0.9557 0.0615 92.1287)"
  accent-foreground: "oklch(0.5630 0.0874 87.6337)"
  accent-foreground-strong: "oklch(0.53 0.0874 87.6337)"
  destructive: "oklch(0.7653 0.1404 16.0328)"
  destructive-action: "oklch(0.56 0.1404 16.0328)"
  destructive-foreground: "oklch(1.0000 0 0)"
  border: "oklch(0.9366 0.0345 359.8126)"
  border-strong: "oklch(0.66 0.0345 359.8126)"
  input: "oklch(0.9958 0.0025 345.2100)"
  ring: "oklch(0.56 0.0851 6.1876)"
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
  sm: "6px"
  md: "8px"
  lg: "12px"
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
    backgroundColor: "oklch(0.51 0.0851 6.1876)"
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

**Divergencia deliberada del starter de paleta.** Los valores de color que Manuel entregó (paleta
OKLCH) son la fuente de verdad y no se tocan. El `--radius: 1.25rem` y las sombras rosas difusas de
ese mismo archivo, en cambio, eran parte de un ejemplo de partida, no una decisión cerrada — el
plan aprobado de esta sesión fija el radio en 8–12px y elimina la sombra decorativa a favor de
bordes estructurales. Ver la Regla del Listón más abajo.

**Key Characteristics:**
- Datos y etiquetas en PT Mono; conversación humana en Schibsted Grotesk. Nunca se mezclan roles.
- Plano por default; sombra solo en lo que literalmente flota sobre el contenido (menú, popover,
  modal, toast).
- El rosa es un acento que se gana su lugar: una acción primaria, un estado activo, nunca un fondo
  grande.
- Todo estado (carga, error, vacío, deshabilitado, sin permiso) se diseña explícitamente — nunca se
  improvisa en el momento de construir la pantalla.

## 2. Colors

La paleta es casi enteramente neutra — un rosa tibio, un verde menta y un amarillo mantequilla como
los únicos acentos — sobre superficies casi blancas con un dejo cálido. Ningún color decorativo
aparece salvo por los cuatro roles documentados abajo.

### Primary
- **Rosa Bitácora** (`oklch(0.8502 0.0851 6.1876)`, ≈ `#ffb7c5`): superficie suave — **fondo del
  botón primario**, chip de estado "activo", resaltado de fila seleccionada, fondo del ítem de
  navegación activo. Nunca lleva texto blanco encima (falla WCAG con 1.64:1 — ver Regla del Listón).
  Con texto tinta (`foreground`) encima da 5.69:1, AA limpio, y así es como se usa siempre.
- **Rosa Acción** (`oklch(0.56 0.0851 6.1876)`, ≈ `#9f5f6d`, token derivado `primary-action`):
  el rosa llevado a fuerza de trazo — anillo de foco, borde de input enfocado, texto de énfasis
  sobre fondo claro. Contra el fondo de página da 4.68:1, suficiente para leerse como anillo y como
  borde. No es fondo de botón: ese lugar es del Rosa Bitácora con tinta.

### Secondary
- **Menta** (`oklch(0.8747 0.0544 172.6283)`, ≈ `#b2e2d2`): reservado para el estado "pagado" /
  "entregado" / confirmaciones positivas discretas. Su texto (`secondary-foreground`,
  `oklch(0.3821 0.0407 166.3004)`) da 6.80:1, AA limpio sin derivar nada.

### Tertiary
- **Mantequilla** (`oklch(0.9557 0.0615 92.1287)`, ≈ `#fff0c2`): estado "pendiente" / "atención
  requerida" (inventario bajo, ventana de inscripción por cerrar). Su texto normal
  (`accent-foreground`, `oklch(0.5630 0.0874 87.6337)`) da 4.06:1 — pasa el umbral de 3:1 de texto
  grande/etiqueta pero NO el de 4.5:1 de cuerpo. Para texto de cuerpo sobre este fondo usar
  `accent-foreground-strong` (`oklch(0.53 0.0874 87.6337)`, ≈ `#816829`, 4.67:1, AA limpio).

### Neutral
- **Fondo** (`oklch(0.9873 0.0069 354.7893)`, ≈ `#fff9fb`): lienzo de página.
- **Superficie** (`oklch(1.0000 0 0)`): tarjetas, tabla, popover, modal — blanco puro, un paso más
  claro que el fondo para que la superficie se distinga sin sombra.
- **Tinta** (`oklch(0.4015 0.0436 37.9587)`, ≈ `#5d4037`): texto principal. 8.96:1 sobre fondo,
  9.32:1 sobre superficie.
- **Tinta tenue** (`oklch(0.6265 0.0418 357.7265)`, ≈ `#9e7e88`, token `muted-foreground`): texto
  secundario de bajo compromiso — placeholder, texto deshabilitado, metadatos decorativos donde
  WCAG no exige contraste. Da 3.31–3.63:1 según la superficie: **no usar en texto de cuerpo que
  deba leerse siempre**.
- **Tinta tenue fuerte** (`oklch(0.50 0.0418 357.7265)`, ≈ `#785a63`, token derivado
  `muted-foreground-strong`): la misma tinta tenue, oscurecida con margen de lectura cómoda (no
  solo el mínimo legal) para texto de cuerpo real — ayuda de campo, fecha secundaria, conteo,
  cualquier descripción que alguien deba leer siempre. 5.90:1 sobre fondo, 6.14:1 sobre
  superficie (ajustado el 2026-09-22 a pedido de Manuel: la versión anterior, al mínimo AA de
  4.5:1, cansaba la vista en uso real).
- **Borde susurro** (`oklch(0.9366 0.0345 359.8126)`, ≈ `#ffe1e9`, token `border`): 1.17–1.22:1
  contra fondo/superficie — deliberadamente casi invisible. Solo para separar agrupaciones donde el
  espaciado ya comunica la división (grupos del sidebar, filas de tabla alternas).
- **Borde estructural** (`oklch(0.66 0.0345 359.8126)`, ≈ `#a58a91`, token derivado
  `border-strong`): 3.04–3.16:1 contra fondo/superficie, el mínimo AA para límites de control no
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
- **overlay** (`box-shadow: 0 8px 24px -6px oklch(0.4015 0.0436 37.9587 / 0.18)`): menú de select,
  dropdown, popover, tooltip. Sombra ajustada, borde de 1px `border-strong` incluido en la misma
  superficie.
- **modal** (`box-shadow: 0 16px 48px -8px oklch(0.4015 0.0436 37.9587 / 0.22)`): diálogo modal,
  hoja lateral (sheet), toast. La única sombra con alcance visual notorio del sistema — se reserva
  para lo que de verdad bloquea o interrumpe el flujo.

### Named Rules
**La Regla de lo que Flota.** Si un elemento no se despega físicamente del documento (no es un
overlay, no aparece sobre otro contenido), no lleva sombra. Punto. Una tarjeta en reposo se separa
con `border-strong`, nunca con `box-shadow`. Los botones también quedan dentro de esta regla: su
hover es un cambio de color, no una elevación — ver Components → Buttons.

## 5. Components

### Buttons
- **Forma:** esquinas suavizadas (`rounded.md`, 8px); nunca el `rounded.full` de 999px salvo en
  badges y avatares.
- **Primario:** fondo `primary` (Rosa Bitácora, `#ffb7c5`), texto **tinta** (`foreground`, 5.69:1,
  AA limpio), padding `10px 16px`, tipografía Cuerpo (Schibsted 400, 14px). El rosa suave es el que
  identifica a la marca, así que es él —no su derivado oscuro— el que ocupa la acción primaria; lo
  único prohibido es vestirlo de texto blanco (1.64:1, ilegible), que es justo como venía del tema
  original. *Hover:* rosa un paso más oscuro (`oklch(0.82 0.0851 6.1876)`, tinta a 5.15:1).
  *Focus-visible:* anillo de 2px en `ring` (`primary-action`) con
  2px de offset — nunca `outline: none` sin reemplazo. *Active:* `oklch(0.79 0.0851 6.1876)` (tinta
  a 4.64:1, el paso más oscuro que conserva margen sobre el 4.5:1 de AA),
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
- **Destructivo:** fondo `destructive-action` (`#b84c58`), texto blanco. Misma anatomía de estados
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
- **Focus:** el borde y la etiqueta cambian juntos a `primary-action` (4.68:1 contra el fondo,
  medido) — sin halo adicional, el color compartido entre borde y etiqueta ya comunica el estado.
  Transición de 120ms en `border-color`/`color`, `ease-out-quart`.
- **Error:** borde y etiqueta en `destructive-action` (4.81:1 contra el fondo, medido), texto de
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
- **Opción seleccionada:** fondo `primary` (el rosa suave de superficie) con un ícono Phosphor
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

- **Color:** `accent-foreground-strong` (el mismo tono mantequilla/dorado que ya usa el sistema para
  atención — 5.10:1 contra fondo, 5.30:1 contra superficie, medido). Es la única excepción a "los
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
  encima — es el único par rosa/blanco del sistema que pasa AA (4.87:1, medido).
- **Do** declarar `--surface-bg` en la raíz de todo componente que defina una superficie (`body`,
  `Card`, `Modal`, `Popover`) con su color real — el `<label>` del input de muesca (y cualquier
  elemento futuro que necesite "saber" en qué superficie vive) depende de esa cascada para tapar
  su fondo correctamente.
- **Do** diseñar explícitamente los seis estados de cada control interactivo (default, hover,
  focus-visible, active, loading/error, disabled) antes de dar por terminado un componente.
- **Do** citar el mismo texto de las anti-referencias de `PRODUCT.md` cuando se rechace un patrón,
  para que la razón quede trazable entre los dos documentos.

### Don't:
- **Don't** poner texto blanco sobre `primary` (el rosa de superficie suave) — mide 1.64:1, muy por
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
