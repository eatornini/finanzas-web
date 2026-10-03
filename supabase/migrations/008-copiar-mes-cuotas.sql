-- 008 — Copiar mes estimado: avanzar cuotas (ej. "Préstamo 3/10" → "4/10").
-- Correr una sola vez en el SQL Editor de Supabase.

-- Devuelve el texto con la primera referencia "n/total" avanzada a
-- "n+1/total" (respeta los espacios alrededor de la barra). Si no hay
-- referencia, o n ya llegó a total, devuelve el texto tal cual.
create or replace function siguiente_cuota(p text)
returns text
language sql immutable as $$
  select case
    when m is not null and m[1]::int < m[2]::int
      then regexp_replace(
        p,
        '(?<!\d)\d{1,3}(\s*/\s*\d{1,3})(?!\d)',
        (m[1]::int + 1)::text || '\1'
      )
    else p
  end
  from (select regexp_match(p, '(?<!\d)(\d{1,3})\s*/\s*(\d{1,3})(?!\d)') as m) s
$$;

-- true si el texto trae una cuota ya terminada ("10/10"): esa fila no se
-- copia al mes siguiente porque el pago ya no existe.
create or replace function cuota_terminada(p text)
returns boolean
language sql immutable as $$
  select coalesce(m[1]::int > 0 and m[1]::int = m[2]::int, false)
  from (select regexp_match(p, '(?<!\d)(\d{1,3})\s*/\s*(\d{1,3})(?!\d)') as m) s
$$;

-- Igual que en 003, pero nombre y detalle avanzan la cuota y las cuotas
-- terminadas no se copian.
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
    siguiente_cuota(nombre),
    case when recurrente then monto else 0 end,
    tipo,
    modo,
    false,
    true,
    categoria_id,
    (v_desde_destino::timestamp + (fecha at time zone 'America/Santiago')::time)
      at time zone 'America/Santiago',
    siguiente_cuota(detalle),
    recurrente,
    frecuencia
  from movimientos
  where user_id = auth.uid()
    and modo = 'estimado'
    and fecha_local between v_desde_origen and v_hasta_origen
    and not cuota_terminada(nombre)
    and not cuota_terminada(detalle);

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

grant execute on function siguiente_cuota(text) to anon, authenticated;
grant execute on function cuota_terminada(text) to anon, authenticated;
grant execute on function copiar_mes_estimado(date) to anon, authenticated;
