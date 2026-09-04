# Fase 3 — Torta interactiva, Reportes y buscador global (diseño)

Fecha: 2026-09-04
Estado: aprobado (diseño). Rama: `feat/fase-3-reportes-buscador`.
Roadmap: `docs/superpowers/specs/2026-09-04-roadmap-fases-2-5.md` (sección Fase 3).

## Contexto

Tres piezas independientes, todas de solo-lectura sobre datos existentes (sin
cambios de esquema):

- **A. Torta interactiva** — reemplazar la dona CSS (`conic-gradient`) del
  panel lateral por una dona SVG real, con tap/click en un sector para
  resaltarlo y ver su detalle.
- **B. Reportes** — reemplaza el placeholder actual: tendencia de los
  últimos períodos + comparativa contra el período anterior.
- **C. Buscador global** — nueva vista de navegación para buscar movimientos
  en todos los períodos (no solo el visible).

### Decisiones cerradas

| # | Decisión |
|---|----------|
| 1 | Reportes — tendencia: **barras agrupadas** ingreso/gasto (verde/rojo, mismos tokens `--ingreso`/`--gasto`) por cada uno de los últimos 6 períodos del `tipo` activo (semana/mes/año), terminando en el período visible. |
| 2 | Reportes — comparativa: **tarjetas con variación %** (una por Ingresos/Gastos/Balance), mismo estilo que `.tarjeta` existente, sumando valor del período anterior y una línea de variación con flecha ▲/▼. |
| 3 | Reportes reusa el período global del shell (`rango`, `tipo`, `fechaRef`, `modo`) — sin selector propio. La "comparativa" es siempre período actual vs. el inmediatamente anterior del mismo `tipo` (con `tipo=mes` da "mes vs mes anterior"; con `tipo=año`, "año vs año anterior"; con `tipo=semana`, semana vs semana anterior). |
| 4 | Buscador global: nueva entrada en el nav lateral ("Buscar"), vista propia con paginación "Cargar más". |
| 5 | Buscador global respeta el `modo` activo (Real/Estimado) — mismo criterio que el resto de la app. Filtros adicionales: tipo (ingreso/gasto) y categoría (acotada a las categorías del `modo` activo). |
| 6 | Buscador: clickear un resultado abre `abrirMovimientoForm` (editar) directamente — no navega a Movimientos. Evita tener que llevar el `fechaRef`/`tipo` del shell hasta el período del resultado. |
| 7 | Torta: click/tap en un sector **no navega** — solo resalta ese sector (atenúa los demás) y muestra su nombre/monto/% en el centro de la dona (reemplaza el texto "Total" mientras esté seleccionado). El drill-down a Movimientos sigue siendo el click en un ítem de la leyenda (comportamiento actual, sin cambios). |

### Fuera de alcance

Exportar/compartir reportes (ya excluido en el roadmap), gráfico de
tendencia con más de un `tipo` de período a la vez, edición en línea desde
el buscador (se abre el formulario existente, sin cambios ahí), acentos o
resaltado por búsqueda de texto en los resultados.

---

## Sección A — Dona SVG interactiva

### `src/ui/panelResumenView.js`

`tarjetaDona` se reescribe para generar un `<svg viewBox="0 0 100 100">` de
92×92 (mismo tamaño que hoy) en vez de `dona.style.background =
conic-gradient(...)`. Un `<circle>` por segmento (`r=40`, `stroke-width=20`,
`fill="none"`, `stroke-dasharray`/`stroke-dashoffset` según el porcentaje
acumulado, `transform="rotate(-90 50 50)"` para arrancar arriba igual que el
conic-gradient actual). `.dona-centro` se mantiene igual (overlay absoluto
encima del SVG con el texto).

- Cada `<circle>` de segmento es clickeable (`role="button"`,
  `tabindex="0"`, click y `Enter`/`Space`).
- Estado `segmentoActivo` (índice o `null`) en el closure de `tarjetaDona`:
  - Click en un segmento ya activo → deselecciona (`null`).
  - Click en otro segmento → lo selecciona.
  - Con selección: ese `<circle>` gana una clase `.dona-segmento--activo`
    (stroke-width mayor); los demás `.dona-segmento--atenuado` (opacity
    reducida). El contenido de `.dona-centro` cambia a nombre + monto + %
    de ese grupo (reemplaza "Total").
  - Sin selección: todos con stroke normal; centro muestra el total (como
    hoy).
- La leyenda (`dona-leyenda`) no cambia de comportamiento (click = drill-down
  vía `onCategoria`, como ahora); opcionalmente refleja visualmente cuál
  ítem está resaltado (mismo estado `segmentoActivo`) para que dona y
  leyenda queden sincronizadas.

### `app.css`

- `.dona-svg { width: 100%; height: 100%; }`.
- `.dona-segmento { cursor: pointer; transition: opacity .15s, stroke-width .15s; }`.
- `.dona-segmento--atenuado { opacity: .35; }`.
- `.dona-segmento--activo { stroke-width: 24; }` (ligeramente más grueso).

---

## Sección B — Vista Reportes

### `src/logic/periodos.js`

Nueva función exportada:

```js
// Etiqueta corta para ejes de gráfico (vs. etiquetaPeriodo, más larga).
export function etiquetaCorta(fecha, tipo) {
  if (tipo === "año") return `${fecha.getFullYear()}`;
  if (tipo === "mes") return MESES_ABBR[fecha.getMonth()];
  if (tipo === "semana") {
    const lunes = rangoPeriodo(fecha, "semana").desde;
    const d = new Date(`${lunes}T00:00:00`);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  throw new Error(`tipo de período inválido: ${tipo}`);
}
```

### `src/logic/reportes.js` (nuevo)

```js
import { periodoAnterior } from "./periodos.js";

// Fechas de referencia de los últimos `cantidad` períodos de `tipo`,
// terminando en fechaRef (incluido), en orden cronológico ascendente.
export function fechasTendencia(fechaRef, tipo, cantidad = 6) {
  const fechas = [fechaRef];
  let f = fechaRef;
  for (let i = 1; i < cantidad; i++) {
    f = periodoAnterior(f, tipo);
    fechas.unshift(f);
  }
  return fechas;
}

// Variación entre dos valores. anterior === 0: sin base para %, se marca con
// porcentaje null (la UI lo muestra como "—" en vez de un número).
export function calcularVariacion(actual, anterior) {
  const diferencia = actual - anterior;
  const porcentaje = anterior !== 0 ? (diferencia / Math.abs(anterior)) * 100 : null;
  return { diferencia, porcentaje };
}
```

### Tests

- `tests/periodos.test.js` — extender con `etiquetaCorta` (un caso por
  `tipo`).
- `tests/reportes.test.js` (nuevo):
  - `fechasTendencia`: cantidad de fechas devuelta, orden ascendente,
    último elemento === `fechaRef`, funciona para los 3 `tipo`.
  - `calcularVariacion`: caso normal (suba/baja), `anterior === 0` con
    `actual === 0` → diferencia 0 y porcentaje `null`, `anterior === 0` con
    `actual > 0` → porcentaje `null` (no `Infinity`).

### `src/ui/reportesView.js` (nuevo — reemplaza el placeholder)

`montarReportes(contenedor, { rango, tipo, fechaRef, modo })`:

1. **Comparativa** (arriba): `rangoAnterior = rangoPeriodo(periodoAnterior(fechaRef, tipo), tipo)`.
   `Promise.all` de `listarMovimientos` para el rango actual (ya se puede
   reusar `rango`) y el anterior, cada uno pasado por `filtrarParaCalculos`
   (con `incluirInactivos` de `prefs`) y `calcularTotales`. Tres tarjetas
   (Ingresos/Gastos/Balance) reusando el estilo `.tarjeta`, cada una con una
   línea `.tarjeta-delta` mostrando `calcularVariacion` — flecha ▲ (verde)
   o ▼ (roja); para "Gastos" el sentido de color se invierte (subir gasto es
   malo). Si `porcentaje === null`, mostrar "— vs. período anterior" en vez
   del signo/número.
2. **Tendencia** (abajo): `fechasTendencia(fechaRef, tipo, 6)` →
   `Promise.all` de `listarMovimientos` + `filtrarParaCalculos` +
   `calcularTotales` por cada fecha. Gráfico de barras SVG hecho a mano
   (mismo criterio "sin dependencias" que la dona): por cada período, dos
   barras (ingreso/gasto) con altura proporcional al máximo de la serie;
   eje X con `etiquetaCorta(fecha, tipo)`.
3. Estados de carga/error con el mismo patrón que el resto de las vistas
   (`error` con botón "Reintentar").

### `src/ui/shell.js`

Reemplazar el registro placeholder de `reportes` en `VISTAS` por
`montar: montarReportes` (import de `./reportesView.js`).

### `app.css`

- `.tarjeta-delta { font-size: var(--txt-xs); display: flex; align-items: center; gap: 4px; }`
  con modificadores `.tarjeta-delta--positivo` (`color: var(--ingreso)`) y
  `.tarjeta-delta--negativo` (`color: var(--gasto)`).
- `.tendencia-grafico`, `.tendencia-barra-grupo`, `.tendencia-barra` — barras
  SVG con `--ingreso`/`--gasto` como `fill`, y `.tendencia-eje` para las
  etiquetas debajo de cada grupo.

---

## Sección C — Buscador global

### `src/data/movimientos.js`

Exportar la constante `SELECT` (hoy privada) para reusarla en
`data/busqueda.js` sin duplicar la lista de columnas.

### `src/data/busqueda.js` (nuevo)

```js
import { supabase } from "../supabaseClient.js";
import { verificar } from "./_helpers.js";
import { SELECT } from "./movimientos.js";

// Trae `limite + 1` filas para saber si hay más sin una consulta de conteo
// aparte; el llamador descarta la fila extra si la usa como señal.
export async function buscarMovimientos({ modo, query, tipo, categoriaId, desde = 0, limite = 20 }) {
  let q = supabase
    .from("movimientos")
    .select(SELECT)
    .eq("modo", modo)
    .order("fecha", { ascending: false })
    .range(desde, desde + limite);
  if (query) q = q.ilike("nombre", `%${query}%`);
  if (tipo) q = q.eq("tipo", tipo);
  if (categoriaId) q = q.eq("categoria_id", categoriaId);
  return verificar(await q);
}
```

### `src/ui/buscadorView.js` (nuevo)

`montarBuscador(contenedor, { modo })`:

- Cabecera: input de texto (`placeholder="Buscar por nombre…"`, debounce
  250 ms, mínimo 2 caracteres — mismo criterio que el autocompletado de
  `movimientoForm.js`), `<select>` tipo (Todos/Ingreso/Gasto), `<select>`
  categoría (poblado con `listarCategorias()` filtradas a `c.modo === modo`).
  Cambiar cualquier filtro reinicia la paginación y vuelve a buscar.
- Estado vacío inicial (sin query ni filtros): mensaje "Escribí para
  buscar o usá los filtros.", sin pegarle a la base todavía.
- Resultados: lista de filas (mismo look que `.fila` de Movimientos —
  icono/nombre/categoría/fecha/monto, sin los botones de acción de esa
  vista) dentro de un contenedor propio; click en una fila →
  `abrirMovimientoForm({ modo, categorias, movimiento: m, onGuardado: recargar })`.
- Paginación: pide `limite=20` (+1 de señal); si vienen 21, muestra 20 y un
  botón **"Cargar más"** al pie que pide el siguiente bloque
  (`desde += 20`) y **agrega** filas a la lista existente (no reemplaza).
  Cambiar un filtro reinicia `desde` a 0 y limpia la lista antes de la
  nueva búsqueda.
- Errores: mismo patrón `error` + "Reintentar".

### `src/ui/shell.js`

Nueva entrada en `VISTAS`, después de "Categorías" y antes de "Reportes":

```js
{ clave: "buscar", titulo: "Buscar", icono: lupaIcono, montar: montarBuscador },
```

`montarBuscador` solo necesita `modo` de las props que ya arma
`pintarVista()`; no usa `rango`/`tipo`/`fechaRef` (se ignoran, igual que
`categorias.js` ignora `rango`).

### `app.css`

- Reusar `.fila` para las filas de resultado (agregando una variante sin
  `.acciones`, o simplemente omitiendo ese `div` — el CSS de `.fila` no
  depende de que existan los botones).
- `.buscador-vacio`, `.buscador-cargar-mas` (botón centrado, `margin-top`).

---

## Testing

- `tests/periodos.test.js` — extender con `etiquetaCorta`.
- `tests/reportes.test.js` (nuevo) — `fechasTendencia`, `calcularVariacion`.
- Sin tests de DOM ni de red (igual que fases anteriores). Verificación
  manual:
  1. Dona: click en un sector resalta y cambia el centro; click de nuevo
     deselecciona; la leyenda sigue haciendo drill-down.
  2. Reportes: comparativa muestra variación correcta contra el período
     anterior (incluyendo el caso "período anterior en cero" → "—"); la
     tendencia muestra 6 barras dobles con las etiquetas de eje correctas
     para semana/mes/año.
  3. Buscador: aparece "Buscar" en el nav; buscar por nombre con y sin
     filtros; "Cargar más" trae la página siguiente sin duplicar ni perder
     filas; click en un resultado abre el formulario de edición y guardar
     refresca la lista.

## Orden de implementación sugerido

1. `logic/periodos.js` (`etiquetaCorta`) + `logic/reportes.js`
   (`fechasTendencia`, `calcularVariacion`) + tests.
2. `ui/panelResumenView.js` — dona SVG interactiva + `app.css`.
3. `ui/reportesView.js` + registrar en `shell.js` + `app.css`.
4. `data/movimientos.js` (exportar `SELECT`) + `data/busqueda.js`.
5. `ui/buscadorView.js` + registrar en `shell.js` + `app.css`.
6. Verificación manual y ajustes.
