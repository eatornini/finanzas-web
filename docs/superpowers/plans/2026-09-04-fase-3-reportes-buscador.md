# Fase 3 — Torta interactiva, Reportes y buscador global — Implementation Plan

**Goal:** Dona interactiva en el panel lateral, vista Reportes real
(tendencia + comparativa entre períodos) y buscador global de movimientos.

**Spec:** `docs/superpowers/specs/2026-09-04-fase-3-reportes-buscador-design.md`

## Global Constraints

Mismas de fases anteriores: sin build step, sin dependencias nuevas de
runtime (nada de librerías de gráficos — SVG a mano, como la dona actual),
español en UI/comentarios/commits, CLP entero, 2 espacios / comillas dobles
/ punto y coma, commits `<tipo>: <descripción>` terminando con
`Claude-Session: https://claude.ai/code/session_013jenY5tuqjSMRY5MJ5BhJc`.

## File Structure

**Nuevos:**
- `src/logic/reportes.js`
- `tests/reportes.test.js`
- `src/ui/reportesView.js`
- `src/data/busqueda.js`
- `src/ui/buscadorView.js`

**Modificados:**
- `src/logic/periodos.js` — `etiquetaCorta`.
- `tests/periodos.test.js` — casos de `etiquetaCorta`.
- `src/ui/panelResumenView.js` — dona SVG interactiva.
- `src/data/movimientos.js` — exportar `SELECT`.
- `src/ui/shell.js` — registrar Reportes real y nueva vista Buscar.
- `app.css` — estilos de dona SVG, tarjetas de variación, gráfico de
  tendencia, buscador.

---

## Task 1: `logic/periodos.js` — `etiquetaCorta` + `logic/reportes.js`

**Files:**
- Modify: `src/logic/periodos.js`
- Test: `tests/periodos.test.js`
- Create: `src/logic/reportes.js`
- Create: `tests/reportes.test.js`

- [ ] **Step 1: Tests que fallan**

Añadir a `tests/periodos.test.js`:

```js
import { etiquetaCorta } from "../src/logic/periodos.js";

describe("etiquetaCorta", () => {
  it("mes: abreviatura de 3 letras", () => {
    expect(etiquetaCorta(new Date(2026, 8, 4), "mes")).toBe("sep");
  });
  it("año: el año como texto", () => {
    expect(etiquetaCorta(new Date(2026, 8, 4), "año")).toBe("2026");
  });
  it("semana: dd/mm del lunes de esa semana", () => {
    // 2026-09-04 es viernes; el lunes de esa semana es 2026-08-31.
    expect(etiquetaCorta(new Date(2026, 8, 4), "semana")).toBe("31/08");
  });
});
```

Create `tests/reportes.test.js`:

```js
import { describe, it, expect } from "vitest";
import { fechasTendencia, calcularVariacion } from "../src/logic/reportes.js";

describe("fechasTendencia", () => {
  it("devuelve `cantidad` fechas terminando en fechaRef", () => {
    const ref = new Date(2026, 8, 1);
    const fechas = fechasTendencia(ref, "mes", 6);
    expect(fechas).toHaveLength(6);
    expect(fechas[5].getMonth()).toBe(8);
    expect(fechas[5].getFullYear()).toBe(2026);
  });

  it("orden cronológico ascendente, un mes de diferencia entre cada una", () => {
    const ref = new Date(2026, 8, 1);
    const fechas = fechasTendencia(ref, "mes", 3);
    expect(fechas[0].getMonth()).toBe(6); // julio
    expect(fechas[1].getMonth()).toBe(7); // agosto
    expect(fechas[2].getMonth()).toBe(8); // septiembre
  });

  it("funciona con tipo año", () => {
    const ref = new Date(2026, 0, 1);
    const fechas = fechasTendencia(ref, "año", 3);
    expect(fechas.map((f) => f.getFullYear())).toEqual([2024, 2025, 2026]);
  });
});

describe("calcularVariacion", () => {
  it("caso normal: sube", () => {
    expect(calcularVariacion(150, 100)).toEqual({ diferencia: 50, porcentaje: 50 });
  });

  it("caso normal: baja", () => {
    expect(calcularVariacion(80, 100)).toEqual({ diferencia: -20, porcentaje: -20 });
  });

  it("anterior en cero y actual en cero: diferencia 0, porcentaje null", () => {
    expect(calcularVariacion(0, 0)).toEqual({ diferencia: 0, porcentaje: null });
  });

  it("anterior en cero y actual positivo: porcentaje null (no Infinity)", () => {
    const r = calcularVariacion(50, 0);
    expect(r.diferencia).toBe(50);
    expect(r.porcentaje).toBeNull();
  });
});
```

Run: `npm test -- periodos reportes` → FAIL (`etiquetaCorta` no existe,
módulo `reportes.js` no existe).

- [ ] **Step 2: Implementación**

En `src/logic/periodos.js`, añadir (usa el `MESES_ABBR` ya definido arriba
en el archivo):

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

Create `src/logic/reportes.js`:

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

// Variación entre dos valores. anterior === 0: sin base para %, porcentaje
// null (la UI lo muestra como "—" en vez de un número o de Infinity).
export function calcularVariacion(actual, anterior) {
  const diferencia = actual - anterior;
  const porcentaje = anterior !== 0 ? (diferencia / Math.abs(anterior)) * 100 : null;
  return { diferencia, porcentaje };
}
```

- [ ] **Step 3: Tests pasan**

Run: `npm test` → PASS (todos).

- [ ] **Step 4: Commit**

```bash
git add src/logic/periodos.js src/logic/reportes.js tests/periodos.test.js tests/reportes.test.js
git commit -m "feat: etiquetaCorta y lógica de tendencia/variación para Reportes"
```

---

## Task 2: Dona SVG interactiva

**Files:**
- Modify: `src/ui/panelResumenView.js`
- Modify: `app.css`

- [ ] **Step 1: Reescribir `tarjetaDona`**

En `src/ui/panelResumenView.js`, reemplazar la construcción de `dona`
(hoy `dona.style.background = conic-gradient(...)`) por un `<svg
viewBox="0 0 100 100" class="dona-svg">` con un `<circle>` por grupo
(`cx="50" cy="50" r="40" fill="none" stroke-width="20"`,
`transform="rotate(-90 50 50)"`, `stroke-dasharray`/`stroke-dashoffset`
calculados a partir de la circunferencia `2 * Math.PI * 40` y el porcentaje
acumulado de cada grupo — mismo cálculo de `desde`/`hasta` que ya existe,
en fracción de la circunferencia en vez de grados).

Cada `<circle>` (clase `dona-segmento`) es interactivo: `tabindex="0"`,
`role="button"`, `aria-label` con nombre+monto+%, `onClick`/`onKeydown`
(Enter/Espacio) que alternan un estado `segmentoActivo` (variable de
closure, índice o `null`) declarado dentro de `tarjetaDona`. Al cambiar,
repintar: el `<circle>` activo suma `.dona-segmento--activo`, el resto
`.dona-segmento--atenuado`; `.dona-centro` muestra nombre/monto/% del grupo
activo, o el total si `segmentoActivo === null`. Estructurar con una función
interna `pintar()` que reconstruye el SVG y el centro según el estado, para
no duplicar lógica entre el render inicial y cada toggle.

La leyenda (`dona-leyenda`) sigue llamando a `onCategoria` en su `onClick`
(sin cambios funcionales); opcionalmente marca con una clase el ítem cuyo
índice coincide con `segmentoActivo`.

- [ ] **Step 2: Estilos**

Añadir a `app.css`:

```css
.dona-svg {
  width: 100%;
  height: 100%;
}
.dona-segmento {
  cursor: pointer;
  transition: opacity 0.15s, stroke-width 0.15s;
}
.dona-segmento--atenuado {
  opacity: 0.35;
}
.dona-segmento--activo {
  stroke-width: 24;
}
```

- [ ] **Step 3: Verificación manual**

Con `npx serve .`: en Movimientos, con gastos categorizados, click en un
sector de la dona resalta ese sector y cambia el centro; click de nuevo (o
en el mismo sector) vuelve a "Total"; la leyenda sigue llevando a
Movimientos filtrado por esa categoría.

- [ ] **Step 4: Commit**

```bash
git add src/ui/panelResumenView.js app.css
git commit -m "feat(ui): dona SVG interactiva — resaltar sector y ver detalle"
```

---

## Task 3: Vista Reportes

**Files:**
- Create: `src/ui/reportesView.js`
- Modify: `src/ui/shell.js`
- Modify: `app.css`

**Interfaces:**
- `montarReportes(contenedor, { rango, tipo, fechaRef, modo })`.

- [ ] **Step 1: Implementación de la vista**

Create `src/ui/reportesView.js`:

- Importar `listarMovimientos` (`data/movimientos.js`),
  `filtrarParaCalculos`, `calcularTotales` (`logic/totales.js`),
  `formatoCLP` (`logic/dinero.js`), `prefs`, `periodoAnterior`,
  `rangoPeriodo`, `etiquetaCorta`, `etiquetaPeriodo` (`logic/periodos.js`),
  `fechasTendencia`, `calcularVariacion` (`logic/reportes.js`).
- `montarReportes`: `error` + contenedor `comparativa` + contenedor
  `tendencia`, patrón try/catch + "Reintentar" igual que `resumenView.js`.
- **Comparativa**: `fechaAnterior = periodoAnterior(fechaRef, tipo)`,
  `rangoAnterior = rangoPeriodo(fechaAnterior, tipo)`. `Promise.all([
  listarMovimientos({ ...rango, modo }), listarMovimientos({ ...rangoAnterior, modo }) ])`.
  Cada lista por `filtrarParaCalculos` + `calcularTotales`. Tres tarjetas
  (`.tarjeta.ingreso/.gasto/...`) reusando la función `tarjeta`-like de
  `resumenView.js` (duplicar la función local, no importarla — son vistas
  independientes) más una línea `.tarjeta-delta` con
  `calcularVariacion(actual, anterior)`: si `porcentaje === null`, texto
  "— vs. período anterior"; si no, `▲`/`▼` + `${Math.abs(Math.round(porcentaje))}%
  vs. período anterior`, con `.tarjeta-delta--positivo`/`--negativo` (para
  Gastos, invertir: subida = negativo).
- **Tendencia**: `fechas = fechasTendencia(fechaRef, tipo, 6)`.
  `Promise.all(fechas.map((f) => listarMovimientos({ ...rangoPeriodo(f, tipo), modo })))`,
  cada resultado por `filtrarParaCalculos` + `calcularTotales` →
  `{ etiqueta: etiquetaCorta(f, tipo), ingresos, gastos }`. SVG de barras
  agrupadas a mano: alto proporcional al máximo de `ingresos`/`gastos` de
  toda la serie (evitar división por cero con máximo `1`), dos `<rect>`
  por período (ingreso/gasto, `fill: var(--ingreso)`/`var(--gasto)` — usar
  los valores calculados en JS, no `var()` dentro de SVG generado con
  `el()`, o poner las clases CSS `.tendencia-barra--ingreso`/`--gasto` y
  dejar el color en `app.css`), `<text>` con `etiqueta` debajo de cada
  grupo.
- Título de la sección de comparativa: `` `${etiquetaPeriodo(fechaRef, tipo)} vs. ${etiquetaPeriodo(fechaAnterior, tipo)}` ``.

- [ ] **Step 2: Registrar en `shell.js`**

En `src/ui/shell.js`: importar `montarReportes` de `./reportesView.js` y
reemplazar la entrada `reportes` de `VISTAS` (que hoy usa
`montarPlaceholder`) por `montar: montarReportes`. Sacar el import de
`montarPlaceholder` si queda sin otros usos (revisar `configuracion`, que
sigue siendo placeholder — no tocar esa entrada).

- [ ] **Step 3: Estilos**

Añadir a `app.css`: `.comparativa-tarjetas` (grid como `.tarjetas-fila`),
`.tarjeta-delta` + modificadores `--positivo`/`--negativo`,
`.tendencia-grafico` (contenedor del SVG), `.tendencia-barra-grupo`,
`.tendencia-barra--ingreso { fill: var(--ingreso); }`,
`.tendencia-barra--gasto { fill: var(--gasto); }`, `.tendencia-eje-etiqueta`
(`font-size` chica, `fill: var(--fg-tenue)`, `text-anchor: middle`).

- [ ] **Step 4: Verificación manual**

Con `npx serve .`: entrar a Reportes en modo real y estimado, con `tipo`
mes/semana/año; confirmar que la comparativa tiene sentido contra el
período anterior (incluyendo un período con cero movimientos, para ver el
caso "—"), y que la tendencia muestra 6 barras dobles con las etiquetas de
eje correctas.

- [ ] **Step 5: Commit**

```bash
git add src/ui/reportesView.js src/ui/shell.js app.css
git commit -m "feat(ui): vista Reportes — comparativa entre períodos y tendencia"
```

---

## Task 4: Capa de datos del buscador

**Files:**
- Modify: `src/data/movimientos.js`
- Create: `src/data/busqueda.js`

- [ ] **Step 1: Exportar `SELECT`**

En `src/data/movimientos.js`, cambiar `const SELECT = ...` por
`export const SELECT = ...` (sin otros cambios).

- [ ] **Step 2: `data/busqueda.js`**

Create `src/data/busqueda.js`:

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

- [ ] **Step 3: Verificación manual**

Con `npx serve .` logueado, desde la consola:
`import("/src/data/busqueda.js").then(m => m.buscarMovimientos({modo:"real", query:"a"})).then(console.log)`
→ array, sin error.

- [ ] **Step 4: Commit**

```bash
git add src/data/movimientos.js src/data/busqueda.js
git commit -m "feat(data): buscarMovimientos — búsqueda global paginada"
```

---

## Task 5: Vista Buscador

**Files:**
- Create: `src/ui/buscadorView.js`
- Modify: `src/ui/shell.js`
- Modify: `app.css`

**Interfaces:**
- `montarBuscador(contenedor, { modo })`.

- [ ] **Step 1: Implementación**

Create `src/ui/buscadorView.js`:

- Importar `buscarMovimientos` (`data/busqueda.js`), `listarCategorias`
  (`data/categorias.js`), `abrirMovimientoForm` (`ui/movimientoForm.js`),
  `nodoIconoCategoria` (`ui/iconoCategoria.js`), `colorMovimiento`
  (`ui/iconosCategoria.js`), `formatoCLP` (`logic/dinero.js`).
- Cabecera: input de texto (debounce 250 ms, mínimo 2 caracteres — igual
  criterio que `movimientoForm.js`), `<select>` tipo, `<select>` categoría
  (poblado con `listarCategorias()` filtradas a `c.modo === modo`). Cambiar
  cualquier filtro reinicia `desde = 0`, limpia resultados y vuelve a
  buscar (si hay query o algún filtro activo).
- Sin query ni filtros: mensaje "Escribí para buscar o usá los filtros.",
  no pega a la base.
- Resultados: reusar el look de `.fila` (icono vía `nodoIconoCategoria` +
  color vía `colorMovimiento`, nombre, categoría, fecha, monto con signo),
  sin el `div.acciones` de Movimientos. Click en la fila →
  `abrirMovimientoForm({ modo, categorias, movimiento: m, onGuardado: recargar })`
  (recarga la búsqueda actual tras guardar).
- Paginación: pedir `limite=20`; si vienen 21 resultados, mostrar los
  primeros 20 y un botón "Cargar más" que pide `desde={acumulado}` y
  **agrega** filas (no reemplaza); si vienen ≤20, no hay más.
- Manejo de error con el patrón `error` + "Reintentar" ya usado en el
  resto de las vistas.

- [ ] **Step 2: Registrar en `shell.js`**

En `src/ui/shell.js`: importar `lupaIcono` (ya existe en `iconos.js`, se
usa en Movimientos) y `montarBuscador`; agregar a `VISTAS`, después de
`categorias` y antes de `reportes`:

```js
{ clave: "buscar", titulo: "Buscar", icono: lupaIcono, montar: montarBuscador },
```

- [ ] **Step 3: Estilos**

Añadir a `app.css`: `.buscador-cabecera` (input + selects en fila,
responsive como `.panel-filtros`/`.lista-acciones` existentes),
`.buscador-vacio` (mismo criterio visual que `.vacio`), `.buscador-cargar-mas`
(botón centrado con margen superior).

- [ ] **Step 4: Verificación manual**

Con `npx serve .`: aparece "Buscar" en el nav; buscar por nombre con y sin
filtros de tipo/categoría; con más de 20 resultados, "Cargar más" trae la
página siguiente sin duplicar ni perder filas; click en un resultado abre
el formulario de edición y, al guardar, la lista se actualiza.

- [ ] **Step 5: Commit**

```bash
git add src/ui/buscadorView.js src/ui/shell.js app.css
git commit -m "feat(ui): buscador global de movimientos"
```

---

## Task 6: Cierre de rama

- [ ] Actualizar el checklist de gap en
  `docs/superpowers/specs/2026-09-04-roadmap-fases-2-5.md` (marcar
  "Torta interactiva", "Reportes / comparativas" y "Buscador global" como
  Fase 3 ✔).
- [ ] Merge de `feat/fase-3-reportes-buscador` a `main` (merge commit, sin
  squash) y push.
