-- Ejecutar una sola vez en el editor SQL de Supabase.

create table categorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nombre text not null,
  tipo text not null check (tipo in ('gasto','ingreso')),
  -- una categoría pertenece a un modo: las de 'estimado' son lista aparte.
  modo text not null default 'real' check (modo in ('real','estimado')),
  color text,
  emoji text,
  icono text,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

create table movimientos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nombre text not null,
  monto numeric(12,2) not null check (monto >= 0),
  tipo text not null check (tipo in ('gasto','ingreso')),
  -- modo 'estimado' = lo planeado para el período; 'real' = lo que ocurrió.
  -- 'pagado' solo tiene sentido en modo estimado (se ignora en modo real).
  modo text not null default 'real' check (modo in ('real','estimado')),
  pagado boolean not null default false,
  -- 'activo' = participa en los totales. Un inactivo se ve en la lista pero
  -- no suma (salvo en estimado con la preferencia "incluir inactivos").
  activo boolean not null default true,
  imagen text,
  recurrente boolean not null default false,
  frecuencia text check (frecuencia is null or frecuencia in
    ('mensual','bimestral','trimestral','anual')),
  categoria_id uuid references categorias on delete set null,
  fecha timestamptz not null,
  -- día calendario de Santiago, derivado por trigger; se filtra por período con esto.
  fecha_local date not null default (now() at time zone 'America/Santiago')::date,
  detalle text,
  created_at timestamptz not null default now()
);
create index movimientos_user_modo_fechalocal_idx
  on movimientos (user_id, modo, fecha_local);

-- Deriva fecha_local desde fecha (timestamptz) en la zona de negocio.
create or replace function set_fecha_local()
returns trigger
language plpgsql
as $$
begin
  new.fecha_local := (new.fecha at time zone 'America/Santiago')::date;
  return new;
end;
$$;

create trigger trg_fecha_local
before insert or update of fecha on movimientos
for each row
execute function set_fecha_local();

-- Garantiza a nivel de base de datos que, si el movimiento referencia una
-- categoría, esa categoría pertenezca al mismo user_id que el movimiento.
-- No depende de la UI ni de RLS. La FK de arriba mantiene ON DELETE SET NULL.
create or replace function movimientos_categoria_mismo_usuario()
returns trigger
language plpgsql
as $$
begin
  if new.categoria_id is not null then
    if not exists (
      select 1
      from categorias c
      where c.id = new.categoria_id
        and c.user_id = new.user_id
    ) then
      raise exception
        'La categoría % no pertenece al usuario del movimiento (%).',
        new.categoria_id, new.user_id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_movimientos_categoria_usuario
before insert or update of categoria_id, user_id on movimientos
for each row
execute function movimientos_categoria_mismo_usuario();

alter table categorias enable row level security;
alter table movimientos enable row level security;

create policy "propios" on categorias for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "propios" on movimientos for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Permisos a nivel de tabla para los roles de la API (PostgREST). Sin estos
-- GRANT, una consulta autenticada devuelve 42501 "permission denied" aunque
-- RLS y las políticas estén bien. Las políticas de arriba siguen filtrando
-- fila por fila: un usuario solo ve/edita lo suyo.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;

-- Agregaciones para la UI (respetan RLS: security invoker).
-- Conteo de uso por categoría, para ordenar los chips rápidos del formulario.
create or replace function uso_categorias(p_tipo text, p_modo text)
returns table (categoria_id uuid, n bigint)
language sql stable as $$
  select categoria_id, count(*)
  from movimientos
  where tipo = p_tipo and modo = p_modo and categoria_id is not null
  group by categoria_id
$$;

-- Autocompletado de comercio: nombres previos más usados que empiezan con la query.
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
