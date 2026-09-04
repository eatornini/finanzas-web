# Fase 2 — Herramientas de mes (diseño)

Fecha: 2026-09-04
Estado: aprobado (diseño). Rama: `feat/fase-2-herramientas-mes`.
Roadmap: `docs/superpowers/specs/2026-09-04-roadmap-fases-2-5.md` (sección Fase 2).

## Contexto

Paridad con las acciones de menú de la APK en modo estimado: copiar el mes al
siguiente, borrar los datos del mes, y activar/desactivar todos los
movimientos del mes. Sin cambios de esquema más allá de una función nueva.

### Decisiones cerradas

| # | Decisión |
|---|----------|
| 1 | Ubicación: menú "⋯" en la vista Resumen, visible solo cuando `modo === "estimado"` y el selector de período está en `"mes"` (evita la ambigüedad de "el mes visible" al navegar por semana o por año). |
| 2 | Copiar mes: si el mes destino ya tiene movimientos `estimado`, se confirma con el usuario indicando cuántos hay; al confirmar, se **sobrescriben** (se borran los del destino y se reemplazan por la copia). Si el destino está vacío, se confirma igual (acción masiva) pero sin advertencia de sobrescritura. |
| 3 | Fecha al copiar: todos los movimientos copiados quedan fechados el **día 1** del mes siguiente, conservando la hora/minuto original. |
| 4 | Duplicado: `monto` se mantiene solo si `recurrente = true`; el resto queda en `0`. `nombre`, `tipo`, `categoria_id`, `detalle`, `recurrente`, `frecuencia` se copian tal cual. `pagado` siempre arranca en `false`. `activo` siempre arranca en `true` (la desactivación de un movimiento es una decisión puntual del mes, no se arrastra). |
| 5 | Materialización de recurrentes: regla simple (ya definida en el roadmap) — no hay autogeneración automática; las instancias de un recurrente solo aparecen en un mes vía "copiar mes". |
| 6 | Implementación de "copiar mes" (borrar destino + insertar copia) vía función RPC en Postgres, para que sea atómica. "Borrar mes" y "activar/desactivar todos" van directo por el cliente (`delete`/`update` con filtro `modo` + rango de `fecha_local`), sin necesidad de RPC. |
| 7 | "Activar/desactivar todos": un solo botón cuyo efecto depende del estado actual — si todos los movimientos del mes visible están activos, el botón desactiva a todos; si hay al menos uno inactivo, el botón activa a todos. |

### Fuera de alcance

Autogeneración periódica de recurrentes (`pg_cron`/Edge Function), edición
masiva de otros campos, deshacer una acción ya confirmada.

---

## Sección 1 — Función RPC `copiar_mes_estimado`

Nuevo archivo `supabase/migrations/003-copiar-mes-estimado.sql`. Reflejar en
`supabase/schema.sql`.

```sql
-- 003 — Copiar mes estimado al siguiente (Fase 2, herramientas de mes).
-- Borra los movimientos 'estimado' del mes siguiente a p_desde y los
-- reemplaza por una copia del mes de p_desde: los recurrentes mantienen su
-- monto, el resto queda en 0; la fecha de la copia es el día 1 del mes
-- destino con la misma hora/minuto original. security invoker: respeta RLS,
-- solo toca filas del usuario autenticado.
create or replace function copiar_mes_estimado(p_desde date)
returns integer
language plpgsql as $$
declare
  v_desde_origen  date := date_trunc('month', p_desde)::date;
  v_hasta_origen  date := (date_trunc('month', p_desde) + interval '1 month - 1 day')::date;
  v_desde_destino date := (date_trunc('month', p_desde) + interval '1 month')::date;
  v_hasta_destino date := (date_trunc('month', v_desde_destino) + interval '1 month - 1 day')::date;
  v_n integer;
begin
  delete from movimientos
  where user_id = auth.uid()
    and modo = 'estimado'
    and fecha_local between v_desde_destino and v_hasta_destino;

  insert into movimientos
    (nombre, monto, tipo, modo, pagado, activo, categoria_id, fecha, detalle, recurrente, frecuencia)
  select
    nombre,
    case when recurrente then monto else 0 end,
    tipo,
    modo,
    false,
    true,
    categoria_id,
    (v_desde_destino::timestamp + (fecha at time zone 'America/Santiago')::time)
      at time zone 'America/Santiago',
    detalle,
    recurrente,
    frecuencia
  from movimientos
  where user_id = auth.uid()
    and modo = 'estimado'
    and fecha_local between v_desde_origen and v_hasta_origen;

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

grant execute on function copiar_mes_estimado(date) to anon, authenticated;
```

`p_desde` es cualquier fecha dentro del mes origen (se usa `rango.desde` del
período visible, que ya es el día 1). Devuelve la cantidad de movimientos
copiados, para el mensaje de confirmación en la UI.

---

## Sección 2 — Capa de datos

### `src/data/herramientasMes.js` (nuevo)

```js
import { supabase } from "../supabaseClient.js";
import { verificar } from "./_helpers.js";

// Cuenta filas sin traer datos — para el aviso de sobrescritura antes de copiar.
export async function contarMovimientosEstimado(desde, hasta) {
  const { count, error } = await supabase
    .from("movimientos")
    .select("id", { count: "exact", head: true })
    .eq("modo", "estimado")
    .gte("fecha_local", desde)
    .lte("fecha_local", hasta);
  if (error) throw error;
  return count ?? 0;
}

// p_desde: cualquier fecha del mes origen (YYYY-MM-DD). Devuelve cuántos se copiaron.
export async function copiarMesEstimado(desde) {
  return verificar(await supabase.rpc("copiar_mes_estimado", { p_desde: desde }));
}

export async function borrarMesEstimado(desde, hasta) {
  return verificar(
    await supabase
      .from("movimientos")
      .delete()
      .eq("modo", "estimado")
      .gte("fecha_local", desde)
      .lte("fecha_local", hasta)
  );
}

export async function cambiarEstadoMesEstimado(desde, hasta, activo) {
  return verificar(
    await supabase
      .from("movimientos")
      .update({ activo })
      .eq("modo", "estimado")
      .gte("fecha_local", desde)
      .lte("fecha_local", hasta)
  );
}
```

---

## Sección 3 — Lógica pura

### `src/logic/totales.js`

Agregar (junto a `filtrarParaCalculos`, misma regla de `activo`):

```js
// true si ningún movimiento está marcado inactivo (o la lista está vacía):
// determina si el botón "activar/desactivar todos" debe activar o desactivar.
export function todosActivos(movimientos) {
  return movimientos.every((m) => m.activo !== false);
}
```

### Tests — `tests/totales.test.js`

Casos para `todosActivos`: lista vacía → `true`; todos activos → `true`; al
menos un inactivo → `false`; movimiento sin campo `activo` → cuenta como
activo.

---

## Sección 4 — Vista Resumen: menú "⋯"

### `src/ui/resumenView.js`

- `montarResumen(contenedor, { rango, tipo, fechaRef, modo })` — se agregan
  `tipo` y `fechaRef` a la firma (el shell ya los pasa; hoy se ignoran).
- Cabecera (`resumen-cabecera`, hoy solo tiene el botón "ojo") pasa a
  `position: relative` y suma el botón "⋯" cuando `modo === "estimado" &&
  tipo === "mes"`. Al clickear, abre/cierra un popover (mismo patrón que
  `.panel-filtros` en movimientos: `[hidden]`, posición absoluta, cierra al
  clickear afuera no es necesario — un segundo click en "⋯" o elegir una
  opción lo cierra).
- Ítems del popover:
  1. **"Copiar mes a <mes siguiente>"** — deshabilitado mientras corre.
     - `contarMovimientosEstimado` sobre el rango del mes siguiente
       (`periodoSiguiente(fechaRef, "mes")` + `rangoPeriodo(..., "mes")`,
       de `logic/periodos.js`).
     - Si `count > 0`: `confirm('El mes de <etiqueta> ya tiene N movimientos estimados. Se reemplazarán por la copia de este mes. ¿Continuar?')`.
     - Si `count === 0`: `confirm('¿Copiar los movimientos estimados de este mes a <etiqueta>?')`.
     - Al confirmar: `copiarMesEstimado(rango.desde)` → mensaje
       `"Se copiaron N movimientos a <etiqueta>."` en el área de aviso.
  2. **"Desactivar todos" / "Activar todos"** (según `todosActivos(movimientos)`
     sobre la lista ya cargada del mes visible, sin filtrar por activo).
     - `confirm('¿Desactivar (o Activar) los N movimientos de <etiqueta>?')`.
     - `cambiarEstadoMesEstimado(rango.desde, rango.hasta, nuevoEstado)`.
  3. **"Borrar datos del mes"** — estilo de acción destructiva (mismo criterio
     visual que "Borrar" en movimientos/categorías).
     - `confirm('¿Borrar los N movimientos estimados de <etiqueta>? Esta acción no se puede deshacer.')`.
     - `borrarMesEstimado(rango.desde, rango.hasta)`.
- Cualquier acción exitosa: re-renderiza con `montarResumen(contenedor, { rango, tipo, fechaRef, modo })`
  (mismo patrón que ya usa el botón "ojo") y muestra el mensaje en un
  párrafo `.aviso` (nuevo, estilo neutro) debajo de la cabecera — necesario
  sobre todo para "copiar mes", que no cambia nada visible en el mes actual.
- Errores: reusar el `error` existente (`role="alert"`).

### `app.css`

- `.resumen-cabecera { position: relative; ... }` (agregar si no lo es ya).
- `.menu-mes`: popover con el mismo patrn que `.panel-filtros` (position
  absolute, `box-shadow: var(--sombra-popover)`, `border-radius: var(--r-md)`,
  `[hidden] { display: none; }`), items como botones de ancho completo,
  alineados a la izquierda; el de "Borrar datos del mes" en color de alerta
  (reusar el token que ya usa `.error`/gasto, ej. `var(--color-gasto)` si
  existe, o el color de "Borrar" en movimientos — revisar `:root`).
- `.aviso`: párrafo simple, `color: var(--fg-tenue)`, mismo tamaño que
  `.error`, sin fondo.

---

## Testing

- `tests/totales.test.js` — extender con `todosActivos`.
- No hay test de DOM ni de RPC (requieren Supabase). Verificación manual:
  1. Migración 003 corrida en Supabase; `select copiar_mes_estimado(current_date);`
     sin error (en el SQL Editor, autenticado como el usuario de la app —
     o probar desde la UI directamente).
  2. En modo estimado, tipo "mes": aparece el "⋯" en Resumen; en tipo
     "semana"/"año" o en modo real, no aparece.
  3. Copiar mes con destino vacío → aparecen los movimientos en el mes
     siguiente al navegar ahí; los recurrentes mantienen monto, el resto en 0;
     fecha = día 1; `pagado=false`, `activo=true`.
  4. Copiar mes con destino con datos → confirma con el conteo, sobrescribe.
  5. Desactivar todos → todos los movimientos del mes quedan inactivos y
     salen de los totales (salvo "incluir inactivos"); el botón pasa a decir
     "Activar todos".
  6. Borrar datos del mes → la lista de Movimientos para ese mes queda vacía.

## Orden de implementación sugerido

1. Migración 003 + `schema.sql` + verificar en Supabase.
2. `logic/totales.js` (`todosActivos`) + tests.
3. `data/herramientasMes.js`.
4. `ui/resumenView.js` (menú "⋯", las 3 acciones, aviso) + `app.css`.
5. Verificación manual y ajustes.
