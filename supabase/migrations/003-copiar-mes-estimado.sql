-- 003 — Copiar mes estimado al siguiente (Fase 2, herramientas de mes).
-- Correr una sola vez en el SQL Editor de Supabase.

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
