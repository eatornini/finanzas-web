# Paridad web ↔ APK — Fase 0 + Fase 1 (diseño)

Fecha: 2026-09-04
Estado: aprobado (diseño). Rama: `feat/paridad-app-web`.

## Contexto

`finanzas-web` es una app estática (JS vanilla, ES modules, sin build) sobre
Supabase (Postgres + Auth), desplegada en GitHub Pages. Existe además una app
Android nativa (`Finanzas APK/`, Kotlin, almacenamiento en JSON local) más
completa. La decisión estratégica tomada: **quedarse solo con la web** (como
PWA), llevándola a paridad funcional con la APK y jubilando la APK. El OCR de
comprobantes se replicará en el navegador (Tesseract.js + port del parser) en
una fase posterior.

Este documento cubre **Fase 0 (base de datos) + Fase 1 (paridad del flujo
principal, sin OCR ni PWA)**.

### Decisiones cerradas

| # | Decisión |
|---|----------|
| 1 | Sin importador de datos: se parte de lo que ya hay en Supabase. |
| 2 | `movimientos.fecha` pasa de `date` a `timestamptz` (con hora). |
| 3 | Categorías en 4 grupos (tipo × modo): `categorias` lleva columna `modo`. |
| 4 | Montos en CLP entero, locale `es-CL`, sin decimales. |
| 5 | Iconos de categoría: fuente Material Symbols **subseteada** (~70 iconos) + emoji libre. |
| 6 | `activo/inactivo` con paridad exacta de la APK + preferencia "Incluir inactivos" (localStorage). |

### Enfoque

Extender el código en el sitio siguiendo los patrones actuales (sin build,
ESM, vistas que construyen DOM con el helper `el()`). Dividir archivos solo
donde crecen (formulario de movimiento). Dos funciones RPC en Postgres para lo
que PostgREST no resuelve bien (agregaciones con `GROUP BY`).

### Fuera de alcance (fases siguientes)

PWA (manifest + service worker), OCR y Web Share Target, imágenes/Supabase
Storage, "copiar mes" / "borrar mes" / "activar-desactivar todos", generación
automática de movimientos recurrentes, vista Reportes, buscador global,
persistencia de colores personalizados.

---

## Sección 1 — Migración de base de datos

Nuevo archivo `supabase/migrations/002-paridad-app.sql`. Reflejar los cambios
equivalentes en `supabase/schema.sql` (para proyectos nuevos). Se corre una
sola vez en el SQL Editor de Supabase.

### `movimientos`

```sql
-- fecha: date -> timestamptz. Filas existentes = mediodía de Santiago,
-- así ningún desfase horario las cambia de día.
alter table movimientos
  alter column fecha type timestamptz
  using ((fecha::timestamp + time '12:00') at time zone 'America/Santiago');

alter table movimientos
  add column activo      boolean not null default true,
  add column imagen      text,                         -- columna ahora; UI en Fase 4
  add column recurrente  boolean not null default false,
  add column frecuencia  text
    check (frecuencia is null or frecuencia in
           ('mensual','bimestral','trimestral','anual'));

-- Fecha en día calendario de Santiago, para filtrar por período sin
-- ambigüedad de zona horaria. La completa un trigger; el cliente nunca la manda.
alter table movimientos add column fecha_local date;

create or replace function set_fecha_local() returns trigger
language plpgsql as $$
begin
  new.fecha_local := (new.fecha at time zone 'America/Santiago')::date;
  return new;
end $$;

create trigger trg_fecha_local
  before insert or update of fecha on movimientos
  for each row execute function set_fecha_local();

update movimientos set fecha_local = (fecha at time zone 'America/Santiago')::date;
alter table movimientos alter column fecha_local set not null;

create index movimientos_user_modo_fechalocal_idx
  on movimientos (user_id, modo, fecha_local);
```

### `categorias`

```sql
alter table categorias
  add column modo  text not null default 'real'
    check (modo in ('real','estimado')),
  add column emoji text,          -- si no está vacío, se muestra el emoji
  add column icono text,          -- si no, ligadura Material Symbols (ej. 'restaurant')
  add column orden integer not null default 0;
```

Las categorías existentes quedan en `modo='real'`. Las de modo estimado se
crean desde la UI. No se enforza a nivel de BD que `movimiento.modo` coincida
con `categoria.modo`: el filtrado es de UI, igual que en la APK.

### Funciones RPC

`security invoker` (respetan RLS de `movimientos`), `stable`, `grant execute`
a `authenticated` y `anon`.

```sql
create or replace function uso_categorias(p_tipo text, p_modo text)
returns table (categoria_id uuid, n bigint)
language sql stable as $$
  select categoria_id, count(*)
  from movimientos
  where tipo = p_tipo and modo = p_modo and categoria_id is not null
  group by categoria_id
$$;

create or replace function sugerencias_comercio(p_tipo text, p_modo text, p_query text)
returns table (nombre text, n bigint)
language sql stable as $$
  select nombre, count(*)
  from movimientos
  where tipo = p_tipo and modo = p_modo and nombre ilike p_query || '%'
  group by nombre
  order by count(*) desc
  limit 8
$$;

grant execute on function uso_categorias(text, text)            to anon, authenticated;
grant execute on function sugerencias_comercio(text, text, text) to anon, authenticated;
```

---

## Sección 2 — Capa de datos

### `src/data/movimientos.js`

- `SELECT` pasa a incluir los campos nuevos y el icono/emoji de la categoría:
  `id, nombre, monto, tipo, modo, pagado, activo, recurrente, frecuencia,
  categoria_id, fecha, detalle, categoria:categorias(nombre, color, icono, emoji)`
- `listarMovimientos({ desde, hasta, modo })`:
  `.eq("modo", modo).gte("fecha_local", desde).lte("fecha_local", hasta)
  .order("fecha", { ascending: false })`
  (`desde`/`hasta` siguen siendo `YYYY-MM-DD` que produce `logic/periodos.js`).
- `crearMovimiento` / `actualizarMovimiento`: aceptan además `activo`,
  `recurrente`, `frecuencia`. `fecha` se envía como ISO con hora
  (`new Date(valorDatetimeLocal).toISOString()`).

### `src/data/categorias.js`

- `listarCategorias()`: `.select("*").order("orden").order("nombre")`.
- `crearCategoria({ nombre, tipo, modo, color, emoji, icono, orden })`.
- `actualizarCategoria(id, cambios)`: sin cambios (ya es genérica; cubre
  renombrar, icono, color, `orden`).
- `eliminarCategoria(id)`: sin cambios (`ON DELETE SET NULL`).

### `src/data/rpc.js` (nuevo)

```js
import { supabase } from "../supabaseClient.js";
import { verificar } from "./_helpers.js";

export async function usoCategorias(tipo, modo) {
  return verificar(await supabase.rpc("uso_categorias", { p_tipo: tipo, p_modo: modo }));
}
export async function sugerenciasComercio(tipo, modo, query) {
  return verificar(
    await supabase.rpc("sugerencias_comercio", { p_tipo: tipo, p_modo: modo, p_query: query })
  );
}
```

---

## Sección 3 — Preferencias y formato de dinero

### `src/prefs.js` (nuevo)

Wrapper único sobre `localStorage` con prefijo `finanzas.`. Reemplaza los
accesos directos dispersos en `shell.js`.

| Clave | Tipo | Default | Uso |
|-------|------|---------|-----|
| `modo` | `"real" \| "estimado"` | `"real"` | selector global (ya existía) |
| `tema` | `"auto" \| "claro" \| "oscuro"` | `"auto"` | tema (ya existía) |
| `ocultarTotal` | bool | `false` | oculta totales con `*****` |
| `incluirInactivos` | bool | `false` | incluir inactivos en cálculos (modo estimado) |
| `periodoTipo` | `"semana" \| "mes" \| "año"` | `"mes"` | persistir período elegido |
| `fechaRef` | `YYYY-MM-DD` | hoy | persistir período navegado |

API: `prefs.get(clave)`, `prefs.set(clave, valor)`. Sin suscripción (las
vistas se re-montan al cambiar, como ahora).

### `src/logic/dinero.js` (nuevo)

```js
export function formatoCLP(n) {
  return "$" + Math.round(Number(n) || 0).toLocaleString("es-CL");
}
export function parseCLP(str) {
  const limpio = String(str).replace(/[^\d]/g, "");
  return limpio ? Number(limpio) : NaN;
}
```

Reemplaza las funciones `fmt()` locales duplicadas en `movimientosView.js`,
`panelResumenView.js`, `resumenView.js`. El símbolo `$` queda embebido; ajustar
las plantillas que hoy hacen `` `$${fmt(x)}` ``.

---

## Sección 4 — Lógica de cálculo con `activo`

### `src/logic/totales.js`

Nueva función que aplica la regla de `debeParticiparEnCalculos` de la APK:

```js
export function filtrarParaCalculos(movimientos, { modo, incluirInactivos }) {
  return movimientos.filter((m) => {
    if (m.activo !== false) return true;          // activo (o sin dato) => cuenta
    if (modo === "estimado" && incluirInactivos) return true;
    return false;                                  // inactivo => no cuenta
  });
}
```

`calcularTotales` y `desglosarPorPago` no cambian: reciben la lista ya
filtrada. Los callers (`resumenView.js`, `panelResumenView.js`) filtran antes
de sumar; la **lista visible** de movimientos sigue mostrando todo (inactivos
incluidos, atenuados).

### Tests — `tests/totales.test.js`

Casos para `filtrarParaCalculos`:
- real + activo → incluido; real + inactivo → excluido.
- estimado + inactivo + `incluirInactivos:false` → excluido.
- estimado + inactivo + `incluirInactivos:true` → incluido.
- movimiento sin campo `activo` → incluido (tolerancia a datos viejos).

---

## Sección 5 — Iconos de categoría (Material Symbols subset)

### Paso offline único

Subsetear `Finanzas APK/app/src/main/res/font/material_symbols.ttf` (15 MB) a
`assets/fonts/material-symbols.woff2` (~25 KB) con `pyftsubset` (fonttools):

```
pyftsubset material_symbols.ttf \
  --output-file=assets/fonts/material-symbols.woff2 --flavor=woff2 \
  --layout-features='liga' --text-file=scripts/iconos-lista.txt
```

- `scripts/iconos-lista.txt`: ~70 nombres de ligadura, uno por línea (los ~20
  que usa la APK hoy + comunes de finanzas). Lista curada versionada.
- `scripts/subset-iconos.md`: documenta el comando y cómo regenerar.
- El `.woff2` resultante se commitea.

### `app.css`

```css
@font-face {
  font-family: "Material Symbols";
  src: url("assets/fonts/material-symbols.woff2") format("woff2");
  font-display: swap;
}
.ms-icono {
  font-family: "Material Symbols";
  font-weight: normal;
  font-feature-settings: "liga";
  -webkit-font-feature-settings: "liga";
  font-size: 1.25rem;
  line-height: 1;
  vertical-align: middle;
}
```

### `src/ui/iconoCategoria.js` (nuevo)

```js
export const LISTA_ICONOS = [ /* ~70 nombres de ligadura */ ];

// Nodo a mostrar para una categoría: emoji > icono MS > fallback por palabras.
export function nodoIconoCategoria(cat, fallbackTexto = "") { ... }
```

- Si `cat?.emoji` no vacío → `<span>{emoji}</span>`.
- Si `cat?.icono` → `<span class="ms-icono">{cat.icono}</span>`.
- Si no → cae a `iconoMovimiento()` de `iconosCategoria.js` (inferencia por
  palabras, se mantiene).

`movimientosView.fila()` y `panelResumenView` usan `nodoIconoCategoria(m.categoria,
m.nombre)` cuando hay categoría; conservan el color de `colorMovimiento(m)`.

---

## Sección 6 — Vista Categorías (4 grupos + icono/color/orden)

### `src/ui/categoriasView.js` (reescrito)

- Encabezado con **selector de modo** (Real / Estimado); arranca en
  `prefs.get("modo")`. Filtra qué categorías se listan.
- Dos secciones para el modo elegido: **Gastos** e **Ingresos**. Cada una:
  lista ordenada por `orden`, filas con icono/emoji + punto de color + nombre +
  botones `↑` `↓` (orden) + editar + borrar.
- Botón **"+ Nueva categoría"** → modal con `categoriaForm`.
- Borrar: `confirm` con el texto actual ("Los movimientos quedarán sin
  categoría.").
- `orden`: al crear, `orden = (max orden del grupo tipo+modo) + 1`. `↑`/`↓`
  intercambian `orden` con el vecino inmediato (2 × `actualizarCategoria`).

### `src/ui/categoriaForm.js` (nuevo)

Formulario reutilizable para alta y edición, dentro de `montarModal`:

- **nombre** (requerido).
- **tipo**: `gasto` / `ingreso`.
- **modo**: `real` / `estimado` (prefijado según el selector; editable).
- **color**: paleta base (~10 swatches) + `<input type="color">` para custom.
  Sin persistir colores custom (YAGNI para Fase 1).
- **icono**: grilla scrollable con `LISTA_ICONOS` renderizada con `.ms-icono` +
  campo de **emoji** (si se escribe un emoji, gana sobre el icono). Preview en
  vivo del icono/emoji con el color elegido.
- Guardar → `crearCategoria` / `actualizarCategoria`, recargar la vista.

---

## Sección 7 — Vista Movimientos (form, chips, lista, drill-down) + Resumen

### `src/ui/movimientoForm.js` (nuevo — extraído de `movimientosView.js`)

Formulario de **alta y edición** en `montarModal`. Reemplaza el `formularioNuevo`
embebido y el `prompt()` de edición de monto.

Campos:
- **nombre** — `<input>` con autocompletado de comercio.
- **monto** — texto; formatea en vivo a CLP entero (`formatoCLP`/`parseCLP`);
  se guarda como número entero.
- **tipo** — `gasto` / `ingreso`.
- **categoría** — chips rápidos + acceso a lista completa (ver abajo).
  **Obligatoria** (paridad APK; se elimina la opción "Sin categoría" del alta).
- **fecha** — `<input type="datetime-local">`, default ahora. Se envía como
  ISO (`toISOString()`).
- **detalle** — opcional.
- **activo** — checkbox (default marcado).
- Solo si `modo === "estimado"`: **pagado** (checkbox), **recurrente**
  (checkbox) + **frecuencia** (`<select>`: Mensual / Bimestral / Trimestral /
  Anual → se guardan `mensual|bimestral|trimestral|anual`).

Validación: nombre no vacío, monto entero > 0, categoría seleccionada. Botón
Guardar deshabilitado hasta cumplirse; en edición, deshabilitado hasta que haya
cambios (comparación con snapshot inicial, como la APK).

**Chips rápidos de categoría:**
- Fila de hasta 5 categorías del `tipo` + `modo` actuales, ordenadas por
  `usoCategorias(tipo, modo)` (RPC); las sin uso van al final por `orden`.
- Clic en chip → selecciona.
- Botón **"Todas"** → despliega la lista completa (mismas categorías,
  scrollable) dentro del modal.
- Opción **"+ Nueva"** → abre `categoriaForm` (modal encima); al guardar,
  vuelve y selecciona la nueva.

**Autocompletado de comercio:**
- Al tipear en nombre (debounce 250 ms, mínimo 2 caracteres):
  `sugerenciasComercio(tipo, modo, query)` → se poblan opciones en un
  `<datalist>` asociado al input.

### `src/ui/movimientosView.js`

- `fila(m)`:
  - Si `m.activo === false` → clase `fila--inactiva` (atenuada) + badge
    "Inactivo".
  - Botón editar → abre `movimientoForm` en modo edición (reemplaza el
    `prompt()` de monto).
  - Toggle `activo` inline (además del toggle `pagado` que ya existe en
    estimado).
- La lista muestra **todos** los movimientos. El badge/contador reflejan el
  total. Los **totales** (panel lateral) pasan por `filtrarParaCalculos`.
- `abrirModalNuevo()` usa `movimientoForm` en modo alta.
- `montarMovimientos` acepta parámetro opcional `categoriaInicial` para
  preseleccionar el filtro de categoría (drill-down desde el resumen).

### `src/ui/panelResumenView.js` y `src/ui/resumenView.js`

- Pasar `movimientos` por `filtrarParaCalculos({ modo, incluirInactivos })`
  antes de `calcularTotales` / `desglosarPorPago` / agrupar por categoría.
- **Ocultar total**: botón "ojo" junto al balance. Con `prefs.ocultarTotal`,
  los importes de balance/total del panel y del resumen se muestran `*****`
  (no cada fila; alcance igual a la APK). Toggle persiste en `prefs`.
- **Drill-down**: cada ítem de la leyenda de la dona
  (`panelResumenView.tarjetaDona`) es un `<button>` → callback `onCategoria(cat)`
  provisto por `movimientosView`, que re-monta la vista con
  `categoriaInicial = cat.id` (o navega vía shell a "Movimientos" con ese
  filtro).

### `src/ui/shell.js`

- Migrar lecturas/escrituras de `localStorage` a `prefs.js`.
- Persistir `periodoTipo` y `fechaRef` (hoy solo persisten `modo` y `tema`);
  al montar, restaurar desde `prefs`.
- Botón **"Incluir inactivos"** junto al selector de modo, visible solo cuando
  `modo === "estimado"`; setea `prefs.incluirInactivos` y re-pinta la vista.

---

## Testing

- `tests/totales.test.js` — extender con `filtrarParaCalculos` (casos de
  Sección 4).
- `tests/dinero.test.js` (nuevo) — `formatoCLP`, `parseCLP`.
- `tests/periodos.test.js` — sin cambios.
- No hay tests de DOM en el proyecto; se mantiene el criterio: lógica pura
  testeada, vistas verificadas manualmente. Verificación manual mínima antes de
  cerrar: alta/edición de movimiento (real y estimado), toggle activo e impacto
  en totales, "incluir inactivos", crear/editar categoría con icono MS y con
  emoji, chips rápidos, autocompletado, ocultar total, drill-down, persistencia
  de período tras recargar.

## Orden de implementación sugerido

1. Migración 002 + `schema.sql` + verificar en Supabase.
2. Capa de datos (`data/movimientos.js`, `data/categorias.js`, `data/rpc.js`).
3. `prefs.js` + `logic/dinero.js` + migrar `shell.js` a `prefs`.
4. `logic/totales.js` (`filtrarParaCalculos`) + tests.
5. Subset de la fuente + `app.css` + `iconoCategoria.js`.
6. `categoriaForm.js` + reescritura de `categoriasView.js`.
7. `movimientoForm.js` + cambios en `movimientosView.js`.
8. `panelResumenView.js` / `resumenView.js` (filtrado, ocultar total,
   drill-down) + toggle "incluir inactivos" en `shell.js`.
9. Verificación manual y ajustes de estilo (`app.css`).
