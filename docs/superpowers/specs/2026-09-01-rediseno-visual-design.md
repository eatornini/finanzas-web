# Rediseño visual — diseño

Fecha: 2026-09-01
Estado: aprobado, pendiente de plan de implementación

## Objetivo

Elevar el diseño visual de la app de finanzas personales, hoy muy básico, y
darle un layout aprovechable en escritorio. El resultado es la base visual
(tokens + componentes + shell) sobre la que se montarán después presupuestos,
gráficos y movimientos recurrentes.

Alcance elegido: **reskin + ajustes de layout**. Se reescribe `app.css` completo
y se tocan los archivos de `src/ui/` solo para envoltorios de layout y nombres
de clase. No se replantean las vistas desde cero ni se reemplazan
`prompt()`/`confirm()` (eso sería un rediseño "a fondo", fuera de alcance).

## Decisiones tomadas

| Tema | Decisión |
|------|----------|
| Profundidad | Reskin de CSS + ajustes de estructura en `src/ui/` |
| Estética | Limpia y neutra (tipo Notion/Linear): mucho blanco/gris, bordes sutiles, tipografía del sistema, un solo color de acento |
| Dark mode | Sí, automático vía `prefers-color-scheme`. Sin botón de toggle |
| Layout escritorio | Sidebar de navegación fija a la izquierda; contenido a ancho cómodo |
| Iconos | SVG inline mínimos pegados al repo, sin dependencias ni CDN |

## Enfoque técnico (sin build)

Un único `app.css` reescrito (~300–380 líneas) usando **CSS nesting nativo +
`@layer`** en este orden:

```
@layer tokens, base, layout, componentes, utilidades;
```

Motivo: GitHub Pages sirve un solo archivo, sin cascada de `@import` ni CDN, sin
FOUC ni waterfalls de red. Para ~350 líneas de CSS, un archivo con capas es más
simple de mantener que varios `<link>`.

Alternativa descartada: partir en `tokens.css` / `layout.css` / `components.css`
con varios `<link>` en `index.html`. Encaja mejor con "muchos archivos chicos"
pero agrega round-trips de red y riesgo de FOUC sin beneficio real a este tamaño.
Si en el futuro el CSS supera ~600 líneas, se reconsidera.

## Sistema de tokens

Reemplaza las 9 variables sueltas actuales de `:root` por una escala coherente,
con un bloque `@media (prefers-color-scheme: dark)` que redefine solo los tokens
de color.

### Color

| Token | Rol |
|-------|-----|
| `--bg` | Fondo de página |
| `--bg-elevado` | Fondo de sidebar y tarjetas |
| `--fg` | Texto principal |
| `--fg-tenue` | Texto secundario (labels, metadatos) |
| `--borde` | Líneas y bordes de tarjeta/campo |
| `--acento` | Único color de acento (azul). Botón primario, estado activo |
| `--ingreso` | Verde de ingreso |
| `--gasto` | Rojo de gasto |
| `--estimado` | Violeta de modo estimado |
| `--pendiente` | Ámbar de pendiente |

Los cuatro semánticos (`--ingreso`, `--gasto`, `--estimado`, `--pendiente`) se
ajustan para contraste AA de texto sobre `--bg` y `--bg-elevado` en **ambos
temas** (claro y oscuro).

### Escalas

- **Espaciado:** `--esp-1` 4px, `--esp-2` 8px, `--esp-3` 12px, `--esp-4` 16px,
  `--esp-5` 24px, `--esp-6` 32px.
- **Radios:** `--r-sm` 6px, `--r-md` 10px, `--r-lg` 14px.
- **Tipografía:** stack de sistema (ya presente). Escala `--txt-sm` 0.875rem,
  `--txt-base` 1rem, `--txt-lg` 1.25rem, `--txt-xl` 1.75rem. Regla utilitaria
  para montos con `font-variant-numeric: tabular-nums`.
- **Sombra:** una sola `--sombra-1` sutil para elementos elevados (sidebar,
  tarjetas de resumen).

## Shell nuevo (`src/ui/shell.js` + CSS)

Estructura a CSS grid:

```
.app                      grid-template-columns: 240px 1fr  (escritorio)
├── aside.sidebar         marca "Finanzas" · nav (3 vistas) · botón Salir (abajo)
└── .principal
    ├── header.topbar     selector de período (‹ etiqueta ›) + selector real/estimado
    └── main.cuerpo       vista activa, max-width ~960px
```

- **Escritorio (≥720px):** sidebar fija a la izquierda (240px), contenido a la
  derecha.
- **Móvil (<720px):** `.app` pasa a una sola columna. La `.sidebar` se convierte
  en barra inferior fija (`position: fixed; bottom: 0`) con la nav en horizontal
  y el botón Salir; la marca "Finanzas" pasa a la `.topbar`. La `.topbar` apila
  sus selectores debajo de la marca.

### Restricción de implementación

Los elementos `<button>` de período, modo y navegación, junto con sus
`onClick`, **son los mismos objetos JS que hoy**. `shell.js` solo cambia los
contenedores (`el("aside", ...)`, `el("header", ...)`) donde se insertan esos
botones ya construidos. Esto mantiene intacto el cableado de estado
(`fechaRef`, `tipo`, `activa`, `modo`, `pintarVista`, `sincronizar*`).

## Componentes CSS

### `.tarjeta`

Fondo `--bg-elevado`, borde `--borde`, radio `--r-lg`, sombra `--sombra-1`,
padding `--esp-4`. Base de las tarjetas del resumen.

### `.lista` / `.fila`

La fila pasa de "botones amontonados con `flex-wrap`" a **grid de columnas
alineadas**, respetando el orden de spans que ya generan los views
(`nombre`, `cat`, `fecha`, `monto`, y luego los botones de acción):

```
grid-template-columns: 1fr auto auto auto auto;   (nombre | categoría | fecha | monto | acciones)
```

En Movimientos el toggle pagado/pendiente del modo estimado se agrega dentro de
la celda de acciones junto a editar y borrar.

- Nombre: `--fg`, peso 600.
- Categoría y fecha: `--fg-tenue`, `--txt-sm`.
- Monto: alineado a la derecha, `tabular-nums`; color `--ingreso` / `--gasto`
  según `tipo-*` (clases ya presentes).
- `.fila-pagada`: opacidad reducida (ya presente).
- Acciones: botones-icono.

En móvil la fila colapsa: nombre + monto en la primera línea, metadatos y
acciones debajo.

### `.campo`

Inputs y selects: padding `--esp-2`/`--esp-3`, borde `--borde`, radio `--r-sm`,
fondo `--bg`. Estado `:focus-visible` con outline de `--acento`.

### `.boton` y variantes

| Variante | Uso |
|----------|-----|
| `.boton` (default) | Neutro, fondo `--bg-elevado`, borde `--borde` |
| `.boton--primario` | Fondo `--acento`, texto blanco. Submit de formularios |
| `.boton.activo` | Estado activo de período/nav (fondo `--acento`) |
| `.boton--icono` | 36×36, solo SVG, sin borde salvo `:hover` |
| `.pagado` / `.pendiente` | Ya presentes; se re-tematizan con los tokens |

El selector de modo mantiene la regla actual: botón "Estimado" activo usa
`--estimado`, botón "Real" activo usa `--acento`.

### `.form-grid`

El formulario de alta de movimiento pasa de fila con `flex-wrap` a grilla de
2–3 columnas que colapsa a 1 en móvil. El de categorías, misma idea con menos
campos.

## Cambios por vista

### Resumen (`src/ui/resumenView.js`)

- Modo real: 3 tarjetas (`Ingresos`, `Gastos`, `Balance`) en fila en escritorio,
  apiladas en móvil.
- Modo estimado: los 3 grupos (`Estimado`, `Pagado`, `Pendiente`) como **3
  columnas** en escritorio, apilados en móvil. Cada grupo conserva sus 3
  tarjetas internas.
- Balance con color según signo (ya presente).
- Cambios de JS: solo clases y, si hace falta, un `<div>` envoltorio para la
  grilla de grupos. La estructura de `grupo()` y `tarjeta()` no cambia.

### Movimientos (`src/ui/movimientosView.js`)

- Formulario de alta con clase `form-grid`.
- Lista con `.fila` en grid de columnas alineadas.
- `Editar monto`, `Borrar` y el toggle pagado/pendiente pasan a
  `.boton--icono` con `aria-label` descriptivo (el texto visible se reemplaza
  por SVG; el `aria-label` conserva la acción).
- Se sigue usando `prompt()` / `confirm()` para editar y borrar. Fuera de
  alcance reemplazarlos.

### Categorías (`src/ui/categoriasView.js`)

- Misma `.fila` en grid.
- El `.punto` de color pasa a "chip": más grande, con el nombre del tipo al
  lado.
- `Renombrar` / `Borrar` como `.boton--icono` con `aria-label`.

### Login (`src/ui/loginView.js`)

- Tarjeta centrada (`.tarjeta`), misma estructura de campos, más espaciado y
  jerarquía tipográfica en el `<h1>`.

## Iconos (`src/ui/iconos.js`)

Nuevo módulo que exporta funciones que devuelven un nodo `<svg>` inline
(24×24, `stroke="currentColor"`, sin `fill`):

`flechaIzq`, `flechaDer`, `salir`, `mas`, `lapiz`, `basura`, `check`.

Origen: ~7 iconos de [Lucide](https://lucide.dev) (licencia ISC), copiados a
mano como paths. Cero dependencias, cero CDN. Se usan desde los views pasando
el nodo SVG como hijo del botón, junto con `aria-label` en el botón.

## Fuera de alcance

- `src/logic/`, `src/data/`, `src/auth.js`, `src/supabaseClient.js`.
- `supabase/` — sin migraciones ni cambios de esquema.
- Los tests existentes (`tests/periodos.test.js`, `tests/totales.test.js`).
- La semántica HTML: se conservan `header`, `nav`, `main`, `form`, `<label>`
  implícitos vía `placeholder`/`aria-label`.
- Reemplazar `prompt()` / `confirm()` por diálogos propios.
- Estados de carga con skeletons (los mensajes de error/reintento actuales se
  mantienen tal cual, solo re-tematizados).
- Botón de toggle claro/oscuro.
- Tests de UI.

## Verificación

No hay tests de UI y este trabajo no los agrega. Los tests de `logic/` siguen
pasando sin cambios (`npm test`).

Verificación visual manual con `npx serve .`:

- 3 vistas (Movimientos, Resumen, Categorías) × 2 modos (real, estimado)
- Tema claro y oscuro (alternando `prefers-color-scheme` del navegador)
- Ancho móvil (~375px) y escritorio (~1280px)
- Flujos que no deben romperse: cambiar período (‹ ›, semana/mes/año),
  alternar real/estimado, navegar entre vistas, alta de movimiento, alta de
  categoría, cerrar sesión.

Tras el push a `main`, una pasada rápida en la URL de GitHub Pages.

Opcional: capturas antes/después con navegador, adjuntas a este spec.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| El reordenamiento del shell rompe el cableado de período/modo/nav | Reusar los mismos nodos de botón y handlers; `shell.js` solo cambia contenedores |
| Contraste insuficiente de los colores semánticos en dark mode | Verificar cada par color/fondo contra AA al definir los tokens |
| Regresión visual en móvil por el cambio de sidebar a barra inferior | Checklist de verificación cubre ancho móvil explícitamente |
| `el()` no soporta pasar nodos SVG como hijos | Ya los soporta: `child.nodeType` se evalúa y se hace `append` directo |

## Archivos afectados

- `app.css` — reescritura completa
- `index.html` — sin cambios (o ajuste menor de `<meta name="color-scheme">`)
- `src/ui/shell.js` — nuevos contenedores de layout
- `src/ui/resumenView.js` — clases + envoltorio de grilla
- `src/ui/movimientosView.js` — clases + botones-icono
- `src/ui/categoriasView.js` — clases + botones-icono
- `src/ui/loginView.js` — clase `.tarjeta`
- `src/ui/iconos.js` — nuevo módulo de SVG
- `docs/superpowers/specs/2026-09-01-rediseno-visual-design.md` — este documento
