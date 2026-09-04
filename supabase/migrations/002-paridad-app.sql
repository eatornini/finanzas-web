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
