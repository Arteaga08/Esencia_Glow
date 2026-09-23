# Product

## Register

product

## Users

Manuel, único operador del panel por ahora (no hay roles ni permisos granulares todavía: cualquier
sección futura de "roles" queda fuera de alcance hasta que haya más de una persona operando). Usa el
panel en sesiones de trabajo enfocadas desde escritorio, para administrar el negocio completo:
catálogo, inventario, pedidos, envíos, suscripciones, clientes y contenido del home. La tarea
primaria en cualquier pantalla es leer un dato correcto y actuar sobre él sin ambigüedad — nunca
navegar por explorar.

## Product Purpose

Panel administrativo hecho a la medida de Esencia Glow (e-commerce de skincare y lifestyle con
suscripción curada) para operar todo lo que el backend ya expone: productos, categorías, paquetes,
badges, inventario por variante, pedidos, envíos, cuentas y ediciones de suscripción, clientes y el
contenido del home. Éxito es que Manuel pueda confirmar el estado real del negocio (¿qué se vendió,
qué falta surtir, qué suscripción necesita atención?) en el menor número de pantallas, sin dudar si
un número está actualizado o si una acción ya se aplicó.

## Brand Personality

**Rápido y eficiente, confiable y con control, preciso y sobrio.**

No es la marca cálida y dulce de la tienda pública — es la herramienta detrás de ella. Prioriza
densidad de información correcta sobre decoración. Ninguna acción destructiva ocurre sin
confirmación explícita, ningún estado de carga miente, ninguna cifra se muestra sin saber si está
fresca o en caché. La eficiencia no es minimalismo vacío: es que cada pantalla resuelva la tarea que
promete, sin pasos de más.

## Anti-references

Se rechaza explícitamente el panel "Shopeers" que Manuel mandó como ejemplo de shell (se conserva
su estructura de sidebar/barra superior, se rechaza su contenido):

- **La fila de cuatro KPI idénticos** (número gigante + etiqueta chica + delta verde/rojo). Plantilla
  de métrica heroica, el cliché más reconocible del género SaaS.
- **La rejilla de tarjetas iguales** como respuesta genérica a todo el contenido, sin jerarquía real
  entre lo importante y lo accesorio.
- **Franjas de color decorativas** bajo segmentos o listas que fingen significado sin serlo.
- **La tarjeta de "Upgrade to Premium" con degradado**: aquí no hay planes que vender, es un panel
  interno de un solo operador.
- **El asistente de IA con esfera decorativa**: fuera del alcance del producto.
- **El toggle de tema**: el dashboard es solo claro por decisión explícita; no se ofrece un control
  que no hace nada.

También se rechaza, por criterio general de la skill de diseño usada en el proyecto: franjas
laterales de color en tarjetas o alertas, texto con degradado, glassmorphism decorativo, modal como
primera respuesta a cualquier interacción, y cualquier copy con rayas em.

## Design Principles

1. **El dato manda, el chrome desaparece.** Ninguna decoración compite con una cifra, un estado o una
   acción. Si un elemento no ayuda a leer o actuar sobre el dato, no está.
2. **Ninguna acción irreversible sin confirmación explícita.** Cancelar una suscripción, reembolsar,
   archivar un producto, eliminar una edición publicada: siempre con un paso de confirmación
   nombrado, nunca un solo clic accidental.
3. **El estado siempre es honesto.** Carga, vacío, error y "sin datos todavía" son estados distintos
   y se ven distintos — nunca una tabla vacía se confunde con una tabla que sigue cargando.
4. **Densidad sin ruido.** El panel administra un negocio real con muchas piezas (variantes, cajas de
   suscripción, ediciones, envíos); la respuesta a esa complejidad es jerarquía tipográfica y
   espaciado deliberado, nunca menos información.
5. **Consistencia entre módulos por encima de la personalidad de cada pantalla.** Un botón primario,
   un estado de error, un patrón de tabla se ven y se comportan igual en Productos que en
   Suscripciones — el sistema de diseño es la garantía de eso, no la memoria de quien construye cada
   pantalla.

## Accessibility & Inclusion

Objetivo **WCAG 2.1 AA**: contraste mínimo 4.5:1 en texto normal y 3:1 en texto grande/bordes de
control, foco visible en todo elemento interactivo (nunca `outline: none` sin reemplazo), navegación
completa por teclado (tab order lógico, sin trampas de foco en modales/paneles), y objetivo táctil
mínimo de 44×44px en controles aunque el operador use escritorio (evita reflejo de densidad excesiva
en controles críticos). Sin requisitos de i18n ni soporte de lector de pantalla más allá de lo que
AA ya exige — un solo operador, español, escritorio.
