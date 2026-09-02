# Rediseño visual — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el CSS básico actual por un sistema de tokens + componentes con estética limpia y neutra, layout de escritorio con sidebar, y dark mode automático, sin tocar lógica ni datos.

**Architecture:** Un único `app.css` reescrito con `@layer tokens, base, layout, componentes, utilidades` y CSS nesting nativo (sin build, sin dependencias). Los archivos de `src/ui/` se modifican solo para envoltorios de layout, nombres de clase y botones-icono. La lógica de eventos, el helper `el()` y el DOM semántico quedan intactos. Un módulo nuevo `src/ui/iconos.js` provee ~7 SVG inline.

**Tech Stack:** JavaScript ES modules puro, CSS moderno (`@layer`, nesting nativo, `color-mix()`, `prefers-color-scheme`), Vitest (solo para `src/logic/`), GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-01-rediseno-visual-design.md`

## Global Constraints

- **Sin build ni dependencias nuevas.** Nada de Tailwind, PostCSS, ni CDN. CSS plano en `app.css`, JS en ES modules servidos tal cual.
- **Sin tests de UI.** Convención del proyecto (CLAUDE.md: "los tests cubren solo logic/"). Cada tarea se verifica a mano con checklist. Tras cualquier cambio en `src/`, `npm test` debe seguir en verde (regresión de lógica).
- **No tocar:** `src/logic/`, `src/data/`, `src/auth.js`, `src/supabaseClient.js`, `src/main.js`, `supabase/`, `tests/`.
- **Conservar semántica HTML:** `header`, `nav`, `main`, `form`, y los `<button>`/handlers existentes (reusar los mismos nodos, solo cambiar contenedores).
- **`prompt()` / `confirm()` se mantienen** para editar/borrar. No entran diálogos propios.
- **Dark mode automático** vía `@media (prefers-color-scheme: dark)`. Sin botón de toggle.
- **Trabajar en una rama**, no en `main`. Sugerencia: `rediseno-visual`.
- **Commits frecuentes**, formato `<type>: <descripción>` (feat/refactor/style/docs).

## Checklist de verificación manual base

Cada tarea que cambie apariencia se prueba sirviendo el sitio (`npx serve .` o `python -m http.server`) y recorriendo:

- **Vistas:** Movimientos, Resumen, Categorías.
- **Modos:** Real y Estimado (botón del selector de modo).
- **Tema:** claro y oscuro (alternando el tema del SO o el emulador de `prefers-color-scheme` en DevTools).
- **Anchos:** móvil ~375px y escritorio ~1280px (DevTools responsive).
- **Flujos que NO deben romperse:** cambiar tipo de período (Semana/Mes/Año), navegar período (‹ ›), alternar Real/Estimado, cambiar de vista, alta de movimiento, editar monto, borrar movimiento, toggle pagado/pendiente, alta de categoría, renombrar y borrar categoría, cerrar sesión y volver a entrar.
- **Consola del navegador sin errores nuevos.**

Cada tarea añade abajo lo específico que hay que mirar.

## File Structure

| Archivo | Responsabilidad | Estado |
|---------|-----------------|--------|
| `app.css` | Todo el estilo: tokens, base, layout (shell/sidebar), componentes, utilidades | Reescritura completa (Tarea 1), ediciones por capa (Tareas 3–7) |
| `index.html` | Añadir `<meta name="color-scheme">` | Cambio mínimo (Tarea 1) |
| `src/ui/iconos.js` | Fábrica de nodos `<svg>` inline (7 iconos) | Nuevo (Tarea 2) |
| `src/ui/shell.js` | Ensamblado del layout: `.app` > `.sidebar` + `.principal` > `.topbar` + `.cuerpo` | Modificar ensamblado y ‹ ›/salir (Tarea 3) |
| `src/ui/resumenView.js` | Envoltorios de grilla para grupos y tarjetas | Modificar (Tarea 4) |
| `src/ui/movimientosView.js` | Clase de form-grid, wrapper `.acciones`, botones-icono | Modificar (Tarea 5) |
| `src/ui/categoriasView.js` | `.fila--categoria`, wrapper `.acciones`, botones-icono, chip de color | Modificar (Tarea 6) |
| `src/ui/loginView.js` | Sin cambios de JS; el estilo de tarjeta se hace por CSS | — |
| `src/ui/dom.js` | El helper `el()` ya soporta nodos SVG como hijos (`child.nodeType`) | Sin cambios |

---

## Task 1: Tokens, base y re-tematizado de la estructura actual

Reescribe `app.css` con el esqueleto de capas, el sistema de tokens (claro + oscuro) y re-estiliza **las clases que ya emite el JS hoy** (sin cambiar todavía el layout ni el DOM). Al terminar, la app se ve renovada y con dark mode, pero mantiene la barra superior y la columna centrada.

**Files:**
- Modify: `app.css` (reescritura completa)
- Modify: `index.html:6` (añadir meta)

**Interfaces:**
- Consumes: nada.
- Produces: tokens CSS usados por todas las tareas siguientes —
  Color: `--bg`, `--bg-elevado`, `--bg-sutil`, `--fg`, `--fg-tenue`, `--borde`, `--acento`, `--acento-fg`, `--ingreso`, `--gasto`, `--estimado`, `--pendiente`.
  Escalas: `--esp-1..6`, `--r-sm|md|lg`, `--txt-sm|base|lg|xl`, `--sombra-1`, `--ancho-cuerpo`, `--ancho-sidebar`.
  Orden de capas: `@layer tokens, base, layout, componentes, utilidades;`

- [ ] **Step 1: Crear la rama**

```bash
git checkout -b rediseno-visual
```

- [ ] **Step 2: Añadir el meta color-scheme en `index.html`**

En `<head>`, justo después de la línea del `viewport`:

```html
    <meta name="color-scheme" content="light dark" />
```

- [ ] **Step 3: Reescribir `app.css` completo**

Reemplazá TODO el contenido de `app.css` por esto:

```css
@layer tokens, base, layout, componentes, utilidades;

@layer tokens {
  :root {
    color-scheme: light dark;

    --bg: #ffffff;
    --bg-elevado: #ffffff;
    --bg-sutil: #f5f5f6;
    --fg: #18181b;
    --fg-tenue: #6b6b74;
    --borde: #e4e4e7;
    --acento: #2563a8;
    --acento-fg: #ffffff;

    --ingreso: #1b7f4d;
    --gasto: #c0392b;
    --estimado: #6b46c1;
    --pendiente: #a56a12;

    --esp-1: 4px;
    --esp-2: 8px;
    --esp-3: 12px;
    --esp-4: 16px;
    --esp-5: 24px;
    --esp-6: 32px;

    --r-sm: 6px;
    --r-md: 10px;
    --r-lg: 14px;

    --txt-sm: 0.875rem;
    --txt-base: 1rem;
    --txt-lg: 1.25rem;
    --txt-xl: 1.75rem;

    --sombra-1: 0 1px 2px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.06);

    --ancho-cuerpo: 960px;
    --ancho-sidebar: 240px;

    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #121214;
      --bg-elevado: #1c1c1f;
      --bg-sutil: #202024;
      --fg: #ececee;
      --fg-tenue: #9a9aa2;
      --borde: #2e2e33;
      --acento: #5b9bd8;
      --acento-fg: #0b0b0c;

      --ingreso: #46c98a;
      --gasto: #f27a72;
      --estimado: #a78bfa;
      --pendiente: #e0a44a;

      --sombra-1: 0 1px 2px rgba(0, 0, 0, 0.3), 0 2px 10px rgba(0, 0, 0, 0.45);
    }
  }
}

@layer base {
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    color: var(--fg);
    background: var(--bg);
    font-size: var(--txt-base);
    line-height: 1.5;
  }

  h1,
  h2,
  h3 {
    line-height: 1.25;
  }

  button {
    font: inherit;
    cursor: pointer;
  }

  input,
  select {
    font: inherit;
    color: var(--fg);
  }
}

@layer layout {
  #app {
    max-width: 720px;
    margin: 0 auto;
    padding: var(--esp-4);
  }

  .barra {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--borde);
    padding-bottom: var(--esp-3);
    margin-bottom: var(--esp-4);
  }

  .cuerpo {
    display: block;
  }
}

@layer componentes {
  button,
  .boton {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--esp-2);
    padding: var(--esp-2) var(--esp-3);
    border: 1px solid var(--borde);
    border-radius: var(--r-sm);
    background: var(--bg-elevado);
    color: var(--fg);
  }

  button:hover:not(:disabled) {
    background: var(--bg-sutil);
  }

  button:disabled {
    opacity: 0.55;
    cursor: default;
  }

  button.activo {
    background: var(--acento);
    border-color: var(--acento);
    color: var(--acento-fg);
  }

  .boton--primario {
    background: var(--acento);
    border-color: var(--acento);
    color: var(--acento-fg);
  }

  .boton--icono {
    width: 36px;
    height: 36px;
    padding: var(--esp-2);
    border-color: transparent;
    background: transparent;
    color: var(--fg-tenue);
  }

  .boton--icono:hover:not(:disabled) {
    background: var(--bg-sutil);
    color: var(--fg);
  }

  .boton--icono svg {
    width: 18px;
    height: 18px;
  }

  :where(button, input, select):focus-visible {
    outline: 2px solid var(--acento);
    outline-offset: 1px;
  }

  input,
  select {
    padding: var(--esp-2) var(--esp-3);
    border: 1px solid var(--borde);
    border-radius: var(--r-sm);
    background: var(--bg);
  }

  .selector-periodo,
  .selector-modo,
  .nav {
    display: flex;
    flex-wrap: wrap;
    gap: var(--esp-2);
    align-items: center;
    margin-bottom: var(--esp-4);
  }

  .periodo-label {
    font-weight: 600;
    min-width: 9ch;
    text-align: center;
  }

  .selector-modo button.activo {
    background: var(--estimado);
    border-color: var(--estimado);
    color: #fff;
  }

  .selector-modo button:first-child.activo {
    background: var(--acento);
    border-color: var(--acento);
    color: var(--acento-fg);
  }

  .error {
    color: var(--gasto);
    min-height: 1.2em;
    margin: var(--esp-3) 0;
  }

  .vacio {
    color: var(--fg-tenue);
    padding: var(--esp-4);
    text-align: center;
  }

  .form-inline,
  .form-mov {
    display: flex;
    flex-wrap: wrap;
    gap: var(--esp-3);
    align-items: center;
    margin-bottom: var(--esp-5);
  }

  .lista {
    display: flex;
    flex-direction: column;
    gap: var(--esp-2);
  }

  .fila {
    display: flex;
    flex-wrap: wrap;
    gap: var(--esp-2) var(--esp-3);
    align-items: center;
    padding: var(--esp-3) var(--esp-4);
    border: 1px solid var(--borde);
    border-radius: var(--r-md);
    background: var(--bg-elevado);
  }

  .fila .nombre {
    font-weight: 600;
  }

  .fila .cat,
  .fila .fecha,
  .fila .tipo {
    color: var(--fg-tenue);
    font-size: var(--txt-sm);
  }

  .fila .monto {
    margin-left: auto;
    font-variant-numeric: tabular-nums;
  }

  .fila.tipo-ingreso .monto {
    color: var(--ingreso);
  }

  .fila.tipo-gasto .monto {
    color: var(--gasto);
  }

  .fila.fila-pagada {
    opacity: 0.55;
  }

  .punto {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--fg-tenue);
    display: inline-block;
  }

  button.pagado {
    background: color-mix(in srgb, var(--ingreso) 15%, transparent);
    border-color: var(--ingreso);
    color: var(--ingreso);
  }

  button.pendiente {
    background: color-mix(in srgb, var(--pendiente) 18%, transparent);
    border-color: var(--pendiente);
    color: var(--pendiente);
  }

  .cifras {
    display: flex;
    flex-wrap: wrap;
    gap: var(--esp-4);
  }

  .grupo-resumen {
    flex: 1 1 100%;
    display: flex;
    flex-wrap: wrap;
    gap: var(--esp-4);
    align-items: stretch;
  }

  .grupo-resumen h3 {
    flex: 1 1 100%;
    margin: var(--esp-3) 0 0;
    font-size: var(--txt-sm);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--fg-tenue);
  }

  .tarjeta {
    flex: 1 1 160px;
    border: 1px solid var(--borde);
    border-radius: var(--r-lg);
    padding: var(--esp-4);
    background: var(--bg-elevado);
    box-shadow: var(--sombra-1);
    display: flex;
    flex-direction: column;
    gap: var(--esp-1);
  }

  .tarjeta .titulo {
    color: var(--fg-tenue);
    font-size: var(--txt-sm);
  }

  .tarjeta .valor {
    font-size: var(--txt-xl);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .tarjeta.ingreso .valor {
    color: var(--ingreso);
  }

  .tarjeta.gasto .valor {
    color: var(--gasto);
  }

  form.login {
    display: flex;
    flex-direction: column;
    gap: var(--esp-4);
    max-width: 340px;
    margin: 10vh auto 0;
    padding: var(--esp-6);
    border: 1px solid var(--borde);
    border-radius: var(--r-lg);
    background: var(--bg-elevado);
    box-shadow: var(--sombra-1);
  }

  form.login h1 {
    text-align: center;
    margin: 0;
    font-size: var(--txt-xl);
  }
}
```

- [ ] **Step 4: Servir y verificar**

Run: `npx serve .` y abrir la URL.
Verificar el checklist base **más**:
- Los colores de ingreso (verde) y gasto (rojo) se distinguen bien en claro y oscuro.
- El fondo, texto y bordes cambian correctamente al alternar `prefers-color-scheme`.
- La barra superior, selectores y filas se ven con el nuevo espaciado; nada roto.
- Comprobar contraste de `--gasto`, `--ingreso`, `--pendiente`, `--estimado` sobre `--bg` y `--bg-elevado` con el checker de contraste de DevTools (objetivo AA 4.5:1; los acentos violeta/ámbar se usan solo en badges/botones, no en texto corrido). Ajustar el hex en `@layer tokens` si algún par no llega.

- [ ] **Step 5: Verificar que la lógica sigue en verde**

Run: `npm test`
Expected: PASS (sin cambios respecto de antes; solo tocamos CSS y HTML).

- [ ] **Step 6: Commit**

```bash
git add app.css index.html
git commit -m "style: sistema de tokens, base y dark mode automatico"
```

---

## Task 2: Módulo de iconos SVG

Crea `src/ui/iconos.js` con la fábrica de nodos SVG. Todavía nadie lo importa, así que no hay cambio visual; la verificación es que la app carga sin errores y los tests siguen verdes.

**Files:**
- Create: `src/ui/iconos.js`

**Interfaces:**
- Consumes: nada.
- Produces: 7 funciones sin argumentos, cada una devuelve un `SVGSVGElement` nuevo (24×24, `stroke="currentColor"`, `fill="none"`, `aria-hidden="true"`):
  `flechaIzq()`, `flechaDer()`, `salir()`, `mas()`, `lapiz()`, `basura()`, `check()`.

- [ ] **Step 1: Crear `src/ui/iconos.js`**

```js
// Iconos SVG inline (subconjunto de Lucide, licencia ISC), sin dependencias.
// Cada export devuelve un nodo <svg> nuevo listo para insertar como hijo de un botón.
const NS = "http://www.w3.org/2000/svg";

function svg(paths) {
  const nodo = document.createElementNS(NS, "svg");
  nodo.setAttribute("viewBox", "0 0 24 24");
  nodo.setAttribute("width", "24");
  nodo.setAttribute("height", "24");
  nodo.setAttribute("fill", "none");
  nodo.setAttribute("stroke", "currentColor");
  nodo.setAttribute("stroke-width", "2");
  nodo.setAttribute("stroke-linecap", "round");
  nodo.setAttribute("stroke-linejoin", "round");
  nodo.setAttribute("aria-hidden", "true");
  for (const d of [].concat(paths)) {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    nodo.appendChild(p);
  }
  return nodo;
}

export const flechaIzq = () => svg("M15 18l-6-6 6-6");
export const flechaDer = () => svg("M9 18l6-6-6-6");
export const salir = () =>
  svg(["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"]);
export const mas = () => svg(["M12 5v14", "M5 12h14"]);
export const lapiz = () =>
  svg(["M12 20h9", "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"]);
export const basura = () =>
  svg([
    "M3 6h18",
    "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
    "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6",
    "M10 11v6",
    "M14 11v6",
  ]);
export const check = () => svg("M20 6L9 17l-5-5");
```

- [ ] **Step 2: Smoke check de sintaxis del módulo**

Run: `node --check src/ui/iconos.js`
Expected: sin salida (sintaxis válida). *(No se puede ejecutar el módulo en Node porque usa `document`; se prueba visualmente al integrarlo en la Tarea 3.)*

- [ ] **Step 3: Verificar que la app carga**

Run: `npx serve .`
Expected: la app funciona igual que antes, sin errores nuevos en consola (el módulo todavía no se importa).

- [ ] **Step 4: Tests de lógica**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/iconos.js
git commit -m "feat(ui): modulo de iconos SVG inline"
```

---

## Task 3: Shell con sidebar

Reestructura `shell.js` para envolver todo en `.app` (grid), con `.sidebar` (marca + nav + salir) a la izquierda y `.principal` (`.topbar` + `.cuerpo`) a la derecha. Cambia el layout de `app.css` de columna centrada a shell responsive. Usa iconos en ‹ ›/salir.

**Files:**
- Modify: `src/ui/shell.js`
- Modify: `app.css` (capa `layout`, y ajuste menor en `componentes` para `.nav` dentro de la sidebar)

**Interfaces:**
- Consumes: `flechaIzq()`, `flechaDer()`, `salir()` de `src/ui/iconos.js` (Tarea 2). Tokens y la clase `.boton--icono` de la Tarea 1.
- Produces: contrato de clases del shell que consumen las tareas 4–6 solo como contexto visual: `.app`, `.sidebar`, `.principal`, `.topbar`, `.cuerpo`, `.marca`, `.marca-movil`. El punto de montaje de las vistas sigue siendo el `<main class="cuerpo">` que `pintarVista()` pasa como `contenedor` a cada `montar*` (sin cambio de firma).

- [ ] **Step 1: Reescribir `src/ui/shell.js`**

Reemplazá TODO el contenido por esto (mantiene toda la lógica de estado y solo cambia el ensamblado final + iconos):

```js
import { el, limpiar } from "./dom.js";
import { cerrarSesion } from "../auth.js";
import {
  rangoPeriodo,
  periodoAnterior,
  periodoSiguiente,
  etiquetaPeriodo,
} from "../logic/periodos.js";
import { flechaIzq, flechaDer, salir } from "./iconos.js";
import { montarMovimientos } from "./movimientosView.js";
import { montarResumen } from "./resumenView.js";
import { montarCategorias } from "./categoriasView.js";

const VISTAS = [
  { clave: "movimientos", titulo: "Movimientos", montar: montarMovimientos },
  { clave: "resumen", titulo: "Resumen", montar: montarResumen },
  { clave: "categorias", titulo: "Categorías", montar: montarCategorias },
];

export function montarShell(contenedor) {
  limpiar(contenedor);

  let fechaRef = new Date();
  let tipo = "mes";
  let activa = "movimientos";
  let modo =
    localStorage.getItem("finanzas.modo") === "estimado" ? "estimado" : "real";

  const cuerpo = el("main", { class: "cuerpo" });
  const etiqueta = el("span", { class: "periodo-label" });

  function pintarVista() {
    const rango = rangoPeriodo(fechaRef, tipo);
    etiqueta.textContent = etiquetaPeriodo(fechaRef, tipo);
    const vista = VISTAS.find((v) => v.clave === activa);
    vista.montar(cuerpo, { rango, tipo, fechaRef, modo });
  }

  const btnTipo = {};
  for (const t of ["semana", "mes", "año"]) {
    btnTipo[t] = el("button", {
      text: t[0].toUpperCase() + t.slice(1),
      onClick: () => {
        tipo = t;
        sincronizarTipo();
        pintarVista();
      },
    });
  }
  function sincronizarTipo() {
    for (const t of ["semana", "mes", "año"]) {
      btnTipo[t].classList.toggle("activo", tipo === t);
    }
  }

  const btnModo = {};
  for (const m of ["real", "estimado"]) {
    btnModo[m] = el("button", {
      text: m === "real" ? "Real" : "Estimado",
      onClick: () => {
        modo = m;
        localStorage.setItem("finanzas.modo", modo);
        sincronizarModo();
        pintarVista();
      },
    });
  }
  function sincronizarModo() {
    for (const m of ["real", "estimado"]) {
      btnModo[m].classList.toggle("activo", modo === m);
    }
  }
  const selectorModo = el("div", { class: "selector-modo" }, [
    btnModo.real,
    btnModo.estimado,
  ]);

  const selectorPeriodo = el("div", { class: "selector-periodo" }, [
    btnTipo.semana,
    btnTipo.mes,
    btnTipo["año"],
    el(
      "button",
      {
        class: "boton--icono",
        "aria-label": "Período anterior",
        onClick: () => {
          fechaRef = periodoAnterior(fechaRef, tipo);
          pintarVista();
        },
      },
      [flechaIzq()]
    ),
    etiqueta,
    el(
      "button",
      {
        class: "boton--icono",
        "aria-label": "Período siguiente",
        onClick: () => {
          fechaRef = periodoSiguiente(fechaRef, tipo);
          pintarVista();
        },
      },
      [flechaDer()]
    ),
  ]);

  const botonesNav = VISTAS.map((v) =>
    el("button", {
      text: v.titulo,
      onClick: () => {
        activa = v.clave;
        sincronizarNav();
        pintarVista();
      },
    })
  );
  function sincronizarNav() {
    botonesNav.forEach((b, i) =>
      b.classList.toggle("activo", VISTAS[i].clave === activa)
    );
  }
  const nav = el("nav", { class: "nav" }, botonesNav);

  const btnSalir = el(
    "button",
    { class: "salir", onClick: () => cerrarSesion() },
    [salir(), "Salir"]
  );

  const sidebar = el("aside", { class: "sidebar" }, [
    el("div", { class: "marca", text: "Finanzas" }),
    nav,
    btnSalir,
  ]);

  const topbar = el("header", { class: "topbar" }, [
    el("div", { class: "marca-movil", text: "Finanzas" }),
    selectorPeriodo,
    selectorModo,
  ]);

  const principal = el("div", { class: "principal" }, [topbar, cuerpo]);
  const app = el("div", { class: "app" }, [sidebar, principal]);

  contenedor.append(app);
  sincronizarTipo();
  sincronizarModo();
  sincronizarNav();
  pintarVista();
}
```

- [ ] **Step 2: Reemplazar la capa `layout` de `app.css`**

En `app.css`, reemplazá el bloque `@layer layout { ... }` completo por:

```css
@layer layout {
  #app {
    min-height: 100vh;
  }

  .app {
    display: grid;
    grid-template-columns: var(--ancho-sidebar) 1fr;
    min-height: 100vh;
  }

  .sidebar {
    display: flex;
    flex-direction: column;
    gap: var(--esp-2);
    padding: var(--esp-5) var(--esp-4);
    background: var(--bg-elevado);
    border-right: 1px solid var(--borde);
  }

  .sidebar .marca {
    font-size: var(--txt-lg);
    font-weight: 700;
    padding: 0 var(--esp-2) var(--esp-3);
  }

  .sidebar .nav {
    flex-direction: column;
    gap: var(--esp-1);
    margin-bottom: 0;
  }

  .sidebar .nav button {
    width: 100%;
    justify-content: flex-start;
  }

  .sidebar .salir {
    margin-top: auto;
  }

  .principal {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .topbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--esp-3) var(--esp-5);
    padding: var(--esp-4) var(--esp-5);
    border-bottom: 1px solid var(--borde);
  }

  .topbar .selector-periodo,
  .topbar .selector-modo {
    margin-bottom: 0;
  }

  .marca-movil {
    display: none;
    font-weight: 700;
    font-size: var(--txt-lg);
  }

  .cuerpo {
    width: 100%;
    max-width: var(--ancho-cuerpo);
    margin: 0 auto;
    padding: var(--esp-5);
    flex: 1;
  }

  @media (max-width: 720px) {
    .app {
      grid-template-columns: 1fr;
    }

    .sidebar {
      position: fixed;
      inset: auto 0 0 0;
      z-index: 10;
      flex-direction: row;
      align-items: center;
      gap: var(--esp-2);
      padding: var(--esp-2);
      border-right: 0;
      border-top: 1px solid var(--borde);
    }

    .sidebar .marca {
      display: none;
    }

    .sidebar .nav {
      flex: 1;
      flex-direction: row;
    }

    .sidebar .nav button {
      justify-content: center;
    }

    .sidebar .salir {
      margin-top: 0;
    }

    .principal {
      padding-bottom: 64px;
    }

    .marca-movil {
      display: block;
    }

    .topbar {
      padding: var(--esp-3) var(--esp-4);
    }

    .cuerpo {
      padding: var(--esp-4);
    }
  }
}
```

- [ ] **Step 3: Borrar la regla `.barra` obsoleta**

En la capa `componentes` no está, pero en la capa `layout` original sí. Ya la quitaste al reemplazar el bloque en el Step 2. Verificá con:

Run: `grep -n "\.barra" app.css`
Expected: sin resultados.

- [ ] **Step 4: Servir y verificar**

Run: `npx serve .`
Verificar el checklist base **más**:
- **Escritorio:** sidebar fija a la izquierda (~240px) con "Finanzas", los 3 botones de navegación en columna y "Salir" abajo del todo. Contenido a la derecha, centrado hasta ~960px.
- Los iconos ‹ › se ven (chevrons) y funcionan; el botón "Salir" muestra icono + texto.
- La vista activa se resalta en la nav.
- **Móvil (~375px):** la navegación pasa a una barra fija abajo (3 botones + Salir en fila); "Finanzas" aparece en la topbar; los selectores de período y modo se apilan; el contenido no queda tapado por la barra inferior (hay `padding-bottom`).
- Claro y oscuro OK en ambos anchos.

- [ ] **Step 5: Tests de lógica**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/shell.js app.css
git commit -m "feat(ui): shell con sidebar y layout de escritorio"
```

---

## Task 4: Vista Resumen — grillas de grupos y tarjetas

Envuelve las tarjetas del modo real en `.tarjetas-fila` y los 3 grupos del modo estimado en `.grupos` (grid de 3 columnas en escritorio, apilado en móvil). Cada grupo apila su título y sus 3 tarjetas en columna.

**Files:**
- Modify: `src/ui/resumenView.js`
- Modify: `app.css` (capa `componentes`: `.grupos`, `.tarjetas-fila`, `.grupo-resumen`)

**Interfaces:**
- Consumes: tokens (Tarea 1). Estructura de datos sin cambios: `calcularTotales()` y `desglosarPorPago()` de `src/logic/totales.js` devuelven `{ ingresos, gastos, balance }`.
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Modificar `src/ui/resumenView.js`**

Cambiá las funciones `grupo` y `montarResumen`. `fmt` y `tarjeta` quedan igual.

Reemplazá la función `grupo` por:

```js
function grupo(titulo, t) {
  return el("div", { class: "grupo-resumen" }, [
    el("h3", { text: titulo }),
    el("div", { class: "tarjetas-grupo" }, [
      tarjeta("Ingresos", t.ingresos, "ingreso"),
      tarjeta("Gastos", t.gastos, "gasto"),
      tarjeta("Balance", t.balance, t.balance >= 0 ? "ingreso" : "gasto"),
    ]),
  ]);
}
```

En `montarResumen`, reemplazá el bloque `try { ... }` (desde `const movimientos = ...` hasta el cierre antes del `catch`) por:

```js
  try {
    const movimientos = await listarMovimientos({ ...rango, modo });
    if (modo === "estimado") {
      const d = desglosarPorPago(movimientos);
      cifras.append(
        el("div", { class: "grupos" }, [
          grupo("Estimado", d.total),
          grupo("Pagado", d.pagado),
          grupo("Pendiente", d.pendiente),
        ])
      );
    } else {
      const { ingresos, gastos, balance } = calcularTotales(movimientos);
      cifras.append(
        el("div", { class: "tarjetas-fila" }, [
          tarjeta("Ingresos", ingresos, "ingreso"),
          tarjeta("Gastos", gastos, "gasto"),
          tarjeta("Balance", balance, balance >= 0 ? "ingreso" : "gasto"),
        ])
      );
    }
  } catch (e) {
```

- [ ] **Step 2: Actualizar CSS de resumen**

En `app.css`, capa `componentes`, reemplazá las reglas de `.cifras`, `.grupo-resumen`, `.grupo-resumen h3` y `.tarjeta` (la de `flex: 1 1 160px`) por:

```css
  .cifras {
    display: flex;
    flex-direction: column;
    gap: var(--esp-6);
  }

  .tarjetas-fila {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--esp-4);
  }

  .grupos {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--esp-4);
  }

  .grupo-resumen {
    display: flex;
    flex-direction: column;
    gap: var(--esp-3);
  }

  .grupo-resumen h3 {
    margin: 0;
    font-size: var(--txt-sm);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--fg-tenue);
  }

  .tarjetas-grupo {
    display: flex;
    flex-direction: column;
    gap: var(--esp-3);
  }

  .tarjeta {
    border: 1px solid var(--borde);
    border-radius: var(--r-lg);
    padding: var(--esp-4);
    background: var(--bg-elevado);
    box-shadow: var(--sombra-1);
    display: flex;
    flex-direction: column;
    gap: var(--esp-1);
  }
```

Y añadí, dentro del `@media (max-width: 720px)` que creaste en la Tarea 3 (o creá uno nuevo en la capa `componentes` si preferís mantenerlo cerca):

```css
  @media (max-width: 720px) {
    .grupos {
      grid-template-columns: 1fr;
    }
  }
```

- [ ] **Step 3: Servir y verificar**

Run: `npx serve .` → vista **Resumen**.
Verificar:
- **Modo real:** 3 tarjetas (Ingresos, Gastos, Balance) en fila en escritorio, apiladas en móvil. Balance en verde si ≥ 0, rojo si < 0.
- **Modo estimado:** 3 columnas (Estimado, Pagado, Pendiente) en escritorio; cada una con su título en mayúsculas tenue y 3 tarjetas debajo. En móvil, las 3 columnas se apilan.
- Los números coinciden con los movimientos del período (comparar con la vista Movimientos).
- Botón "Reintentar" del estado de error sigue apareciendo si se corta la red (opcional: DevTools → offline).
- Claro y oscuro OK.

- [ ] **Step 4: Tests de lógica**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/resumenView.js app.css
git commit -m "feat(ui): resumen con grillas de grupos y tarjetas"
```

---

## Task 5: Vista Movimientos — filas en grid y botones-icono

Convierte la fila de movimiento en un grid de columnas alineadas, agrupa los botones de acción en `.acciones`, y reemplaza el texto de los botones editar/borrar/toggle por iconos con `aria-label`. El formulario de alta pasa a grid.

**Files:**
- Modify: `src/ui/movimientosView.js`
- Modify: `app.css` (capa `componentes`: `.fila` a grid, `.acciones`, `.boton--icono`, `.form-mov` a grid, colapso móvil de `.fila`)

**Interfaces:**
- Consumes: `lapiz()`, `basura()`, `check()` de `src/ui/iconos.js` (Tarea 2). Tokens (Tarea 1).
- Produces: patrón `.fila` (5 columnas: `nombre cat fecha monto acciones`) + wrapper `.acciones`, que la Tarea 6 reusa con una variante.

- [ ] **Step 1: Modificar el formulario de alta en `src/ui/movimientosView.js`**

En `formularioNuevo`, en el `el("form", { class: "form-mov", ... })`, cambiá la clase a:

```js
      class: "form-mov form-grid",
```

*(Se mantiene `form-mov` por compatibilidad; `form-grid` aporta el layout nuevo.)*

- [ ] **Step 2: Modificar `fila` en `src/ui/movimientosView.js`**

Reemplazá el `return el("div", { class: claseFila }, [ ... ])` final de la función `fila` por:

```js
  return el("div", { class: claseFila }, [
    el("span", { class: "nombre", text: m.nombre }),
    el("span", { class: "cat", text: cat }),
    el("span", { class: "fecha", text: m.fecha }),
    el("span", { class: "monto", text: `${signo} ${fmt(m.monto)}` }),
    el("div", { class: "acciones" }, controles),
  ]);
```

Y reemplazá las tres definiciones de botones (`editarMonto`, `borrar`, y el `togglePagado` dentro del `if (modo === "estimado")`) por versiones con icono:

```js
  const editarMonto = el(
    "button",
    {
      class: "boton--icono",
      "aria-label": "Editar monto",
      title: "Editar monto",
      onClick: async () => {
        const nuevo = prompt("Nuevo monto", m.monto);
        const num = Number(nuevo);
        if (nuevo === null || !Number.isFinite(num) || num < 0) return;
        try {
          await actualizarMovimiento(m.id, { monto: num });
          await recargar();
        } catch (e) {
          error.textContent = "No se pudo actualizar el movimiento.";
        }
      },
    },
    [lapiz()]
  );

  const borrar = el(
    "button",
    {
      class: "boton--icono",
      "aria-label": `Borrar ${m.nombre}`,
      title: "Borrar",
      onClick: async () => {
        if (!confirm(`¿Borrar "${m.nombre}"?`)) return;
        try {
          await eliminarMovimiento(m.id);
          await recargar();
        } catch (e) {
          error.textContent = "No se pudo borrar el movimiento.";
        }
      },
    },
    [basura()]
  );

  const controles = [editarMonto, borrar];
  if (modo === "estimado") {
    const togglePagado = el(
      "button",
      {
        class: m.pagado ? "pagado" : "pendiente",
        text: m.pagado ? "Pagado" : "Pendiente",
        onClick: async () => {
          try {
            await actualizarMovimiento(m.id, { pagado: !m.pagado });
            await recargar();
          } catch (e) {
            error.textContent = "No se pudo actualizar el estado.";
          }
        },
      },
      []
    );
    controles.unshift(togglePagado);
  }
```

Añadí el import de iconos al principio del archivo, después de los imports existentes:

```js
import { lapiz, basura } from "./iconos.js";
```

*(El toggle pagado/pendiente conserva texto porque comunica un estado, no una acción puntual.)*

- [ ] **Step 3: Actualizar CSS de filas y formulario**

En `app.css`, capa `componentes`:

Reemplazá la regla `.form-inline, .form-mov { ... }` por:

```css
  .form-inline {
    display: flex;
    flex-wrap: wrap;
    gap: var(--esp-3);
    align-items: center;
    margin-bottom: var(--esp-5);
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: var(--esp-3);
    align-items: end;
    margin-bottom: var(--esp-5);
  }
```

Reemplazá la regla `.fila { ... }` y la de `.fila .monto` por:

```css
  .fila {
    display: grid;
    grid-template-columns: 1fr auto auto auto auto;
    gap: var(--esp-2) var(--esp-3);
    align-items: center;
    padding: var(--esp-3) var(--esp-4);
    border: 1px solid var(--borde);
    border-radius: var(--r-md);
    background: var(--bg-elevado);
  }

  .fila .monto {
    font-variant-numeric: tabular-nums;
    text-align: right;
    white-space: nowrap;
  }

  .fila .acciones {
    display: flex;
    gap: var(--esp-1);
    align-items: center;
  }
```

En el `@media (max-width: 720px)` de la capa `componentes`, añadí el colapso de la fila:

```css
    .fila {
      grid-template-columns: 1fr auto;
    }

    .fila .cat,
    .fila .fecha {
      grid-column: 1 / -1;
    }

    .fila .acciones {
      grid-column: 1 / -1;
      justify-content: flex-end;
    }
```

- [ ] **Step 4: Servir y verificar**

Run: `npx serve .` → vista **Movimientos**.
Verificar:
- Las columnas (nombre / categoría / fecha / monto / acciones) quedan alineadas verticalmente entre filas, tanto en modo real (2 acciones) como estimado (3 acciones).
- El monto queda a la derecha, con dígitos tabulares; verde/rojo según tipo.
- Editar monto (icono lápiz) abre el `prompt` y actualiza. Borrar (icono papelera) pide confirmación y borra. En modo estimado, el botón Pagado/Pendiente sigue con texto y color y togglea.
- Hover sobre los botones-icono muestra fondo sutil.
- Formulario de alta: campos en grilla que se reacomoda al achicar; alta funciona y limpia los campos.
- **Móvil:** la fila colapsa (nombre + monto arriba; categoría, fecha y acciones debajo, acciones a la derecha). Nada se desborda horizontalmente.
- Claro y oscuro OK.
- Consola sin errores (revisar que `iconos.js` importa bien).

- [ ] **Step 5: Tests de lógica**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/movimientosView.js app.css
git commit -m "feat(ui): movimientos con filas en grid y botones-icono"
```

---

## Task 6: Vista Categorías + Login

Aplica el grid de fila a Categorías con su propia variante de columnas, agrupa acciones en `.acciones`, pasa los botones a iconos, y agranda el punto de color como chip. En Login, ajusta solo el CSS de la tarjeta (el JS no cambia).

**Files:**
- Modify: `src/ui/categoriasView.js`
- Modify: `app.css` (capa `componentes`: `.fila--categoria`, `.punto`)

**Interfaces:**
- Consumes: `lapiz()`, `basura()` de `src/ui/iconos.js` (Tarea 2). Patrón `.fila` + `.acciones` (Tarea 5). CSS de `form.login` (Tarea 1).
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Modificar `fila` en `src/ui/categoriasView.js`**

Añadí el import de iconos después de los imports existentes:

```js
import { lapiz, basura } from "./iconos.js";
```

Reemplazá los botones `renombrar` y `borrar` y el `return` de la función `fila` por:

```js
  const renombrar = el(
    "button",
    {
      class: "boton--icono",
      "aria-label": `Renombrar ${c.nombre}`,
      title: "Renombrar",
      onClick: async () => {
        const nuevo = prompt("Nuevo nombre", c.nombre);
        if (nuevo === null || !nuevo.trim()) return;
        try {
          await actualizarCategoria(c.id, { nombre: nuevo.trim() });
          await recargar();
        } catch (e) {
          error.textContent = "No se pudo actualizar la categoría.";
        }
      },
    },
    [lapiz()]
  );

  const borrar = el(
    "button",
    {
      class: "boton--icono",
      "aria-label": `Borrar ${c.nombre}`,
      title: "Borrar",
      onClick: async () => {
        if (!confirm(`¿Borrar "${c.nombre}"? Los movimientos quedarán sin categoría.`))
          return;
        try {
          await eliminarCategoria(c.id);
          await recargar();
        } catch (e) {
          error.textContent = "No se pudo borrar la categoría.";
        }
      },
    },
    [basura()]
  );

  return el("div", { class: `fila fila--categoria tipo-${c.tipo}` }, [
    punto,
    el("span", { class: "nombre", text: c.nombre }),
    el("span", { class: "tipo", text: c.tipo }),
    el("div", { class: "acciones" }, [renombrar, borrar]),
  ]);
```

- [ ] **Step 2: Actualizar CSS de Categorías**

En `app.css`, capa `componentes`, reemplazá la regla `.punto { ... }` por:

```css
  .punto {
    width: 18px;
    height: 18px;
    border-radius: 999px;
    background: var(--fg-tenue);
    display: inline-block;
    flex: none;
  }

  .fila--categoria {
    grid-template-columns: auto 1fr auto auto;
  }

  .fila--categoria .tipo {
    text-transform: capitalize;
  }
```

Y en el `@media (max-width: 720px)` de la capa `componentes`, añadí:

```css
    .fila--categoria {
      grid-template-columns: auto 1fr auto;
    }

    .fila--categoria .tipo {
      grid-column: 1 / -1;
      margin-left: calc(18px + var(--esp-3));
    }
```

- [ ] **Step 3: Servir y verificar**

Run: `npx serve .` → vista **Categorías**.
Verificar:
- Filas con: punto de color (18px, redondo, toma el color de la categoría), nombre, tipo (capitalizado, tenue), y acciones a la derecha (iconos lápiz/papelera).
- Alta de categoría (con selector de color) funciona; la nueva fila muestra el color elegido.
- Renombrar y borrar funcionan (con `prompt`/`confirm`).
- **Móvil:** el tipo baja a su propia línea, alineado con el nombre; acciones a la derecha; sin desborde horizontal.
- **Login:** cerrar sesión → la pantalla de login se ve como tarjeta centrada, con sombra y borde, `h1` "Finanzas" centrado y grande, campos y botón "Entrar" a lo ancho de la tarjeta. Claro y oscuro OK. Volver a entrar funciona.

- [ ] **Step 4: Tests de lógica**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/categoriasView.js app.css
git commit -m "feat(ui): categorias en grid con chip de color y login como tarjeta"
```

---

## Task 7: Limpieza de CSS muerto y regresión completa

Barre `app.css` en busca de reglas que quedaron sin uso tras el rediseño, corre el checklist completo una vez más de punta a punta, y deja el árbol listo para merge.

**Files:**
- Modify: `app.css` (solo si hay reglas muertas que quitar)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: nada.

- [ ] **Step 1: Buscar selectores potencialmente muertos**

Run:
```bash
grep -nE "\.barra|\.form-mov|margin-left: auto" app.css
```
Expected: `.barra` sin resultados. `.form-mov` puede aparecer solo si dejaste una regla vieja: la clase sigue en el DOM pero su layout lo da `.form-grid`; si hay una regla `.form-mov { display: flex ... }` separada de `.form-inline`, quitala. `margin-left: auto` no debería seguir en `.fila .monto`.

- [ ] **Step 2: Verificar a mano cada clase del CSS contra el JS**

Para cada selector de clase en `app.css`, confirmá con `grep` que alguna vista lo emite:
```bash
grep -rnE "class:|classList" src/ui/
```
Quitá de `app.css` cualquier regla cuyo selector no aparezca en `src/ui/` ni en `index.html` (típicos sospechosos: restos de `.form-mov`, clases de una iteración previa). Ante la duda, dejala.

- [ ] **Step 3: Regresión visual completa**

Run: `npx serve .`
Recorré el **checklist de verificación manual base** entero (las 3 vistas × 2 modos × claro/oscuro × móvil/escritorio y todos los flujos listados). Anotá cualquier glitch y corregilo en `app.css` o en la vista correspondiente antes de seguir.

- [ ] **Step 4: Tests de lógica**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit (si hubo limpieza)**

```bash
git add app.css
git commit -m "refactor(css): quitar reglas sin uso tras el rediseno"
```

Si no hubo cambios, saltear el commit.

- [ ] **Step 6: Push y (opcional) verificación en producción**

```bash
git push -u origin rediseno-visual
```

Abrí un PR contra `main`. Tras el merge, GitHub Pages redepliega solo; abrí `https://eatornini.github.io/finanzas-web/` y hacé una pasada rápida del checklist en el sitio real (probando también el tema oscuro del SO).

---

## Self-Review

**1. Spec coverage:**

| Sección del spec | Tarea |
|------------------|-------|
| Enfoque técnico: `@layer` + nesting, un solo `app.css` | Tarea 1 (Step 3) |
| Tokens de color claro + oscuro | Tarea 1 |
| Escalas (espaciado, radios, tipografía, sombra, anchos) | Tarea 1 |
| Contraste AA de semánticos en ambos temas | Tarea 1 (Step 4) |
| Shell: `.app` grid + `.sidebar` + `.principal` + `.topbar` + `.cuerpo` | Tarea 3 |
| Restricción: reusar nodos de botón y handlers | Tarea 3 (Step 1, mismo estado que el original) |
| Móvil: sidebar → barra inferior fija, marca a la topbar | Tarea 3 (Step 2, media query) |
| `.tarjeta` con sombra/radio-lg | Tarea 4 |
| `.lista`/`.fila` a grid de columnas alineadas + colapso móvil | Tarea 5 (Categorías: Tarea 6) |
| `.campo` / `.boton` variantes (`--primario`, `.activo`, `--icono`, `.pagado`/`.pendiente`) | Tarea 1 (todas) |
| Selector de modo: estimado violeta, real acento | Tarea 1 |
| `.form-grid` (restyle en sitio de `.form-mov`/`.form-inline`) | Tarea 5 |
| Resumen: real en fila, estimado en 3 columnas | Tarea 4 |
| Movimientos: form-grid, filas grid, botones-icono con `aria-label`, `prompt`/`confirm` intactos | Tarea 5 |
| Categorías: fila grid, `.punto` como chip, botones-icono | Tarea 6 |
| Login: tarjeta centrada, jerarquía de `h1` | Tarea 1 (CSS) + verificación Tarea 6 |
| Iconos: `src/ui/iconos.js`, 7 SVG inline de Lucide, sin deps | Tarea 2 |
| Fuera de alcance (logic/data/supabase/tests/semántica/diálogos/toggle tema/skeletons/tests UI) | Respetado; Global Constraints |
| Verificación manual (matriz de vistas/modos/temas/anchos + flujos) | Checklist base + Step de verificación por tarea |
| Riesgo shell → mitigación reusar nodos | Tarea 3 |
| Riesgo contraste dark | Tarea 1 (Step 4) |
| Riesgo regresión móvil | Checklist incluye ancho móvil explícito; Tarea 7 |
| Riesgo `el()` con SVG | `dom.js` ya lo soporta (`child.nodeType`); File Structure lo nota |
| Archivos afectados (app.css, index.html, shell, resumen, movimientos, categorias, login, iconos) | Cubiertos; `loginView.js` sin cambios de JS por decisión (solo CSS), documentado |

Sin huecos.

**2. Placeholder scan:** No hay "TBD"/"TODO"/"manejar edge cases"/"similar a Tarea N". Cada step de código trae el código completo. Las tareas 4–6 muestran los bloques CSS enteros a reemplazar, no diffs parciales.

**3. Type / naming consistency:**
- `iconos.js` exporta `flechaIzq, flechaDer, salir, mas, lapiz, basura, check` (Tarea 2). Consumido: `flechaIzq/flechaDer/salir` en Tarea 3; `lapiz/basura` en Tareas 5 y 6; `check` y `mas` quedan disponibles sin uso obligatorio (no es error: son parte del set del spec; si se quiere, quitar en Tarea 7 los exports no usados — opcional).
- Clase `.boton--icono` definida en Tarea 1 (Step 3, capa `componentes`), usada en Tareas 3, 5 y 6. Sin desfase: el CSS existe desde la primera tarea.
- `.acciones` wrapper: creado en Tarea 5, reusado en Tarea 6 con `.fila--categoria`. Consistente.
- `.tarjetas-fila` (real) y `.grupos` + `.tarjetas-grupo` (estimado): definidos y usados solo en Tarea 4. Consistentes entre JS y CSS.
- `.form-grid`: añadido a la clase en Tarea 5 Step 1 (`"form-mov form-grid"`), CSS en Tarea 5 Step 3. Consistente.
- Media query `@media (max-width: 720px)`: aparece en capa `layout` (Tarea 3) y capa `componentes` (Tareas 5 y 6). Son bloques distintos en capas distintas — válido. Cada tarea dice explícitamente en qué capa añadir sus reglas.

Ajuste aplicado: `.boton--icono` movido a la Tarea 1 para que su CSS exista antes del primer uso (Tarea 3).
