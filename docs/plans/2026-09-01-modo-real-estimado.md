# Modo real / estimado — Plan de implementación

> **ESTADO: IMPLEMENTADO Y DESPLEGADO — 2026-09-01.**
> Las 8 tareas están hechas (commits `5833c7c`, `9fee369`, `806c9bc`), la
> migración `001` fue aplicada al proyecto Supabase y verificada en local y en
> producción. Este documento queda como referencia de diseño.

> Ejecutar tarea por tarea. Los pasos usan casilleros `- [ ]` para seguimiento.
> Todas las rutas son relativas a `finanzas-web/`.

**Goal:** Agregar a la app un modo **Real** y un modo **Estimado**. Cada movimiento
pertenece a un modo. Un interruptor global Real/Estimado filtra la lista y el
resumen. En modo Estimado, cada movimiento tiene un estado **pagado / pendiente**
y el Resumen muestra el desglose (estimado total, pagado, pendiente).

## Decisiones de alcance (acordadas en brainstorming, 2026-09-01)

| Tema | Decisión |
|---|---|
| Vistas | **Dos vistas separadas.** El toggle Real/Estimado filtra Movimientos y Resumen. **No** hay pantalla de comparación estimado-vs-real. |
| Sub-estado | Solo en modo Estimado: `pagado` (booleano). En modo Real no aplica. |
| Vínculo estimado↔real | **Ninguno.** Son entradas independientes; no hay conversión ni auto-relleno. |
| Alta de movimiento | El movimiento nuevo nace con el **modo activo** (el que se está viendo). Sin selector en el formulario. Los estimados nacen `pagado = false`. |
| Resumen en modo Estimado | Desglose: **Estimado** (todos), **Pagado** (solo `pagado = true`), **Pendiente** (solo `pagado = false`). |
| Categorías | Compartidas entre ambos modos. La pestaña Categorías no cambia. |
| Persistencia del modo | En `localStorage`. Default al abrir: `real`. |
| Datos existentes | Quedan `modo = 'real'`, `pagado = false` por los defaults de columna. |

## Constraints (heredadas del proyecto)

- Sin paso de build. Módulos ES con rutas relativas y extensión `.js`.
- `@supabase/supabase-js` v2 solo desde CDN.
- Los tests solo cubren `src/logic/**`. `ui/` y `data/` se verifican a mano.
- Español en toda la interfaz.
- `monto` siempre positivo; el signo lo da `tipo`.
- El cliente nunca envía `user_id`.

## Archivos afectados

```
supabase/schema.sql                 (M)  columnas modo + pagado, índice
supabase/migrations/001-modo-estimado.sql  (N)  ALTER para el proyecto ya creado
src/logic/totales.js                (M)  nueva función desglosarPorPago
tests/totales.test.js               (M)  casos de desglosarPorPago
src/data/movimientos.js             (M)  SELECT, filtro por modo, alta con modo/pagado
src/ui/shell.js                     (M)  toggle Real/Estimado + persistencia + ctx
src/ui/movimientosView.js           (M)  filtro por modo, alta con modo activo, control pagado
src/ui/resumenView.js               (M)  desglose en modo estimado
app.css                             (M)  estilos del toggle y de pagado/pendiente
```

---

## Orden de tareas

### Task 1: Migración de esquema

**Files:** `supabase/schema.sql` (M), `supabase/migrations/001-modo-estimado.sql` (N)

- [ ] **Step 1: Actualizar `supabase/schema.sql`**

En la definición de `create table movimientos (...)`, agregar dos columnas
después de `tipo`:

```sql
  modo text not null default 'real' check (modo in ('real','estimado')),
  pagado boolean not null default false,
```

Reemplazar el índice actual por uno que incluya `modo`:

```sql
create index movimientos_user_modo_fecha_idx on movimientos (user_id, modo, fecha);
```

(El resto del archivo —trigger, RLS, policies, grants— no cambia.)

- [ ] **Step 2: Crear `supabase/migrations/001-modo-estimado.sql`**

Para el proyecto Supabase que ya existe y tiene datos:

```sql
-- Modo real/estimado. Ejecutar una sola vez en el SQL Editor de Supabase.
alter table movimientos
  add column if not exists modo text not null default 'real'
    check (modo in ('real','estimado')),
  add column if not exists pagado boolean not null default false;

drop index if exists movimientos_user_fecha_idx;
create index if not exists movimientos_user_modo_fecha_idx
  on movimientos (user_id, modo, fecha);
```

- [ ] **Step 3: Ejecutar la migración**

Pegar el contenido de `001-modo-estimado.sql` en el SQL Editor de Supabase y
ejecutar. Verificar:

```sql
select id, nombre, tipo, modo, pagado from movimientos limit 5;
```

Expected: todas las filas existentes con `modo = 'real'` y `pagado = false`.

---

### Task 2: `desglosarPorPago` en `logic/totales.js` (TDD)

**Files:** `src/logic/totales.js` (M), `tests/totales.test.js` (M)

- [ ] **Step 1: Escribir los tests primero**

Agregar a `tests/totales.test.js`:

```js
import { calcularTotales, desglosarPorPago } from "../src/logic/totales.js";

describe("desglosarPorPago", () => {
  it("lista vacía: total, pagado y pendiente en cero", () => {
    expect(desglosarPorPago([])).toEqual({
      total: { ingresos: 0, gastos: 0, balance: 0 },
      pagado: { ingresos: 0, gastos: 0, balance: 0 },
      pendiente: { ingresos: 0, gastos: 0, balance: 0 },
    });
  });

  it("separa pagados de pendientes y el total es la suma de ambos", () => {
    const movs = [
      { monto: 2000, tipo: "ingreso", pagado: true },
      { monto: 500, tipo: "gasto", pagado: true },
      { monto: 300, tipo: "gasto", pagado: false },
      { monto: 100, tipo: "ingreso", pagado: false },
    ];
    const d = desglosarPorPago(movs);
    expect(d.pagado).toEqual({ ingresos: 2000, gastos: 500, balance: 1500 });
    expect(d.pendiente).toEqual({ ingresos: 100, gastos: 300, balance: -200 });
    expect(d.total).toEqual({ ingresos: 2100, gastos: 800, balance: 1300 });
  });

  it("trata pagado ausente o falsy como pendiente", () => {
    const movs = [
      { monto: 50, tipo: "gasto" },
      { monto: 50, tipo: "gasto", pagado: null },
    ];
    const d = desglosarPorPago(movs);
    expect(d.pendiente.gastos).toBe(100);
    expect(d.pagado.gastos).toBe(0);
  });
});
```

- [ ] **Step 2: Implementar**

Agregar a `src/logic/totales.js` (reutiliza `calcularTotales`):

```js
export function desglosarPorPago(movimientos) {
  const pagados = movimientos.filter((m) => m.pagado === true);
  const pendientes = movimientos.filter((m) => m.pagado !== true);
  return {
    total: calcularTotales(movimientos),
    pagado: calcularTotales(pagados),
    pendiente: calcularTotales(pendientes),
  };
}
```

- [ ] **Step 3: Correr la suite**

Run: `npm test`
Expected: PASS — los 6 casos previos de `calcularTotales` + los 3 nuevos.

---

### Task 3: `data/movimientos.js` — modo en SELECT, filtro y alta

**Files:** `src/data/movimientos.js` (M)

- [ ] **Step 1: Agregar `modo, pagado` al SELECT**

```js
const SELECT =
  "id, nombre, monto, tipo, modo, pagado, categoria_id, fecha, detalle, " +
  "categoria:categorias(nombre, color)";
```

- [ ] **Step 2: Filtrar `listarMovimientos` por modo**

```js
export async function listarMovimientos({ desde, hasta, modo }) {
  return verificar(
    await supabase
      .from("movimientos")
      .select(SELECT)
      .eq("modo", modo)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: false })
  );
}
```

- [ ] **Step 3: Aceptar `modo` y `pagado` en `crearMovimiento`**

```js
export async function crearMovimiento({
  nombre, monto, tipo, modo, pagado = false, categoria_id, fecha, detalle,
}) {
  return verificar(
    await supabase
      .from("movimientos")
      .insert({ nombre, monto, tipo, modo, pagado, categoria_id, fecha, detalle })
      .select(SELECT)
      .single()
  );
}
```

`actualizarMovimiento(id, cambios)` ya acepta cualquier campo en `cambios`;
sirve tal cual para togglear `pagado`. Sin cambios.

- [ ] **Step 4: Verificación** — se hace junto con la UI en la Task 6.

---

### Task 4: `ui/shell.js` — interruptor Real / Estimado

**Files:** `src/ui/shell.js` (M)

- [ ] **Step 1: Estado del modo con persistencia**

Al inicio de `montarShell`, junto a `fechaRef` / `tipo` / `activa`:

```js
let modo = localStorage.getItem("finanzas.modo") === "estimado" ? "estimado" : "real";
```

- [ ] **Step 2: Pasar `modo` en el contexto de las vistas**

En `pintarVista()`, incluir `modo` en el objeto que recibe `vista.montar`:

```js
vista.montar(cuerpo, { rango, tipo, fechaRef, modo });
```

- [ ] **Step 3: Botonera Real / Estimado**

Análoga a `btnTipo`. Dos botones; el activo lleva la clase `activo`:

```js
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
```

- [ ] **Step 4: Montar la botonera**

Envolver en `el("div", { class: "selector-modo" }, [btnModo.real, btnModo.estimado])`
y agregarla al `contenedor.append(...)` entre `selectorPeriodo` y `nav`.
Llamar `sincronizarModo()` junto a `sincronizarTipo()` / `sincronizarNav()` al final.

- [ ] **Step 5: Verificación manual**

`npx serve .`, iniciar sesión. Los botones Real/Estimado se ven; el activo
resaltado. Al recargar la página, se mantiene el último modo elegido.
(La lista/resumen aún no reaccionan hasta las Tasks 5–6.)

---

### Task 5: `ui/movimientosView.js` — modo activo y control pagado

**Files:** `src/ui/movimientosView.js` (M)

- [ ] **Step 1: Recibir `modo` en la firma**

```js
export async function montarMovimientos(contenedor, { rango, modo }) {
```

Pasarlo a `listarMovimientos`:

```js
const movimientos = await listarMovimientos({ ...rango, modo });
```

Y a `formularioNuevo` y `fila` (para que el alta use el modo activo y la fila
sepa si mostrar el control de pagado). Actualizar sus firmas y llamadas:

- `formularioNuevo(categorias, recargar, error, rango, modo)`
- `fila(m, recargar, error, modo)`

- [ ] **Step 2: Alta con el modo activo**

En el `onSubmit` de `formularioNuevo`, en el objeto de `crearMovimiento`:

```js
            modo,
            pagado: false,
```

- [ ] **Step 3: Control pagado / pendiente en la fila (solo modo estimado)**

En `fila(...)`, cuando `modo === "estimado"`, agregar un botón que togglea
`pagado` y una clase visual en la fila:

```js
  const controles = [editarMonto, borrar];
  if (modo === "estimado") {
    const togglePagado = el("button", {
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
    });
    controles.unshift(togglePagado);
  }

  return el(
    "div",
    { class: `fila tipo-${m.tipo}${modo === "estimado" && m.pagado ? " fila-pagada" : ""}` },
    [
      el("span", { class: "nombre", text: m.nombre }),
      el("span", { class: "cat", text: cat }),
      el("span", { class: "fecha", text: m.fecha }),
      el("span", { class: "monto", text: `${signo} ${fmt(m.monto)}` }),
      ...controles,
    ]
  );
```

- [ ] **Step 4: Verificación manual**

`npx serve .`, sesión iniciada.
1. Modo **Real**: la lista muestra solo movimientos reales (los que ya existían).
   Alta de uno nuevo → aparece en Real y **no** en Estimado.
2. Modo **Estimado**: lista vacía al principio. Alta → aparece con botón
   "Pendiente". Click en el botón → pasa a "Pagado", la fila se atenúa; recargar
   la página → el estado persiste.
3. Cambiar de modo con los botones del shell → la lista se actualiza al toque.

---

### Task 6: `ui/resumenView.js` — desglose en modo estimado

**Files:** `src/ui/resumenView.js` (M)

- [ ] **Step 1: Recibir `modo` y ramificar**

```js
import { calcularTotales, desglosarPorPago } from "../logic/totales.js";

export async function montarResumen(contenedor, { rango, modo }) {
  // ...
  const movimientos = await listarMovimientos({ ...rango, modo });

  if (modo === "estimado") {
    const d = desglosarPorPago(movimientos);
    cifras.append(
      grupo("Estimado", d.total),
      grupo("Pagado", d.pagado),
      grupo("Pendiente", d.pendiente)
    );
  } else {
    const { ingresos, gastos, balance } = calcularTotales(movimientos);
    cifras.append(
      tarjeta("Ingresos", ingresos, "ingreso"),
      tarjeta("Gastos", gastos, "gasto"),
      tarjeta("Balance", balance, balance >= 0 ? "ingreso" : "gasto")
    );
  }
```

- [ ] **Step 2: Helper `grupo`**

```js
function grupo(titulo, t) {
  return el("div", { class: "grupo-resumen" }, [
    el("h3", { text: titulo }),
    tarjeta("Ingresos", t.ingresos, "ingreso"),
    tarjeta("Gastos", t.gastos, "gasto"),
    tarjeta("Balance", t.balance, t.balance >= 0 ? "ingreso" : "gasto"),
  ]);
}
```

- [ ] **Step 3: Propagar `modo` en el botón Reintentar**

`onClick: () => montarResumen(contenedor, { rango, modo })`

- [ ] **Step 4: Verificación manual**

Con movimientos estimados cargados (unos pagados, otros pendientes):
- Modo **Real**: el resumen se ve igual que antes (3 tarjetas).
- Modo **Estimado**: 3 grupos. `Estimado` = suma de todos; `Pagado` = solo los
  marcados; `Pendiente` = el resto. Verificar a mano que
  `Pagado + Pendiente = Estimado` en cada cifra.

---

### Task 7: Estilos — `app.css`

**Files:** `app.css` (M)

- [ ] **Step 1: Toggle de modo**

Reutilizar el aspecto de `.selector-periodo` para `.selector-modo` y
`button.activo`. El modo Estimado puede llevar un color de acento distinto
(ej. un violeta suave) para que se note de un vistazo en qué modo se está.

- [ ] **Step 2: Estados pagado / pendiente**

```css
.fila-pagada { opacity: 0.55; }
button.pagado { /* verde suave */ }
button.pendiente { /* neutro / ámbar */ }
.grupo-resumen { /* separación y título de cada bloque del resumen estimado */ }
```

- [ ] **Step 3: (Oportunista) Layout**

Si el contenido sigue saliendo en una columna angosta corrida a la derecha,
aprovechar para centrar el `main`/contenedor y darle un `max-width` razonable.
No es parte de esta feature; hacerlo solo si es rápido.

- [ ] **Step 4: Verificación manual** — recorrer la app en desktop y en el
  celular; el modo activo se distingue claramente; nada se desborda.

---

### Task 8: Verificación end-to-end + publicación

- [ ] **Step 1:** `npm test` → todo verde.

- [ ] **Step 2: Recorrido completo en local** (`npx serve .`)
  1. Arranca en modo Real. Los movimientos viejos están ahí.
  2. Alta en Real → aparece en Real, no en Estimado.
  3. Cambiar a Estimado → lista propia. Alta → nace "Pendiente".
  4. Marcar pagado/pendiente → persiste tras recargar.
  5. Resumen Real: 3 tarjetas como antes. Resumen Estimado: 3 grupos, y
     `Pagado + Pendiente = Estimado`.
  6. El modo elegido se recuerda tras recargar y tras cerrar/abrir sesión.
  7. Cambiar período (Semana/Mes/Año, ‹ ›) respeta el modo activo.
  8. DevTools → Network → Offline → recargar → "No se pudo conectar." + Reintentar.

- [ ] **Step 3: Publicar**

```bash
git add -A
git commit -m "feat: modo real/estimado con estado pagado/pendiente"
git push
```

GitHub Pages ya está configurado: el push publica solo. Esperar ~1 min y
verificar en `https://eatornini.github.io/finanzas-web/` el mismo recorrido,
incluyendo abrirlo en el celular con la misma cuenta.

---

## Self-review

- **Cobertura de decisiones:** dos vistas separadas (Tasks 4–6, sin pantalla de
  comparación) · `pagado` solo en estimado (Tasks 3, 5) · sin vínculo
  estimado↔real (no hay código de conversión) · alta con modo activo (Task 5
  Step 2) · desglose en el resumen estimado (Task 6) · categorías sin cambios ·
  modo en `localStorage`, default `real` (Task 4 Step 1) · datos viejos vía
  `default 'real'` (Task 1).
- **Consistencia entre capas:** `listarMovimientos({desde, hasta, modo})`
  definido en Task 3 y llamado igual desde `movimientosView` y `resumenView`
  (Tasks 5–6) con `{ ...rango, modo }`, donde `rango = {desde, hasta}` viene de
  `rangoPeriodo` (sin cambios). `desglosarPorPago` devuelve
  `{total, pagado, pendiente}`, cada uno con la forma de `calcularTotales`
  (`{ingresos, gastos, balance}`), consumido por `grupo(...)` en Task 6.
- **Tests:** solo tocan `logic/totales.js`. `ui/` y `data/` se verifican a mano
  en cada task, como en el plan original.
- **Migración:** `schema.sql` (reproducible desde cero) y
  `migrations/001-modo-estimado.sql` (proyecto existente) quedan equivalentes:
  mismas columnas, mismo índice.
