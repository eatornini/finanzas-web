# Paridad web ↔ APK — Fase 0+1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Llevar la app web a paridad funcional con la app Android en el flujo principal (movimientos, categorías, resumen), preparando el terreno para quedarse solo con la web.

**Architecture:** Se extiende el código actual (JS vanilla, ES modules, sin build; vistas que construyen DOM con el helper `el()`; datos vía `@supabase/supabase-js` cargado por ESM CDN). Se agregan módulos chicos y enfocados (`prefs.js`, `logic/dinero.js`, `ui/iconoCategoria.js`, `ui/categoriaForm.js`, `ui/movimientoForm.js`) y dos funciones RPC en Postgres para agregaciones. La base de datos gana columnas para los campos que hoy solo tiene la APK.

**Tech Stack:** JavaScript (ES2022, módulos nativos), Supabase (Postgres + PostgREST + Auth), Vitest para lógica pura, `pyftsubset` (fonttools) para subsetear la fuente de iconos.

**Spec:** `docs/superpowers/specs/2026-09-04-paridad-app-web-fase-0-1-design.md`

## Global Constraints

- **Sin build step.** El sitio se sirve estático desde GitHub Pages. No agregar bundlers, transpiladores ni dependencias de runtime que requieran build. Solo módulos ES nativos.
- **Sin dependencias nuevas de runtime.** `@supabase/supabase-js@2` se importa desde `https://esm.sh` (ya en `src/supabaseClient.js`). No agregar más imports de CDN en Fase 0+1.
- **Responder siempre en español** en textos de UI, comentarios y mensajes de commit.
- **Moneda:** CLP entero, locale `es-CL`, sin decimales. Nunca mostrar decimales en montos.
- **Zona horaria de negocio:** `America/Santiago`. El día calendario de un movimiento se deriva en Postgres (`fecha_local`), nunca en el cliente.
- **`fecha` de movimiento** se envía siempre como ISO con hora y offset (`new Date(x).toISOString()`).
- **Categoría obligatoria** al crear un movimiento (paridad APK). Editar/borrar categoría deja `categoria_id = null` en los movimientos (ya configurado con `ON DELETE SET NULL`); la UI de lista debe tolerar `categoria` nula.
- **Formato de código:** 2 espacios de indentación, `const`/`let`, comillas dobles, punto y coma. Igual que el código existente.
- **Commits:** formato `<tipo>: <descripción>` en español; terminar el cuerpo con `Claude-Session: https://claude.ai/code/session_014NkUCQXB5HB17FgskffTX5`.

---

## File Structure

**Nuevos:**
- `supabase/migrations/002-paridad-app.sql` — migración idempotente-ish (se corre una vez).
- `src/prefs.js` — acceso único a `localStorage` (claves `finanzas.*`).
- `src/logic/dinero.js` — `formatoCLP`, `parseCLP`.
- `src/data/rpc.js` — wrappers de las funciones RPC.
- `src/ui/iconoCategoria.js` — `nodoIconoCategoria(cat, fallback)`, `LISTA_ICONOS`.
- `src/ui/categoriaForm.js` — formulario modal de alta/edición de categoría.
- `src/ui/movimientoForm.js` — formulario modal de alta/edición de movimiento (extraído de `movimientosView.js`).
- `assets/fonts/material-symbols.woff2` — fuente subseteada (binario, se commitea).
- `scripts/iconos-lista.txt` — nombres de ligadura a incluir en el subset.
- `scripts/subset-iconos.md` — cómo regenerar la fuente.
- `tests/dinero.test.js` — tests de `logic/dinero.js`.

**Modificados:**
- `supabase/schema.sql` — reflejar columnas/funciones nuevas.
- `src/data/movimientos.js` — SELECT ampliado, filtro por `fecha_local`, campos nuevos en insert/update.
- `src/data/categorias.js` — `select` ordenado por `orden`; `crearCategoria` con `modo/emoji/icono/orden`.
- `src/logic/totales.js` — nueva `filtrarParaCalculos`.
- `tests/totales.test.js` — casos de `filtrarParaCalculos`.
- `src/ui/movimientosView.js` — usa `movimientoForm`, `iconoCategoria`, filtrado para totales, inactivos en la lista, drill-down.
- `src/ui/categoriasView.js` — reescrito: modo + grupos + orden + `categoriaForm`.
- `src/ui/panelResumenView.js` — filtrado, ocultar total, leyenda clickeable.
- `src/ui/resumenView.js` — filtrado, ocultar total.
- `src/ui/shell.js` — migra a `prefs.js`, persiste período/fecha, toggle "incluir inactivos".
- `app.css` — `@font-face` de Material Symbols, clase `.ms-icono`, estilos de las piezas nuevas (chips, fila inactiva, badge, grilla de iconos, botón ocultar total).

---

## Task 1: Migración de base de datos

**Files:**
- Create: `supabase/migrations/002-paridad-app.sql`
- Modify: `supabase/schema.sql`

**Interfaces:**
- Consumes: esquema actual (`categorias`, `movimientos` con RLS y policies `propios`).
- Produces: columnas `movimientos.activo|imagen|recurrente|frecuencia|fecha_local` (con `fecha` ahora `timestamptz`), `categorias.modo|emoji|icono|orden`; funciones `uso_categorias(text,text)` y `sugerencias_comercio(text,text,text)`.

- [ ] **Step 1: Escribir la migración**

Create `supabase/migrations/002-paridad-app.sql`:

```sql
-- 002 — Paridad con la app Android: hora en fecha, estado activo,
-- recurrencia, imagen; categorías por modo con icono y orden;
-- funciones de agregación para chips rápidos y autocompletado.
-- Correr una sola vez en el SQL Editor de Supabase.

-- ── movimientos ────────────────────────────────────────────────────────
-- fecha: date -> timestamptz. Las filas existentes se fijan a mediodía de
-- Santiago para que ningún desfase horario las cambie de día.
alter table movimientos
  alter column fecha type timestamptz
  using ((fecha::timestamp + time '12:00') at time zone 'America/Santiago');

alter table movimientos
  add column if not exists activo     boolean not null default true,
  add column if not exists imagen     text,
  add column if not exists recurrente boolean not null default false,
  add column if not exists frecuencia text
    check (frecuencia is null or frecuencia in
           ('mensual','bimestral','trimestral','anual'));

-- Día calendario de Santiago, derivado por trigger. El cliente nunca lo manda.
alter table movimientos add column if not exists fecha_local date;

create or replace function set_fecha_local() returns trigger
language plpgsql as $$
begin
  new.fecha_local := (new.fecha at time zone 'America/Santiago')::date;
  return new;
end $$;

drop trigger if exists trg_fecha_local on movimientos;
create trigger trg_fecha_local
  before insert or update of fecha on movimientos
  for each row execute function set_fecha_local();

update movimientos set fecha_local = (fecha at time zone 'America/Santiago')::date
  where fecha_local is null;
alter table movimientos alter column fecha_local set not null;

create index if not exists movimientos_user_modo_fechalocal_idx
  on movimientos (user_id, modo, fecha_local);

-- ── categorias ─────────────────────────────────────────────────────────
alter table categorias
  add column if not exists modo  text not null default 'real'
    check (modo in ('real','estimado')),
  add column if not exists emoji text,
  add column if not exists icono text,
  add column if not exists orden integer not null default 0;

-- ── funciones de agregación (respetan RLS: security invoker) ────────────
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

grant execute on function uso_categorias(text, text)             to anon, authenticated;
grant execute on function sugerencias_comercio(text, text, text) to anon, authenticated;
```

- [ ] **Step 2: Reflejar en `schema.sql`**

En `supabase/schema.sql`:
- En `create table categorias (...)` agregar, antes de `created_at`:
  ```sql
    modo text not null default 'real' check (modo in ('real','estimado')),
    emoji text,
    icono text,
    orden integer not null default 0,
  ```
- En `create table movimientos (...)`: cambiar `fecha date not null` por `fecha timestamptz not null`, y agregar antes de `created_at`:
  ```sql
    activo boolean not null default true,
    imagen text,
    recurrente boolean not null default false,
    frecuencia text check (frecuencia is null or frecuencia in
      ('mensual','bimestral','trimestral','anual')),
    fecha_local date not null default (now() at time zone 'America/Santiago')::date,
  ```
- Después de la tabla `movimientos`, reemplazar el índice `movimientos_user_modo_fecha_idx` por:
  ```sql
  create index movimientos_user_modo_fechalocal_idx
    on movimientos (user_id, modo, fecha_local);
  ```
- Copiar las definiciones de `set_fecha_local()` + trigger `trg_fecha_local` y de las dos funciones RPC con sus `grant execute`, al final del archivo (después de los `grant` existentes).

- [ ] **Step 3: Verificación**

No hay test automatizado (requiere la instancia de Supabase). El usuario debe:
1. Pegar `002-paridad-app.sql` en el SQL Editor de Supabase y ejecutarlo sin errores.
2. Verificar: `select column_name from information_schema.columns where table_name='movimientos';` incluye `activo, imagen, recurrente, frecuencia, fecha_local` y `fecha` es `timestamp with time zone`.
3. `select uso_categorias('gasto','real');` devuelve filas (o vacío) sin error de permisos.

Marcar este step como hecho solo cuando el usuario confirme que la migración corrió.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/002-paridad-app.sql supabase/schema.sql
git commit -m "feat(db): migración 002 — fecha con hora, activo, recurrencia, categorías por modo, RPCs"
```

---

## Task 2: `logic/dinero.js` — formato CLP

**Files:**
- Create: `src/logic/dinero.js`
- Test: `tests/dinero.test.js`

**Interfaces:**
- Produces:
  - `formatoCLP(n: number | string): string` — `"$" + entero con separador de miles es-CL`. `NaN`/`null` → `"$0"`.
  - `parseCLP(s: string): number` — quita todo lo no dígito y devuelve `Number`; string vacío → `NaN`.

- [ ] **Step 1: Escribir el test que falla**

Create `tests/dinero.test.js`:

```js
import { describe, it, expect } from "vitest";
import { formatoCLP, parseCLP } from "../src/logic/dinero.js";

describe("formatoCLP", () => {
  it("formatea enteros con separador de miles es-CL", () => {
    expect(formatoCLP(45000)).toBe("$45.000");
  });
  it("redondea a entero", () => {
    expect(formatoCLP(1234.6)).toBe("$1.235");
  });
  it("trata valores no numéricos como cero", () => {
    expect(formatoCLP(NaN)).toBe("$0");
    expect(formatoCLP(null)).toBe("$0");
    expect(formatoCLP(undefined)).toBe("$0");
  });
});

describe("parseCLP", () => {
  it("extrae el número de un texto con símbolo y puntos", () => {
    expect(parseCLP("$45.000")).toBe(45000);
  });
  it("ignora cualquier caracter no dígito", () => {
    expect(parseCLP("12a3,4 5")).toBe(12345);
  });
  it("devuelve NaN si no hay dígitos", () => {
    expect(Number.isNaN(parseCLP(""))).toBe(true);
    expect(Number.isNaN(parseCLP("abc"))).toBe(true);
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npm test -- dinero`
Expected: FAIL — `Cannot find module '../src/logic/dinero.js'`.

- [ ] **Step 3: Implementación mínima**

Create `src/logic/dinero.js`:

```js
// Formato de moneda: pesos chilenos, enteros, sin decimales.
export function formatoCLP(n) {
  const num = Math.round(Number(n));
  return "$" + (Number.isFinite(num) ? num : 0).toLocaleString("es-CL");
}

// Extrae el valor numérico de un texto escrito por el usuario (ej. "$45.000").
export function parseCLP(s) {
  const soloDigitos = String(s).replace(/[^\d]/g, "");
  return soloDigitos ? Number(soloDigitos) : NaN;
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npm test -- dinero`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/logic/dinero.js tests/dinero.test.js
git commit -m "feat: helper de formato CLP (formatoCLP/parseCLP)"
```

---

## Task 3: `logic/totales.js` — `filtrarParaCalculos`

**Files:**
- Modify: `src/logic/totales.js`
- Test: `tests/totales.test.js`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `filtrarParaCalculos(movimientos: Array, opciones: { modo: "real"|"estimado", incluirInactivos: boolean }): Array` — devuelve solo los movimientos que participan en los cálculos, según la regla de la APK:
  - `m.activo !== false` → siempre incluido (los datos viejos sin `activo` cuentan).
  - inactivo + `modo === "estimado"` + `incluirInactivos` → incluido.
  - resto → excluido.

- [ ] **Step 1: Escribir el test que falla**

Añadir a `tests/totales.test.js`:

```js
import { filtrarParaCalculos } from "../src/logic/totales.js";

describe("filtrarParaCalculos", () => {
  const base = { monto: 10, tipo: "gasto" };

  it("incluye activos y excluye inactivos en modo real", () => {
    const movs = [
      { ...base, activo: true },
      { ...base, activo: false },
    ];
    const r = filtrarParaCalculos(movs, { modo: "real", incluirInactivos: false });
    expect(r).toHaveLength(1);
    expect(r[0].activo).toBe(true);
  });

  it("en modo real ignora incluirInactivos", () => {
    const movs = [{ ...base, activo: false }];
    expect(filtrarParaCalculos(movs, { modo: "real", incluirInactivos: true })).toHaveLength(0);
  });

  it("en estimado excluye inactivos por defecto", () => {
    const movs = [{ ...base, activo: false }];
    expect(filtrarParaCalculos(movs, { modo: "estimado", incluirInactivos: false })).toHaveLength(0);
  });

  it("en estimado incluye inactivos si incluirInactivos es true", () => {
    const movs = [{ ...base, activo: false }];
    expect(filtrarParaCalculos(movs, { modo: "estimado", incluirInactivos: true })).toHaveLength(1);
  });

  it("trata un movimiento sin campo activo como activo", () => {
    const movs = [{ ...base }];
    expect(filtrarParaCalculos(movs, { modo: "real", incluirInactivos: false })).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npm test -- totales`
Expected: FAIL — `filtrarParaCalculos is not a function`.

- [ ] **Step 3: Implementación**

Añadir a `src/logic/totales.js` (arriba de `calcularTotales`):

```js
// Selecciona los movimientos que participan en los totales/resumen,
// replicando la regla de la app Android (debeParticiparEnCalculos):
// - un movimiento activo (o sin dato) siempre cuenta;
// - un inactivo solo cuenta en modo estimado con "incluir inactivos".
export function filtrarParaCalculos(movimientos, { modo, incluirInactivos }) {
  return movimientos.filter((m) => {
    if (m.activo !== false) return true;
    return modo === "estimado" && incluirInactivos === true;
  });
}
```

- [ ] **Step 4: Correr los tests y verlos pasar**

Run: `npm test`
Expected: PASS (todos: periodos + totales + dinero).

- [ ] **Step 5: Commit**

```bash
git add src/logic/totales.js tests/totales.test.js
git commit -m "feat: filtrarParaCalculos — inactivos fuera de totales (paridad APK)"
```

---

## Task 4: `src/prefs.js` — preferencias en localStorage

**Files:**
- Create: `src/prefs.js`
- Test: `tests/prefs.test.js`

**Interfaces:**
- Produces:
  - `prefs.get(clave)` — devuelve el valor tipado, o el default si no está / `localStorage` no disponible.
  - `prefs.set(clave, valor)` — persiste (ignora errores de `localStorage`).
  - Claves y defaults: `modo`→`"real"`, `tema`→`"auto"`, `ocultarTotal`→`false`, `incluirInactivos`→`false`, `periodoTipo`→`"mes"`, `fechaRef`→fecha de hoy `YYYY-MM-DD` (calculada al leer).

- [ ] **Step 1: Escribir el test que falla**

Create `tests/prefs.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from "vitest";

// Stub mínimo de localStorage para Node.
beforeEach(() => {
  const store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  });
});

const load = async () => (await import("../src/prefs.js?" + Math.random())).prefs;

describe("prefs", () => {
  it("devuelve defaults cuando no hay nada guardado", async () => {
    const prefs = await load();
    expect(prefs.get("modo")).toBe("real");
    expect(prefs.get("ocultarTotal")).toBe(false);
    expect(prefs.get("periodoTipo")).toBe("mes");
    expect(prefs.get("fechaRef")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("persiste y relee valores", async () => {
    const prefs = await load();
    prefs.set("modo", "estimado");
    prefs.set("ocultarTotal", true);
    expect(prefs.get("modo")).toBe("estimado");
    expect(prefs.get("ocultarTotal")).toBe(true);
  });

  it("no rompe si localStorage lanza", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("bloqueado"); },
      setItem: () => { throw new Error("bloqueado"); },
    });
    const prefs = await load();
    expect(prefs.get("tema")).toBe("auto");
    expect(() => prefs.set("tema", "oscuro")).not.toThrow();
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npm test -- prefs`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 3: Implementación**

Create `src/prefs.js`:

```js
// Único punto de acceso a localStorage. Claves namespaced "finanzas.".
const PREFIJO = "finanzas.";

function hoyISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// tipo: "bool" | "str"; default puede ser función (se evalúa al leer).
const DEFS = {
  modo: { tipo: "str", def: "real" },
  tema: { tipo: "str", def: "auto" },
  ocultarTotal: { tipo: "bool", def: false },
  incluirInactivos: { tipo: "bool", def: false },
  periodoTipo: { tipo: "str", def: "mes" },
  fechaRef: { tipo: "str", def: hoyISO },
};

function leerCrudo(clave) {
  try {
    return localStorage.getItem(PREFIJO + clave);
  } catch {
    return null;
  }
}

export const prefs = {
  get(clave) {
    const spec = DEFS[clave];
    if (!spec) throw new Error(`pref desconocida: ${clave}`);
    const crudo = leerCrudo(clave);
    if (crudo === null) return typeof spec.def === "function" ? spec.def() : spec.def;
    return spec.tipo === "bool" ? crudo === "true" : crudo;
  },
  set(clave, valor) {
    if (!DEFS[clave]) throw new Error(`pref desconocida: ${clave}`);
    try {
      localStorage.setItem(PREFIJO + clave, String(valor));
    } catch {
      /* almacenamiento no disponible: se ignora */
    }
  },
};
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npm test -- prefs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/prefs.js tests/prefs.test.js
git commit -m "feat: módulo prefs (localStorage namespaced con defaults)"
```

---

## Task 5: Capa de datos — movimientos, categorías, RPC

**Files:**
- Modify: `src/data/movimientos.js`
- Modify: `src/data/categorias.js`
- Create: `src/data/rpc.js`

**Interfaces:**
- Consumes: `supabase` (de `supabaseClient.js`), `verificar` (de `data/_helpers.js`), migración de Task 1 aplicada.
- Produces:
  - `listarMovimientos({ desde, hasta, modo })` — filtra por `fecha_local` entre `desde` y `hasta` (`YYYY-MM-DD`), trae `activo, recurrente, frecuencia` y `categoria:{ nombre, color, icono, emoji }`.
  - `crearMovimiento(datos)` / `actualizarMovimiento(id, cambios)` — aceptan `activo`, `recurrente`, `frecuencia`; `fecha` como ISO.
  - `listarCategorias()` — ordenado por `orden`, `nombre`; trae `modo, emoji, icono, orden`.
  - `crearCategoria({ nombre, tipo, modo, color, emoji, icono, orden })`.
  - `data/rpc.js`: `usoCategorias(tipo, modo) → [{ categoria_id, n }]`, `sugerenciasComercio(tipo, modo, query) → [{ nombre, n }]`.

- [ ] **Step 1: Actualizar `data/movimientos.js`**

Reemplazar el contenido de `src/data/movimientos.js` por:

```js
import { supabase } from "../supabaseClient.js";
import { verificar } from "./_helpers.js";

const SELECT =
  "id, nombre, monto, tipo, modo, pagado, activo, recurrente, frecuencia, " +
  "categoria_id, fecha, detalle, " +
  "categoria:categorias(nombre, color, icono, emoji)";

export async function listarMovimientos({ desde, hasta, modo }) {
  return verificar(
    await supabase
      .from("movimientos")
      .select(SELECT)
      .eq("modo", modo)
      .gte("fecha_local", desde)
      .lte("fecha_local", hasta)
      .order("fecha", { ascending: false })
  );
}

export async function crearMovimiento({
  nombre,
  monto,
  tipo,
  modo,
  pagado = false,
  activo = true,
  categoria_id,
  fecha,
  detalle,
  recurrente = false,
  frecuencia = null,
}) {
  return verificar(
    await supabase
      .from("movimientos")
      .insert({
        nombre, monto, tipo, modo, pagado, activo,
        categoria_id, fecha, detalle, recurrente, frecuencia,
      })
      .select(SELECT)
      .single()
  );
}

export async function actualizarMovimiento(id, cambios) {
  return verificar(
    await supabase.from("movimientos").update(cambios).eq("id", id).select(SELECT).single()
  );
}

export async function eliminarMovimiento(id) {
  return verificar(await supabase.from("movimientos").delete().eq("id", id));
}
```

- [ ] **Step 2: Actualizar `data/categorias.js`**

Reemplazar el contenido de `src/data/categorias.js` por:

```js
import { supabase } from "../supabaseClient.js";
import { verificar } from "./_helpers.js";

export async function listarCategorias() {
  return verificar(
    await supabase.from("categorias").select("*").order("orden").order("nombre")
  );
}

export async function crearCategoria({ nombre, tipo, modo, color, emoji = null, icono = null, orden = 0 }) {
  return verificar(
    await supabase
      .from("categorias")
      .insert({ nombre, tipo, modo, color, emoji, icono, orden })
      .select()
      .single()
  );
}

export async function actualizarCategoria(id, cambios) {
  return verificar(
    await supabase.from("categorias").update(cambios).eq("id", id).select().single()
  );
}

export async function eliminarCategoria(id) {
  return verificar(await supabase.from("categorias").delete().eq("id", id));
}
```

- [ ] **Step 3: Crear `data/rpc.js`**

Create `src/data/rpc.js`:

```js
import { supabase } from "../supabaseClient.js";
import { verificar } from "./_helpers.js";

// [{ categoria_id, n }] — conteo de movimientos por categoría para ese tipo+modo.
export async function usoCategorias(tipo, modo) {
  return verificar(await supabase.rpc("uso_categorias", { p_tipo: tipo, p_modo: modo }));
}

// [{ nombre, n }] — nombres previos más usados que empiezan con `query`.
export async function sugerenciasComercio(tipo, modo, query) {
  return verificar(
    await supabase.rpc("sugerencias_comercio", { p_tipo: tipo, p_modo: modo, p_query: query })
  );
}
```

- [ ] **Step 4: Verificación manual**

No hay test automatizado (red). Con la migración aplicada y `npx serve .` corriendo:
1. Iniciar sesión, ir a Movimientos: la lista carga sin error de consola.
2. En la consola del navegador: `import("/src/data/rpc.js").then(m => m.usoCategorias("gasto","real")).then(console.log)` → array (o vacío), sin error.

- [ ] **Step 5: Commit**

```bash
git add src/data/movimientos.js src/data/categorias.js src/data/rpc.js
git commit -m "feat(data): campos nuevos, filtro por fecha_local y wrappers RPC"
```

---

## Task 6: Fuente de iconos + `iconoCategoria.js`

**Files:**
- Create: `scripts/iconos-lista.txt`
- Create: `scripts/subset-iconos.md`
- Create: `assets/fonts/material-symbols.woff2` (binario, generado)
- Create: `src/ui/iconoCategoria.js`
- Modify: `app.css`

**Interfaces:**
- Consumes: `Finanzas APK/app/src/main/res/font/material_symbols.ttf` (fuente completa, referencia).
- Produces:
  - `LISTA_ICONOS: string[]` — nombres de ligadura disponibles en el picker.
  - `nodoIconoCategoria(cat, fallbackTexto = "") : Node` — `<span>` con emoji, o `<span class="ms-icono">` con la ligadura, o el SVG de `iconoMovimiento()` como fallback.

- [ ] **Step 1: Lista de iconos**

Create `scripts/iconos-lista.txt` (un nombre por línea):

```
category
restaurant
local_grocery_store
directions_bus
directions_car
local_gas_station
home
bolt
water_drop
wifi
phone_iphone
health_and_safety
local_hospital
medication
school
menu_book
movie
sports_esports
music_note
checkroom
fitness_center
self_improvement
content_cut
pets
child_care
card_giftcard
celebration
flight
hotel
beach_access
savings
account_balance
credit_card
payments
receipt_long
request_quote
work
business_center
sell
trending_up
attach_money
volunteer_activism
favorite
group
sports_bar
local_cafe
bakery_dining
lunch_dining
local_pizza
shopping_bag
shopping_cart
storefront
build
handyman
cleaning_services
local_laundry_service
park
directions_bike
train
local_taxi
ev_station
smartphone
router
tv
computer
subscriptions
newspaper
church
school_bell
```

(Si algún nombre no existe en la fuente, `pyftsubset` lo ignora; revisar el log.)

- [ ] **Step 2: Documentar y generar la fuente**

Create `scripts/subset-iconos.md`:

```markdown
# Regenerar la fuente de iconos

`assets/fonts/material-symbols.woff2` es un subset de la fuente Material Symbols
que trae la app Android (`Finanzas APK/app/src/main/res/font/material_symbols.ttf`,
~15 MB) reducido a los iconos de `scripts/iconos-lista.txt`.

Requiere `fonttools`:

    pip install fonttools brotli

Generar:

    pyftsubset "Finanzas APK/app/src/main/res/font/material_symbols.ttf" \
      --output-file=assets/fonts/material-symbols.woff2 \
      --flavor=woff2 \
      --layout-features='liga,dlig,calt' \
      --text-file=scripts/iconos-lista.txt

Verificar que el `.woff2` pese < 60 KB y que las ligaduras funcionen
(abrir la app, crear categoría, elegir un icono de la grilla).
```

Ejecutar ese comando. Si `pip`/`pyftsubset` no está disponible en el entorno,
instalar `fonttools` con `pip install fonttools brotli` primero. Confirmar el
tamaño del archivo generado (`ls -la assets/fonts/`).

- [ ] **Step 3: `@font-face` y clase en `app.css`**

Añadir al principio de `app.css` (después de cualquier `@import`, antes de `:root`):

```css
@font-face {
  font-family: "Material Symbols";
  src: url("assets/fonts/material-symbols.woff2") format("woff2");
  font-display: swap;
}

.ms-icono {
  font-family: "Material Symbols";
  font-weight: normal;
  font-style: normal;
  font-feature-settings: "liga";
  -webkit-font-feature-settings: "liga";
  font-size: 1.25rem;
  line-height: 1;
  letter-spacing: normal;
  white-space: nowrap;
  vertical-align: middle;
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 4: `iconoCategoria.js`**

Create `src/ui/iconoCategoria.js`:

```js
import { el } from "./dom.js";
import { iconoMovimiento } from "./iconosCategoria.js";

export const LISTA_ICONOS = [
  "category", "restaurant", "local_grocery_store", "directions_bus", "directions_car",
  "local_gas_station", "home", "bolt", "water_drop", "wifi", "phone_iphone",
  "health_and_safety", "local_hospital", "medication", "school", "menu_book", "movie",
  "sports_esports", "music_note", "checkroom", "fitness_center", "self_improvement",
  "content_cut", "pets", "child_care", "card_giftcard", "celebration", "flight", "hotel",
  "beach_access", "savings", "account_balance", "credit_card", "payments", "receipt_long",
  "request_quote", "work", "business_center", "sell", "trending_up", "attach_money",
  "volunteer_activism", "favorite", "group", "sports_bar", "local_cafe", "bakery_dining",
  "lunch_dining", "local_pizza", "shopping_bag", "shopping_cart", "storefront", "build",
  "handyman", "cleaning_services", "local_laundry_service", "park", "directions_bike",
  "train", "local_taxi", "ev_station", "smartphone", "router", "tv", "computer",
  "subscriptions", "newspaper",
];

// Nodo a mostrar para la categoría de un movimiento (o para una categoría suelta).
// Prioridad: emoji explícito > icono Material Symbols > inferencia por palabras.
export function nodoIconoCategoria(cat, fallbackTexto = "") {
  if (cat && cat.emoji) return el("span", { class: "cat-emoji", text: cat.emoji });
  if (cat && cat.icono) return el("span", { class: "ms-icono", text: cat.icono });
  const nombreCat = cat && cat.nombre ? cat.nombre : "";
  return iconoMovimiento({ nombre: fallbackTexto, categoria: nombreCat ? { nombre: nombreCat } : null });
}
```

- [ ] **Step 5: Verificación**

Run: `npm test` (no debe romper nada; `iconoCategoria.js` no tiene test propio).
Manual: en un HTML de prueba o en la consola, `document.body.append((await import('/src/ui/iconoCategoria.js')).nodoIconoCategoria({icono:'restaurant'}))` muestra el glifo del tenedor.

- [ ] **Step 6: Commit**

```bash
git add scripts/iconos-lista.txt scripts/subset-iconos.md assets/fonts/material-symbols.woff2 src/ui/iconoCategoria.js app.css
git commit -m "feat(ui): fuente Material Symbols subseteada + nodoIconoCategoria"
```

---

## Task 7: `categoriaForm.js` — formulario de categoría

**Files:**
- Create: `src/ui/categoriaForm.js`
- Modify: `app.css` (estilos de la grilla de iconos y swatches)

**Interfaces:**
- Consumes: `montarModal` (`ui/modal.js`), `crearCategoria`/`actualizarCategoria` (`data/categorias.js`), `LISTA_ICONOS` (`ui/iconoCategoria.js`), `el`/`limpiar` (`ui/dom.js`).
- Produces:
  - `abrirCategoriaForm({ categoria = null, modoInicial, tipoInicial = "gasto", onGuardado }) : void` — abre un modal. `categoria` no nula = edición. `onGuardado(categoriaGuardada)` se llama al guardar OK; el modal se cierra solo.

- [ ] **Step 1: Implementación**

Create `src/ui/categoriaForm.js`:

```js
import { el, limpiar } from "./dom.js";
import { montarModal } from "./modal.js";
import { crearCategoria, actualizarCategoria } from "../data/categorias.js";
import { LISTA_ICONOS } from "./iconoCategoria.js";

const PALETA = [
  "#c0392b", "#e67e22", "#f1c40f", "#2ecc71", "#1abc9c", "#3498db",
  "#2980b9", "#9b59b6", "#8e44ad", "#e84393", "#7f8c8d", "#34495e",
];

export function abrirCategoriaForm({ categoria = null, modoInicial = "real", tipoInicial = "gasto", onGuardado }) {
  const edicion = Boolean(categoria);
  const estado = {
    color: categoria?.color || PALETA[3],
    emoji: categoria?.emoji || "",
    icono: categoria?.icono || (categoria?.emoji ? "" : "category"),
  };

  const error = el("p", { class: "error", role: "alert" });
  const nombre = el("input", { id: "cat-nombre", required: "true", value: categoria?.nombre || "" });
  const tipo = el("select", { id: "cat-tipo" }, [
    el("option", { value: "gasto", text: "Gasto" }),
    el("option", { value: "ingreso", text: "Ingreso" }),
  ]);
  tipo.value = categoria?.tipo || tipoInicial;
  const modo = el("select", { id: "cat-modo" }, [
    el("option", { value: "real", text: "Real" }),
    el("option", { value: "estimado", text: "Estimado" }),
  ]);
  modo.value = categoria?.modo || modoInicial;

  const preview = el("span", { class: "cat-preview" });
  function pintarPreview() {
    limpiar(preview);
    preview.style.background = estado.color;
    if (estado.emoji) preview.append(el("span", { class: "cat-emoji", text: estado.emoji }));
    else preview.append(el("span", { class: "ms-icono", text: estado.icono || "category" }));
  }

  const swatches = el(
    "div",
    { class: "cat-swatches" },
    PALETA.map((c) => {
      const b = el("button", { type: "button", class: "cat-swatch", "aria-label": c });
      b.style.background = c;
      b.addEventListener("click", () => {
        estado.color = c;
        colorInput.value = c;
        pintarPreview();
      });
      return b;
    })
  );
  const colorInput = el("input", { type: "color", value: estado.color });
  colorInput.addEventListener("input", () => {
    estado.color = colorInput.value;
    pintarPreview();
  });

  const emojiInput = el("input", {
    class: "cat-emoji-input",
    maxlength: "2",
    placeholder: "😀",
    value: estado.emoji,
  });
  emojiInput.addEventListener("input", () => {
    estado.emoji = emojiInput.value.trim();
    if (estado.emoji) estado.icono = "";
    pintarPreview();
    sincronizarGrilla();
  });

  const grilla = el(
    "div",
    { class: "cat-iconos-grilla" },
    LISTA_ICONOS.map((nombreIcono) => {
      const b = el("button", { type: "button", class: "cat-icono-op", title: nombreIcono }, [
        el("span", { class: "ms-icono", text: nombreIcono }),
      ]);
      b.dataset.icono = nombreIcono;
      b.addEventListener("click", () => {
        estado.icono = nombreIcono;
        estado.emoji = "";
        emojiInput.value = "";
        pintarPreview();
        sincronizarGrilla();
      });
      return b;
    })
  );
  function sincronizarGrilla() {
    for (const b of grilla.children) {
      b.classList.toggle("activo", !estado.emoji && b.dataset.icono === estado.icono);
    }
  }

  const btnGuardar = el("button", { type: "submit", class: "boton--primario", text: edicion ? "Guardar" : "Crear categoría" });

  const form = el(
    "form",
    {
      class: "form-mov",
      onSubmit: async (ev) => {
        ev.preventDefault();
        error.textContent = "";
        if (!nombre.value.trim()) {
          error.textContent = "El nombre es obligatorio.";
          return;
        }
        btnGuardar.disabled = true;
        const datos = {
          nombre: nombre.value.trim(),
          tipo: tipo.value,
          modo: modo.value,
          color: estado.color,
          emoji: estado.emoji || null,
          icono: estado.emoji ? null : estado.icono || null,
        };
        try {
          const guardada = edicion
            ? await actualizarCategoria(categoria.id, datos)
            : await crearCategoria({ ...datos, orden: categoria?.orden ?? 0 });
          cerrar();
          onGuardado?.(guardada);
        } catch (e) {
          error.textContent = "No se pudo guardar la categoría.";
          btnGuardar.disabled = false;
        }
      },
    },
    [
      el("div", { class: "form-grid" }, [
        el("label", { class: "campo", for: "cat-nombre", text: "Nombre" }, [nombre]),
        el("label", { class: "campo", for: "cat-tipo", text: "Tipo" }, [tipo]),
        el("label", { class: "campo", for: "cat-modo", text: "Modo" }, [modo]),
        el("div", { class: "campo" }, [
          el("span", { class: "campo-etiqueta", text: "Color" }),
          swatches,
          colorInput,
        ]),
        el("div", { class: "campo" }, [
          el("span", { class: "campo-etiqueta", text: "Icono o emoji" }),
          el("div", { class: "cat-icono-fila" }, [preview, emojiInput]),
          grilla,
        ]),
      ]),
      error,
      el("div", { class: "modal-acciones" }, [
        el("button", { type: "button", text: "Cancelar", onClick: () => cerrar() }),
        btnGuardar,
      ]),
    ]
  );

  const { cerrar } = montarModal({ titulo: edicion ? "Editar categoría" : "Nueva categoría", contenido: form });
  pintarPreview();
  sincronizarGrilla();
}
```

- [ ] **Step 2: Estilos**

Añadir a `app.css` (sección de formularios/modal):

```css
.cat-preview { display: inline-flex; align-items: center; justify-content: center;
  width: 40px; height: 40px; border-radius: 10px; color: #fff; }
.cat-preview .cat-emoji { font-size: 20px; }
.cat-swatches { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
.cat-swatch { width: 24px; height: 24px; border-radius: 6px; border: 2px solid transparent; cursor: pointer; }
.cat-icono-fila { display: flex; align-items: center; gap: 8px; margin: 6px 0; }
.cat-emoji-input { width: 3rem; text-align: center; }
.cat-iconos-grilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
  gap: 4px; max-height: 180px; overflow-y: auto; padding: 4px;
  border: 1px solid var(--borde, #ddd); border-radius: 8px; }
.cat-icono-op { display: flex; align-items: center; justify-content: center;
  aspect-ratio: 1; border: 1px solid transparent; border-radius: 6px;
  background: transparent; cursor: pointer; color: var(--texto, #333); }
.cat-icono-op.activo { border-color: currentColor; background: color-mix(in srgb, currentColor 12%, transparent); }
```

(Si los nombres de variables CSS `--borde`/`--texto` no existen en `app.css`, usar los tokens reales del proyecto; revisar `:root` en `app.css`.)

- [ ] **Step 3: Verificación manual**

Se prueba junto con Task 8 (no tiene entrada propia todavía).

- [ ] **Step 4: Commit**

```bash
git add src/ui/categoriaForm.js app.css
git commit -m "feat(ui): formulario modal de categoría con color, icono MS y emoji"
```

---

## Task 8: `categoriasView.js` — reescritura (modo + grupos + orden)

**Files:**
- Modify: `src/ui/categoriasView.js`
- Modify: `app.css` (estilos de las secciones y filas de categoría)

**Interfaces:**
- Consumes: `listarCategorias`/`actualizarCategoria`/`eliminarCategoria` (`data/categorias.js`), `abrirCategoriaForm` (`ui/categoriaForm.js`), `nodoIconoCategoria` (`ui/iconoCategoria.js`), `prefs` (`src/prefs.js`), `lapiz`/`basura`/`flechaArribaCirculo`/`flechaAbajoCirculo` (`ui/iconos.js`).
- Produces: `montarCategorias(contenedor)` (misma firma que hoy; la usa `shell.js`).

- [ ] **Step 1: Reescribir la vista**

Reemplazar `src/ui/categoriasView.js` por:

```js
import { el, limpiar } from "./dom.js";
import { listarCategorias, actualizarCategoria, eliminarCategoria } from "../data/categorias.js";
import { abrirCategoriaForm } from "./categoriaForm.js";
import { nodoIconoCategoria } from "./iconoCategoria.js";
import { prefs } from "../prefs.js";
import { lapiz, basura, flechaArribaCirculo, flechaAbajoCirculo } from "./iconos.js";

export function montarCategorias(contenedor) {
  limpiar(contenedor);
  let modo = prefs.get("modo");
  let todas = [];

  const error = el("p", { class: "error", role: "alert" });
  const cuerpo = el("div", { class: "categorias-cuerpo" });

  const btnModo = {};
  for (const m of ["real", "estimado"]) {
    btnModo[m] = el("button", {
      text: m === "real" ? "Real" : "Estimado",
      class: modo === m ? "activo" : "",
      onClick: () => { modo = m; sincronizarModo(); pintar(); },
    });
  }
  function sincronizarModo() {
    for (const m of ["real", "estimado"]) btnModo[m].classList.toggle("activo", modo === m);
  }

  const btnNueva = el("button", {
    class: "boton--primario",
    text: "+ Nueva categoría",
    onClick: () =>
      abrirCategoriaForm({
        modoInicial: modo,
        tipoInicial: "gasto",
        onGuardado: recargar,
      }),
  });

  contenedor.append(
    el("div", { class: "categorias-cabecera" }, [
      el("div", { class: "selector-modo" }, [btnModo.real, btnModo.estimado]),
      btnNueva,
    ]),
    error,
    cuerpo
  );

  recargar();

  async function recargar() {
    error.textContent = "";
    try {
      todas = await listarCategorias();
      pintar();
    } catch (e) {
      error.textContent = "No se pudieron cargar las categorías.";
    }
  }

  function pintar() {
    limpiar(cuerpo);
    for (const tipo of ["gasto", "ingreso"]) {
      const delGrupo = todas
        .filter((c) => c.modo === modo && c.tipo === tipo)
        .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
      cuerpo.append(
        el("section", { class: "categorias-grupo" }, [
          el("h3", { text: tipo === "gasto" ? "Gastos" : "Ingresos" }),
          delGrupo.length
            ? el("div", { class: "lista" }, delGrupo.map((c, i) => fila(c, delGrupo, i)))
            : el("p", { class: "vacio", text: "Sin categorías en este grupo." }),
        ])
      );
    }
  }

  function fila(c, grupo, indice) {
    const icono = el("span", { class: "cat-fila-icono" }, [nodoIconoCategoria(c)]);
    if (c.color) icono.style.color = c.color;

    const subir = botonIcono("Subir", flechaArribaCirculo, indice === 0, () =>
      intercambiarOrden(c, grupo[indice - 1])
    );
    const bajar = botonIcono("Bajar", flechaAbajoCirculo, indice === grupo.length - 1, () =>
      intercambiarOrden(c, grupo[indice + 1])
    );
    const editar = botonIcono("Editar", lapiz, false, () =>
      abrirCategoriaForm({ categoria: c, modoInicial: modo, onGuardado: recargar })
    );
    const borrar = botonIcono("Borrar", basura, false, async () => {
      if (!confirm(`¿Borrar "${c.nombre}"? Los movimientos quedarán sin categoría.`)) return;
      try {
        await eliminarCategoria(c.id);
        await recargar();
      } catch (e) {
        error.textContent = "No se pudo borrar la categoría.";
      }
    });

    return el("div", { class: "fila fila--categoria" }, [
      icono,
      el("span", { class: "nombre", text: c.nombre }),
      el("div", { class: "acciones" }, [subir, bajar, editar, borrar]),
    ]);
  }

  function botonIcono(label, fabricaIcono, deshabilitado, onClick) {
    const b = el("button", { class: "boton--icono", "aria-label": label, title: label, onClick }, [
      fabricaIcono(),
    ]);
    if (deshabilitado) b.disabled = true;
    return b;
  }

  async function intercambiarOrden(a, b) {
    if (!a || !b) return;
    try {
      await actualizarCategoria(a.id, { orden: b.orden });
      await actualizarCategoria(b.id, { orden: a.orden });
      await recargar();
    } catch (e) {
      error.textContent = "No se pudo reordenar.";
    }
  }
}
```

Nota: si dos categorías del grupo tienen el mismo `orden` (p. ej. todas en 0
porque nunca se reordenaron), `intercambiarOrden` no las mueve. Para evitarlo,
en `recargar` normalizar una sola vez: si el grupo tiene órdenes duplicados,
reasignar `orden = índice` con `actualizarCategoria` antes de pintar. Implementar
esa normalización dentro de `pintar` la primera vez que se detecta el caso
(guardar un flag `normalizado` por grupo para no repetir).

- [ ] **Step 2: Estilos**

Añadir a `app.css`:

```css
.categorias-cabecera { display: flex; justify-content: space-between; align-items: center;
  gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.categorias-grupo { margin-bottom: 20px; }
.categorias-grupo h3 { margin: 0 0 8px; }
.fila--categoria .cat-fila-icono { display: inline-flex; width: 28px; justify-content: center; }
.fila--categoria .cat-fila-icono .cat-emoji { font-size: 18px; }
```

- [ ] **Step 3: Verificación manual**

Con `npx serve .`:
1. Ir a Categorías. Cambiar entre Real/Estimado: la lista cambia.
2. "+ Nueva categoría": crear una de Gasto/Estimado con un icono de la grilla → aparece en el grupo Gastos del modo Estimado.
3. Crear otra con emoji → se ve el emoji.
4. ↑/↓ reordena. Editar cambia icono/color. Borrar pide confirmación.

- [ ] **Step 4: Commit**

```bash
git add src/ui/categoriasView.js app.css
git commit -m "feat(ui): categorías por modo con grupos, orden e icono/emoji"
```

---

## Task 9: `movimientoForm.js` — formulario de movimiento

**Files:**
- Create: `src/ui/movimientoForm.js`
- Modify: `app.css` (chips, campos del form)

**Interfaces:**
- Consumes: `montarModal` (`ui/modal.js`), `crearMovimiento`/`actualizarMovimiento` (`data/movimientos.js`), `usoCategorias`/`sugerenciasComercio` (`data/rpc.js`), `abrirCategoriaForm` (`ui/categoriaForm.js`), `formatoCLP`/`parseCLP` (`logic/dinero.js`), `nodoIconoCategoria` (`ui/iconoCategoria.js`), `el`/`limpiar` (`ui/dom.js`).
- Produces:
  - `abrirMovimientoForm({ modo, categorias, movimiento = null, onGuardado }) : void` — abre el modal de alta (`movimiento` nulo) o edición. `categorias` es la lista ya cargada (array de `{ id, nombre, tipo, modo, color, icono, emoji, orden }`). `onGuardado()` se llama al guardar OK; el modal se cierra solo.

- [ ] **Step 1: Implementación**

Create `src/ui/movimientoForm.js`:

```js
import { el, limpiar } from "./dom.js";
import { montarModal } from "./modal.js";
import { crearMovimiento, actualizarMovimiento } from "../data/movimientos.js";
import { usoCategorias, sugerenciasComercio } from "../data/rpc.js";
import { abrirCategoriaForm } from "./categoriaForm.js";
import { formatoCLP, parseCLP } from "../logic/dinero.js";
import { nodoIconoCategoria } from "./iconoCategoria.js";

const FRECUENCIAS = [
  ["mensual", "Mensual"],
  ["bimestral", "Bimestral"],
  ["trimestral", "Trimestral"],
  ["anual", "Anual"],
];

// ISO (con hora) -> valor para <input type="datetime-local"> en hora local.
function isoAInputLocal(iso) {
  const d = iso ? new Date(iso) : new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function abrirMovimientoForm({ modo, categorias, movimiento = null, onGuardado }) {
  const edicion = Boolean(movimiento);
  const esEstimado = modo === "estimado";

  let tipoActual = movimiento?.tipo || "gasto";
  let categoriaId = movimiento?.categoria_id || null;

  const error = el("p", { class: "error", role: "alert" });

  const nombre = el("input", { id: "mov-nombre", required: "true", autocomplete: "off",
    value: movimiento?.nombre || "" });
  const sugerencias = el("datalist", { id: "mov-nombre-sugerencias" });
  nombre.setAttribute("list", "mov-nombre-sugerencias");

  const monto = el("input", { id: "mov-monto", inputmode: "numeric",
    value: movimiento ? formatoCLP(movimiento.monto) : "" });
  monto.addEventListener("input", () => {
    const n = parseCLP(monto.value);
    monto.value = Number.isFinite(n) ? formatoCLP(n) : "";
    actualizarBotones();
  });

  const tipo = el("select", { id: "mov-tipo" }, [
    el("option", { value: "gasto", text: "Gasto" }),
    el("option", { value: "ingreso", text: "Ingreso" }),
  ]);
  tipo.value = tipoActual;
  tipo.addEventListener("change", () => {
    tipoActual = tipo.value;
    categoriaId = null;
    pintarChips();
    actualizarBotones();
  });

  const fecha = el("input", { id: "mov-fecha", type: "datetime-local",
    value: isoAInputLocal(movimiento?.fecha) });
  const detalle = el("input", { id: "mov-detalle", value: movimiento?.detalle || "" });

  const activo = el("input", { id: "mov-activo", type: "checkbox" });
  activo.checked = movimiento ? movimiento.activo !== false : true;

  // Campos solo-estimado
  const pagado = el("input", { id: "mov-pagado", type: "checkbox" });
  pagado.checked = Boolean(movimiento?.pagado);
  const recurrente = el("input", { id: "mov-recurrente", type: "checkbox" });
  recurrente.checked = Boolean(movimiento?.recurrente);
  const frecuencia = el("select", { id: "mov-frecuencia" },
    FRECUENCIAS.map(([v, t]) => el("option", { value: v, text: t })));
  frecuencia.value = movimiento?.frecuencia || "mensual";
  frecuencia.disabled = !recurrente.checked;
  recurrente.addEventListener("change", () => { frecuencia.disabled = !recurrente.checked; });

  const chips = el("div", { class: "mov-chips" });
  let usoPorCategoria = {};

  function categoriasDelTipo() {
    return categorias
      .filter((c) => c.tipo === tipoActual && c.modo === modo)
      .sort((a, b) => (usoPorCategoria[b.id] || 0) - (usoPorCategoria[a.id] || 0)
        || a.orden - b.orden || a.nombre.localeCompare(b.nombre));
  }

  function pintarChips() {
    limpiar(chips);
    const lista = categoriasDelTipo();
    for (const c of lista.slice(0, 5)) chips.append(chip(c));
    chips.append(
      el("button", { type: "button", class: "mov-chip mov-chip--mas", text: "Todas ▾",
        onClick: () => abrirListaCompleta(lista) })
    );
    if (categoriaId && !lista.slice(0, 5).some((c) => c.id === categoriaId)) {
      const sel = lista.find((c) => c.id === categoriaId);
      if (sel) chips.insertBefore(chip(sel), chips.firstChild);
    }
    marcarChipActivo();
  }

  function chip(c) {
    const b = el("button", { type: "button", class: "mov-chip" }, [
      nodoIconoCategoria(c), el("span", { text: c.nombre }),
    ]);
    b.dataset.id = c.id;
    if (c.color) b.style.setProperty("--chip-color", c.color);
    b.addEventListener("click", () => {
      categoriaId = c.id;
      marcarChipActivo();
      actualizarBotones();
    });
    return b;
  }

  function marcarChipActivo() {
    for (const b of chips.children) {
      if (b.dataset.id) b.classList.toggle("activo", b.dataset.id === categoriaId);
    }
  }

  function abrirListaCompleta(lista) {
    const cont = el("div", { class: "mov-lista-cats" });
    for (const c of lista) {
      const b = el("button", { type: "button", class: "mov-chip" }, [
        nodoIconoCategoria(c), el("span", { text: c.nombre }),
      ]);
      b.addEventListener("click", () => { categoriaId = c.id; cerrarLista(); pintarChips(); actualizarBotones(); });
      cont.append(b);
    }
    cont.append(
      el("button", { type: "button", class: "mov-chip mov-chip--nueva", text: "+ Nueva categoría",
        onClick: () => {
          cerrarLista();
          abrirCategoriaForm({
            modoInicial: modo, tipoInicial: tipoActual,
            onGuardado: (nueva) => { categorias.push(nueva); categoriaId = nueva.id; pintarChips(); actualizarBotones(); },
          });
        } })
    );
    const { cerrar: cerrarLista } = montarModal({ titulo: "Elegir categoría", contenido: cont });
  }

  // Autocompletado de comercio (debounce simple).
  let debounce;
  nombre.addEventListener("input", () => {
    actualizarBotones();
    clearTimeout(debounce);
    const q = nombre.value.trim();
    if (q.length < 2) return;
    debounce = setTimeout(async () => {
      try {
        const res = await sugerenciasComercio(tipoActual, modo, q);
        limpiar(sugerencias);
        for (const s of res) sugerencias.append(el("option", { value: s.nombre }));
      } catch { /* sin sugerencias */ }
    }, 250);
  });

  const btnGuardar = el("button", { type: "submit", class: "boton--primario",
    text: edicion ? "Guardar" : "Agregar movimiento" });
  const btnCancelar = el("button", { type: "button", text: "Cancelar", onClick: () => cerrar() });

  function formValido() {
    return nombre.value.trim() && parseCLP(monto.value) > 0 && categoriaId;
  }
  function huboCambios() {
    if (!edicion) return true;
    return (
      nombre.value.trim() !== movimiento.nombre ||
      parseCLP(monto.value) !== Math.round(movimiento.monto) ||
      tipo.value !== movimiento.tipo ||
      categoriaId !== (movimiento.categoria_id || null) ||
      new Date(fecha.value).toISOString() !== new Date(movimiento.fecha).toISOString() ||
      (detalle.value.trim() || null) !== (movimiento.detalle || null) ||
      activo.checked !== (movimiento.activo !== false) ||
      (esEstimado && pagado.checked !== Boolean(movimiento.pagado)) ||
      (esEstimado && recurrente.checked !== Boolean(movimiento.recurrente)) ||
      (esEstimado && recurrente.checked && frecuencia.value !== (movimiento.frecuencia || "mensual"))
    );
  }
  function actualizarBotones() {
    btnGuardar.disabled = !(formValido() && huboCambios());
  }

  function campo(etiqueta, input) {
    return el("label", { class: "campo", for: input.id, text: etiqueta }, [input]);
  }

  const filas = [
    campo("Nombre", nombre), sugerencias,
    campo("Monto", monto),
    campo("Tipo", tipo),
    el("div", { class: "campo" }, [el("span", { class: "campo-etiqueta", text: "Categoría" }), chips]),
    campo("Fecha y hora", fecha),
    campo("Detalle (opcional)", detalle),
    el("label", { class: "campo campo--check", for: "mov-activo" }, [activo, "Activo"]),
  ];
  if (esEstimado) {
    filas.push(
      el("label", { class: "campo campo--check", for: "mov-pagado" }, [pagado, "Pagado"]),
      el("label", { class: "campo campo--check", for: "mov-recurrente" }, [recurrente, "Recurrente"]),
      campo("Frecuencia", frecuencia)
    );
  }

  const form = el(
    "form",
    {
      class: "form-mov",
      onSubmit: async (ev) => {
        ev.preventDefault();
        error.textContent = "";
        if (!formValido()) {
          error.textContent = "Completá nombre, monto mayor a 0 y categoría.";
          return;
        }
        btnGuardar.disabled = true;
        const datos = {
          nombre: nombre.value.trim(),
          monto: parseCLP(monto.value),
          tipo: tipo.value,
          modo,
          categoria_id: categoriaId,
          fecha: new Date(fecha.value).toISOString(),
          detalle: detalle.value.trim() || null,
          activo: activo.checked,
          pagado: esEstimado ? pagado.checked : false,
          recurrente: esEstimado ? recurrente.checked : false,
          frecuencia: esEstimado && recurrente.checked ? frecuencia.value : null,
        };
        try {
          if (edicion) await actualizarMovimiento(movimiento.id, datos);
          else await crearMovimiento(datos);
          cerrar();
          onGuardado?.();
        } catch (e) {
          error.textContent = "No se pudo guardar. Intentá de nuevo.";
          btnGuardar.disabled = false;
        }
      },
    },
    [
      el("div", { class: "form-grid" }, filas),
      error,
      el("div", { class: "modal-acciones" }, [btnCancelar, btnGuardar]),
    ]
  );

  const { cerrar } = montarModal({
    titulo: edicion ? "Editar movimiento" : "Agregar movimiento",
    contenido: form,
  });

  // Carga de uso para ordenar chips.
  usoCategorias(tipoActual, modo)
    .then((rows) => { usoPorCategoria = Object.fromEntries(rows.map((r) => [r.categoria_id, Number(r.n)])); pintarChips(); })
    .catch(() => pintarChips());
  pintarChips();
  actualizarBotones();
}
```

- [ ] **Step 2: Estilos**

Añadir a `app.css`:

```css
.mov-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.mov-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px;
  border: 1px solid var(--borde, #ddd); border-radius: 999px; background: transparent;
  cursor: pointer; font-size: 0.85rem; color: var(--texto, #333); }
.mov-chip .ms-icono, .mov-chip .cat-emoji { font-size: 16px; }
.mov-chip.activo { border-color: var(--chip-color, currentColor);
  background: color-mix(in srgb, var(--chip-color, currentColor) 15%, transparent); }
.mov-chip--mas, .mov-chip--nueva { font-weight: 600; }
.mov-lista-cats { display: flex; flex-wrap: wrap; gap: 6px; }
.campo--check { display: flex; align-items: center; gap: 8px; flex-direction: row; }
```

- [ ] **Step 3: Verificación manual**

Se prueba junto con Task 10.

- [ ] **Step 4: Commit**

```bash
git add src/ui/movimientoForm.js app.css
git commit -m "feat(ui): formulario completo de movimiento (alta/edición, chips, autocompletado)"
```

---

## Task 10: `movimientosView.js` — usar el form nuevo, inactivos y drill-down

**Files:**
- Modify: `src/ui/movimientosView.js`
- Modify: `app.css`

**Interfaces:**
- Consumes: `abrirMovimientoForm` (`ui/movimientoForm.js`), `filtrarParaCalculos` (`logic/totales.js`), `nodoIconoCategoria` (`ui/iconoCategoria.js`), `formatoCLP` (`logic/dinero.js`), `prefs` (`src/prefs.js`), `listarCategorias` (`data/categorias.js`), `actualizarMovimiento`/`eliminarMovimiento` (`data/movimientos.js`).
- Produces: `montarMovimientos(contenedor, { rango, modo, tipo, categoriaInicial })` — agrega el parámetro opcional `categoriaInicial` (id de categoría para preseleccionar el filtro).

- [ ] **Step 1: Reemplazar el formulario embebido y el `fmt` local**

En `src/ui/movimientosView.js`:
1. Borrar la función `formularioNuevo` y la función `opcionesCategoria` completas.
2. Borrar la función local `fmt`; importar `formatoCLP` de `../logic/dinero.js` y usarlo (reemplazar `` `$${fmt(m.monto)}` `` por `formatoCLP(m.monto)`, que ya incluye el `$`; el signo `+`/`−` se antepone: `` `${signo} ${formatoCLP(m.monto)}` ``).
3. Imports nuevos al tope:
   ```js
   import { abrirMovimientoForm } from "./movimientoForm.js";
   import { filtrarParaCalculos } from "../logic/totales.js";
   import { nodoIconoCategoria } from "./iconoCategoria.js";
   import { formatoCLP } from "../logic/dinero.js";
   import { prefs } from "../prefs.js";
   ```
   (Quitar de los imports de `iconosCategoria.js` lo que ya no se use; `colorMovimiento` se mantiene.)

- [ ] **Step 2: Firma y estado de categoría inicial**

Cambiar la firma:
```js
export async function montarMovimientos(contenedor, { rango, modo, tipo, categoriaInicial = null }) {
```
Tras poblar `selCategoria` con las opciones, si `categoriaInicial`:
```js
  if (categoriaInicial) {
    selCategoria.value = String(categoriaInicial);
    panelFiltros.hidden = false;
    btnFiltros.classList.add("activo");
  }
```

- [ ] **Step 3: Alta y edición con `abrirMovimientoForm`**

Reemplazar `abrirModalNuevo`:
```js
  function abrirModalNuevo() {
    abrirMovimientoForm({ modo, categorias, onGuardado: recargar });
  }
```
En `fila(m, recargar, error, modo)`, reemplazar el botón `editarMonto` (que usa `prompt`) por:
```js
  const editar = el(
    "button",
    { class: "boton--icono", "aria-label": "Editar", title: "Editar",
      onClick: () => abrirMovimientoForm({ modo, categorias, movimiento: m, onGuardado: recargar }) },
    [lapiz()]
  );
```
`fila` necesita acceso a `categorias`: pasarla como parámetro —
`fila(m, recargar, error, modo, categorias)` y en `pintarLista` llamar
`fila(m, recargar, error, modo, categorias)`.

- [ ] **Step 4: Movimientos inactivos en la lista**

En `fila`, calcular la clase y el badge:
```js
  const inactivo = m.activo === false;
  const claseFila =
    `fila tipo-${m.tipo}` +
    (modo === "estimado" && m.pagado ? " fila-pagada" : "") +
    (inactivo ? " fila--inactiva" : "");
```
En el bloque de `fila-principal`, si `inactivo`, agregar tras el nombre:
```js
    inactivo ? el("span", { class: "badge-inactivo", text: "Inactivo" }) : null,
```
Añadir un toggle de `activo` a `controles` (siempre, no solo estimado):
```js
  const toggleActivo = el(
    "button",
    { class: inactivo ? "estado-off" : "estado-on",
      title: inactivo ? "Activar" : "Desactivar",
      "aria-label": inactivo ? "Activar" : "Desactivar",
      onClick: async () => {
        try { await actualizarMovimiento(m.id, { activo: inactivo }); await recargar(); }
        catch (e) { error.textContent = "No se pudo cambiar el estado."; }
      } },
    [check()]
  );
  controles.push(toggleActivo);
```
(Importar `check` de `./iconos.js`.)

- [ ] **Step 5: Usar el icono de categoría real**

En `fila`, reemplazar `iconoMovimiento(m)` por:
```js
  const iconoFila = el("span", { class: "fila-icono" }, [nodoIconoCategoria(m.categoria, m.nombre)]);
```

- [ ] **Step 6: Totales filtrados y drill-down en el panel**

En `recargar`, al montar el panel:
```js
      const paraTotales = filtrarParaCalculos(todos, {
        modo,
        incluirInactivos: prefs.get("incluirInactivos"),
      });
      montarPanelResumen(aside, todos, paraTotales, {
        tipo,
        onCategoria: (catId) => montarMovimientos(contenedor, { rango, modo, tipo, categoriaInicial: catId }),
      });
```
(La firma nueva de `montarPanelResumen` se define en Task 11.)

- [ ] **Step 7: Estilos**

Añadir a `app.css`:
```css
.fila--inactiva { opacity: 0.55; }
.badge-inactivo { font-size: 0.7rem; padding: 1px 6px; border-radius: 999px;
  background: color-mix(in srgb, currentColor 15%, transparent); margin-left: 6px; }
.fila .estado-on, .fila .estado-off { opacity: 0.5; }
.fila .estado-on:hover, .fila .estado-off:hover { opacity: 1; }
```

- [ ] **Step 8: Verificación manual**

Con `npx serve .`:
1. Movimientos → "+ Agregar movimiento": alta completa en modo real; aparece en la lista con el icono de su categoría.
2. Editar (lápiz): abre el form con los datos; cambiar monto/categoría/fecha; guarda.
3. Desactivar un movimiento: queda atenuado con badge "Inactivo" y el balance del panel baja.
4. Cambiar a modo estimado: el form muestra Pagado/Recurrente/Frecuencia.
5. En el panel, clic en una categoría de la dona: la lista queda filtrada por esa categoría.

- [ ] **Step 9: Commit**

```bash
git add src/ui/movimientosView.js app.css
git commit -m "feat(ui): movimientos con form modal, inactivos, icono de categoría y drill-down"
```

---

## Task 11: `panelResumenView.js` y `resumenView.js` — filtrado, ocultar total, drill-down

**Files:**
- Modify: `src/ui/panelResumenView.js`
- Modify: `src/ui/resumenView.js`
- Modify: `app.css`

**Interfaces:**
- Consumes: `filtrarParaCalculos` (`logic/totales.js`), `prefs` (`src/prefs.js`), `formatoCLP` (`logic/dinero.js`), `nodoIconoCategoria` (`ui/iconoCategoria.js`).
- Produces:
  - `montarPanelResumen(contenedor, movimientosTodos, movimientosParaTotales, { tipo, onCategoria }) : void` — nueva firma: recibe la lista completa (para "actividad reciente") y la ya filtrada (para totales y dona). `onCategoria(categoriaId)` se dispara al clickear un ítem de la dona.
  - `montarResumen(contenedor, { rango, modo })` — igual firma; internamente filtra con `filtrarParaCalculos` y respeta `prefs.ocultarTotal`.

- [ ] **Step 1: `panelResumenView.js`**

Cambios:
1. Imports: agregar `import { prefs } from "../prefs.js";` y `import { formatoCLP } from "../logic/dinero.js";`. Quitar la función local `fmt` y `fmtCompacto`; usar `formatoCLP`.
2. Firma: `export function montarPanelResumen(contenedor, movimientosTodos, movimientosParaTotales, { tipo, onCategoria })`.
3. `tarjetaResumen` y `tarjetaDona` usan `movimientosParaTotales`. `tarjetaActividad` usa `movimientosTodos`.
4. Ocultar total: en `tarjetaResumen`, envolver el valor de "Balance" así — si `prefs.get("ocultarTotal")`, mostrar `"*****"` en lugar de `formatoCLP(balance)`. Agregar un botón "ojo" en el `<h3>` del panel que hace `prefs.set("ocultarTotal", !prefs.get("ocultarTotal"))` y vuelve a montar: `montarPanelResumen(contenedor, movimientosTodos, movimientosParaTotales, { tipo, onCategoria })`.
5. Dona clickeable: en `tarjetaDona`, cada `<li>` de la leyenda pasa a ser
   `el("li", {}, [el("button", { class: "dona-item", onClick: () => onCategoria?.(g.categoriaId), ... }, [...])])`.
   Para tener `g.categoriaId`, en `agruparPorCategoria` cambiar la clave del `Map` de `nombre` a `m.categoria_id || "sin"` y guardar `categoriaId: m.categoria_id || null` en el objeto del grupo (mantener `nombre` para mostrar).

- [ ] **Step 2: `resumenView.js`**

Cambios:
1. Imports: `import { filtrarParaCalculos } from "../logic/totales.js";`, `import { prefs } from "../prefs.js";`, `import { formatoCLP } from "../logic/dinero.js";`. Quitar `fmt` local; usar `formatoCLP` (ajustar plantillas: ya incluye `$`).
2. Tras `listarMovimientos`, filtrar:
   ```js
   const paraTotales = filtrarParaCalculos(movimientos, {
     modo, incluirInactivos: prefs.get("incluirInactivos"),
   });
   ```
   Usar `paraTotales` en `calcularTotales` / `desglosarPorPago`.
3. Ocultar total: si `prefs.get("ocultarTotal")`, la función `tarjeta` que renderiza "Balance" muestra `"*****"` en vez del número. Añadir un botón "ojo" arriba de `cifras` que togglea `prefs.ocultarTotal` y vuelve a llamar `montarResumen(contenedor, { rango, modo })`.

- [ ] **Step 3: Estilos**

Añadir a `app.css`:
```css
.boton-ojo { margin-left: auto; }
.dona-item { display: flex; align-items: center; gap: 8px; width: 100%;
  background: transparent; border: 0; padding: 4px 0; cursor: pointer;
  color: inherit; text-align: left; font: inherit; }
.dona-item:hover { color: var(--acento, #2563a8); }
```

- [ ] **Step 4: Verificación manual**

1. Resumen y panel: con un movimiento inactivo, los totales lo excluyen; en estimado, activando "incluir inactivos" (Task 12) vuelve a contar.
2. Botón "ojo": los totales/balance pasan a `*****` y persiste al recargar.
3. Clic en categoría de la dona del panel → navega a Movimientos filtrado.

- [ ] **Step 5: Commit**

```bash
git add src/ui/panelResumenView.js src/ui/resumenView.js app.css
git commit -m "feat(ui): resumen filtra inactivos, oculta total y enlaza a la categoría"
```

---

## Task 12: `shell.js` — prefs, persistencia de período y toggle "incluir inactivos"

**Files:**
- Modify: `src/ui/shell.js`

**Interfaces:**
- Consumes: `prefs` (`src/prefs.js`).
- Produces: sin cambios de firma pública (`montarShell(contenedor, sesion)`).

- [ ] **Step 1: Migrar a `prefs`**

En `src/ui/shell.js`:
1. `import { prefs } from "../prefs.js";`.
2. Reemplazar lecturas iniciales:
   ```js
   let tipo = prefs.get("periodoTipo");
   let modo = prefs.get("modo");
   let tema = prefs.get("tema");
   const fechaGuardada = prefs.get("fechaRef");
   let fechaRef = fechaGuardada ? new Date(`${fechaGuardada}T12:00:00`) : new Date();
   ```
3. Al cambiar `tipo` (en `btnTipo[t].onClick`): `prefs.set("periodoTipo", t);`.
4. Al navegar período (`periodoAnterior`/`periodoSiguiente`): tras actualizar `fechaRef`, guardar
   `prefs.set("fechaRef", ymdLocal(fechaRef));` donde `ymdLocal` formatea `YYYY-MM-DD` en hora local (agregar helper local, igual que `hoyISO` de otros módulos).
5. Reemplazar `localStorage.setItem("finanzas.modo", ...)` por `prefs.set("modo", modo)` y
   `localStorage.setItem("finanzas.tema", ...)` por `prefs.set("tema", tema)`.

- [ ] **Step 2: Toggle "Incluir inactivos"**

En el `topbar`, junto a `selectorModo`, agregar un botón que solo se muestra en modo estimado:
```js
  const btnInactivos = el("button", {
    class: "boton--chip",
    text: "Incluir inactivos",
    "aria-pressed": String(prefs.get("incluirInactivos")),
    onClick: () => {
      prefs.set("incluirInactivos", !prefs.get("incluirInactivos"));
      btnInactivos.setAttribute("aria-pressed", String(prefs.get("incluirInactivos")));
      btnInactivos.classList.toggle("activo", prefs.get("incluirInactivos"));
      pintarVista();
    },
  });
  btnInactivos.classList.toggle("activo", prefs.get("incluirInactivos"));
  function sincronizarInactivosVisible() {
    btnInactivos.hidden = modo !== "estimado";
  }
```
Llamar `sincronizarInactivosVisible()` en `sincronizarModo()` y al montar. Insertar `btnInactivos` en el contenedor `topbar-derecha` antes de `btnTema`.

- [ ] **Step 3: Estilos**

Si no existe `.boton--chip` en `app.css`, añadir:
```css
.boton--chip { padding: 4px 10px; border-radius: 999px; border: 1px solid var(--borde, #ddd);
  background: transparent; cursor: pointer; font-size: 0.8rem; color: var(--texto, #333); }
.boton--chip.activo { background: color-mix(in srgb, currentColor 15%, transparent); }
```

- [ ] **Step 4: Verificación manual**

1. Cambiar período a "semana", navegar 2 semanas atrás, recargar la página → vuelve a "semana" en la misma fecha.
2. Cambiar a modo estimado → aparece "Incluir inactivos"; activarlo re-pinta y los totales incluyen inactivos. Volver a real → el botón desaparece.
3. Tema y modo siguen persistiendo.

- [ ] **Step 5: Commit**

```bash
git add src/ui/shell.js app.css
git commit -m "feat(ui): shell usa prefs, persiste período y suma toggle de inactivos"
```

---

## Task 13: Verificación integral y ajustes

**Files:**
- Modify: `app.css` (ajustes visuales que surjan)

- [ ] **Step 1: Correr toda la suite**

Run: `npm test`
Expected: PASS — `periodos`, `totales` (con `filtrarParaCalculos`), `dinero`, `prefs`.

- [ ] **Step 2: Recorrido manual completo**

Con la migración aplicada y `npx serve .`, verificar la lista de la Sección "Testing" del spec:
alta/edición real y estimado; toggle activo e impacto en totales; "incluir inactivos";
crear/editar categoría con icono MS y con emoji; chips rápidos ordenados por uso;
autocompletado de comercio; ocultar total (persistente); drill-down desde la dona;
persistencia de período tras recargar; borrar categoría deja movimientos sin categoría y la lista no rompe.

- [ ] **Step 3: Commit de cierre (si hubo ajustes de CSS)**

```bash
git add app.css
git commit -m "style: ajustes visuales de paridad Fase 1"
```

---

## Self-Review

**Spec coverage:**
- Sección 1 (migración) → Task 1. ✔
- Sección 2 (capa de datos) → Task 5. ✔
- Sección 3 (`prefs.js`, `dinero.js`) → Tasks 4, 2. ✔
- Sección 4 (`filtrarParaCalculos`) → Task 3 (+ consumo en Tasks 10, 11). ✔
- Sección 5 (fuente + `iconoCategoria.js`) → Task 6. ✔
- Sección 6 (vista Categorías + `categoriaForm`) → Tasks 7, 8. ✔
- Sección 7 (form movimiento, lista, resumen, shell) → Tasks 9, 10, 11, 12. ✔
- Testing → Tasks 2, 3, 4 (unitarios) + 13 (integral). ✔

**Placeholder scan:** Sin "TBD"/"TODO"/"implementar después". El único texto abierto
deliberado es la lista de ~70 iconos (contenido real provisto en Task 6) y la
nota de normalización de `orden` duplicado en Task 8 (con instrucción concreta).

**Type consistency:**
- `nodoIconoCategoria(cat, fallbackTexto)` — misma firma en Tasks 6, 8, 9, 10, 11.
- `abrirCategoriaForm({ categoria, modoInicial, tipoInicial, onGuardado })` — Tasks 7, 8, 9.
- `abrirMovimientoForm({ modo, categorias, movimiento, onGuardado })` — Tasks 9, 10.
- `montarPanelResumen(contenedor, movimientosTodos, movimientosParaTotales, { tipo, onCategoria })` — definida en Task 11, consumida en Task 10.
- `filtrarParaCalculos(movs, { modo, incluirInactivos })` — Task 3, consumida en 10, 11.
- `prefs.get/set` con claves `modo|tema|ocultarTotal|incluirInactivos|periodoTipo|fechaRef` — Tasks 4, 8, 10, 11, 12.
- `formatoCLP`/`parseCLP` — Task 2, consumidas en 9, 10, 11.
- RPC: `usoCategorias(tipo, modo)`, `sugerenciasComercio(tipo, modo, query)` — Task 5, consumidas en 9.
