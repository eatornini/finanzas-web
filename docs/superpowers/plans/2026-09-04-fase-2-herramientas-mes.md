# Fase 2 — Herramientas de mes — Implementation Plan

**Goal:** Paridad con las acciones de menú de la APK en modo estimado: copiar
el mes al siguiente, borrar los datos del mes, activar/desactivar todos los
movimientos del mes.

**Spec:** `docs/superpowers/specs/2026-09-04-fase-2-herramientas-mes-design.md`

## Global Constraints

- Mismas de Fase 0+1: sin build step, sin dependencias nuevas de runtime,
  responder siempre en español (UI, comentarios, commits), CLP entero,
  zona horaria de negocio `America/Santiago`, 2 espacios / comillas dobles /
  punto y coma, commits `<tipo>: <descripción>` terminando con
  `Claude-Session: https://claude.ai/code/session_013jenY5tuqjSMRY5MJ5BhJc`.

## File Structure

**Nuevos:**
- `supabase/migrations/003-copiar-mes-estimado.sql`
- `src/data/herramientasMes.js`

**Modificados:**
- `supabase/schema.sql` — función `copiar_mes_estimado`.
- `src/logic/totales.js` — `todosActivos`.
- `tests/totales.test.js` — casos de `todosActivos`.
- `src/ui/resumenView.js` — menú "⋯", acciones, aviso.
- `app.css` — `.resumen-cabecera` (position relative), `.menu-mes`, `.aviso`.

---

## Task 1: Migración — función `copiar_mes_estimado`

**Files:**
- Create: `supabase/migrations/003-copiar-mes-estimado.sql`
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Escribir la migración**

Create `supabase/migrations/003-copiar-mes-estimado.sql` con el contenido de
la Sección 1 del spec (función `copiar_mes_estimado(p_desde date)`).

- [ ] **Step 2: Reflejar en `schema.sql`**

Añadir la misma función (con su `grant execute`) al final de
`supabase/schema.sql`, después de las funciones RPC existentes.

- [ ] **Step 3: Verificación**

El usuario corre `003-copiar-mes-estimado.sql` en el SQL Editor de Supabase.
Marcar hecho solo cuando confirme que corrió sin error.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/003-copiar-mes-estimado.sql supabase/schema.sql
git commit -m "feat(db): función copiar_mes_estimado (Fase 2, herramientas de mes)"
```

---

## Task 2: `logic/totales.js` — `todosActivos`

**Files:**
- Modify: `src/logic/totales.js`
- Test: `tests/totales.test.js`

**Interfaces:**
- `todosActivos(movimientos: Array): boolean` — `true` si ningún movimiento
  tiene `activo === false` (lista vacía cuenta como `true`).

- [ ] **Step 1: Test que falla**

Añadir a `tests/totales.test.js`:

```js
import { todosActivos } from "../src/logic/totales.js";

describe("todosActivos", () => {
  it("true si la lista está vacía", () => {
    expect(todosActivos([])).toBe(true);
  });
  it("true si todos están activos", () => {
    expect(todosActivos([{ activo: true }, { activo: true }])).toBe(true);
  });
  it("false si al menos uno está inactivo", () => {
    expect(todosActivos([{ activo: true }, { activo: false }])).toBe(false);
  });
  it("un movimiento sin campo activo cuenta como activo", () => {
    expect(todosActivos([{}])).toBe(true);
  });
});
```

Run: `npm test -- totales` → FAIL (`todosActivos is not a function`).

- [ ] **Step 2: Implementación**

Añadir a `src/logic/totales.js`:

```js
// true si ningún movimiento está marcado inactivo (lista vacía => true):
// determina si "activar/desactivar todos" debe activar o desactivar.
export function todosActivos(movimientos) {
  return movimientos.every((m) => m.activo !== false);
}
```

- [ ] **Step 3: Test pasa**

Run: `npm test` → PASS (todos).

- [ ] **Step 4: Commit**

```bash
git add src/logic/totales.js tests/totales.test.js
git commit -m "feat: todosActivos — determina el sentido del toggle masivo de activo"
```

---

## Task 3: `src/data/herramientasMes.js`

**Files:**
- Create: `src/data/herramientasMes.js`

**Interfaces (ver Sección 2 del spec):**
- `contarMovimientosEstimado(desde, hasta): Promise<number>`
- `copiarMesEstimado(desde): Promise<number>` (vía RPC)
- `borrarMesEstimado(desde, hasta): Promise<void>`
- `cambiarEstadoMesEstimado(desde, hasta, activo): Promise<void>`

- [ ] **Step 1: Implementación**

Create `src/data/herramientasMes.js` con el contenido de la Sección 2 del
spec.

- [ ] **Step 2: Verificación manual**

Con la migración del Task 1 aplicada y `npx serve .` corriendo, desde la
consola del navegador (logueado):
`import("/src/data/herramientasMes.js").then(m => m.contarMovimientosEstimado("2026-09-01","2026-09-30")).then(console.log)`
→ número, sin error.

- [ ] **Step 3: Commit**

```bash
git add src/data/herramientasMes.js
git commit -m "feat(data): wrappers de copiar/borrar/activar-desactivar mes estimado"
```

---

## Task 4: `ui/resumenView.js` — menú "⋯" y estilos

**Files:**
- Modify: `src/ui/resumenView.js`
- Modify: `app.css`

**Interfaces:**
- `montarResumen(contenedor, { rango, tipo, fechaRef, modo })` — firma
  ampliada (antes solo `{ rango, modo }`); `shell.js` ya pasa `tipo` y
  `fechaRef`, no requiere cambios ahí.

- [ ] **Step 1: Cambios en `resumenView.js`**

- Importar `periodoSiguiente`, `rangoPeriodo`, `etiquetaPeriodo` de
  `../logic/periodos.js`; `todosActivos` de `../logic/totales.js`;
  `contarMovimientosEstimado`, `copiarMesEstimado`, `borrarMesEstimado`,
  `cambiarEstadoMesEstimado` de `../data/herramientasMes.js`.
- `montarResumen(contenedor, { rango, tipo, fechaRef, modo })`: guardar
  `movimientos` (la lista ya cargada, sin filtrar) en una variable de nivel
  de función para que el menú la use sin volver a pedirla.
- Construir el botón "⋯" (`aria-label="Más acciones del mes"`) y el popover
  `.menu-mes` (patrón `[hidden]`, igual que `.panel-filtros`), montado junto
  al botón "ojo" en `.resumen-cabecera`. Solo se agrega al DOM cuando
  `modo === "estimado" && tipo === "mes"`.
- Un párrafo `.aviso` bajo la cabecera, vacío por defecto, para mensajes de
  éxito (no usar `alert()`: no bloquea y es consistente con el resto de la
  app, que muestra errores inline).
- Tres botones dentro del popover:
  1. **Copiar mes**: texto `Copiar a <etiquetaPeriodo(desdeSiguiente, "mes")>`.
     `onClick` async: cerrar popover, `desdeSiguiente = periodoSiguiente(fechaRef, "mes")`,
     `rangoDestino = rangoPeriodo(desdeSiguiente, "mes")`,
     `n = await contarMovimientosEstimado(rangoDestino.desde, rangoDestino.hasta)`,
     mensaje de `confirm()` según `n` (spec Sección 4), si confirma:
     `total = await copiarMesEstimado(rango.desde)`, mostrar aviso
     `` `Se copiaron ${total} movimientos a ${etiquetaPeriodo(desdeSiguiente, "mes")}.` ``,
     re-render con `montarResumen(contenedor, { rango, tipo, fechaRef, modo })`.
  2. **Activar/desactivar todos**: texto dinámico según
     `todosActivos(movimientos)` (`"Desactivar todos"` / `"Activar todos"`).
     `confirm()` con la cuenta (`movimientos.length`) y la etiqueta del
     período actual (`etiquetaPeriodo(fechaRef, tipo)`); si confirma,
     `cambiarEstadoMesEstimado(rango.desde, rango.hasta, !todosActivos(movimientos))`,
     aviso, re-render.
  3. **Borrar datos del mes** (clase `menu-mes-item--peligro`):
     `confirm()` con la cuenta y advertencia "no se puede deshacer"; si
     confirma, `borrarMesEstimado(rango.desde, rango.hasta)`, aviso, re-render.
- Manejo de error: try/catch alrededor de cada acción, mensaje en el `error`
  existente (`"No se pudo copiar/borrar/actualizar el mes."`).
- El botón "⋯" y sus tres acciones quedan deshabilitados mientras una
  acción está en curso (evita doble click, sobre todo en "copiar").

- [ ] **Step 2: Estilos en `app.css`**

- `.resumen-cabecera { position: relative; ... }` (agregar `position: relative`
  a la regla existente en la línea ~1630).
- `.menu-mes`: mismo patrón que `.panel-filtros` (position absolute, top:
  calc(100% + var(--esp-2)), right: 0, `box-shadow: var(--sombra-popover)`,
  `border-radius: var(--r-md)`, `background: var(--bg-elevado)`,
  `border: 1px solid var(--borde)`, `[hidden] { display: none; }`).
- `.menu-mes-item`: botón de ancho completo, `text-align: left`, `padding:
  var(--esp-2) var(--esp-3)`, `background: transparent`, `border: 0`,
  `border-radius: var(--r-sm)`, hover con `background: var(--bg-sutil)`.
- `.menu-mes-item--peligro { color: var(--gasto); }`.
- `.aviso { color: var(--fg-tenue); font-size: var(--txt-sm); margin: 0 0 var(--esp-3); }`.

- [ ] **Step 3: Verificación manual**

Con `npx serve .` y la migración del Task 1 aplicada (checklist de la
Sección "Testing" del spec):
1. Modo estimado + período "mes": aparece "⋯"; en "semana"/"año" o en modo
   real, no aparece.
2. Copiar mes con destino vacío y con destino ocupado (confirma y
   sobrescribe).
3. Activar/desactivar todos, revisar que el botón cambie de texto y que los
   totales reflejen el cambio.
4. Borrar datos del mes, confirmar que Movimientos queda vacío para ese mes.

- [ ] **Step 4: Commit**

```bash
git add src/ui/resumenView.js app.css
git commit -m "feat(ui): menú de herramientas de mes en Resumen (copiar/borrar/activar-desactivar)"
```

---

## Task 5: Cierre de rama

- [ ] Actualizar el checklist de gap en
  `docs/superpowers/specs/2026-09-04-roadmap-fases-2-5.md` (marcar el ítem
  "Copiar mes / borrar mes / activar-desactivar todos → Fase 2").
- [ ] Merge de `feat/fase-2-herramientas-mes` a `main` (merge commit, sin
  squash, igual que Fase 0+1) y push.
