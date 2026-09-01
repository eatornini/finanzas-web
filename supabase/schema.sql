-- Ejecutar una sola vez en el editor SQL de Supabase.

create table categorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nombre text not null,
  tipo text not null check (tipo in ('gasto','ingreso')),
  color text,
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
  categoria_id uuid references categorias on delete set null,
  fecha date not null,
  detalle text,
  created_at timestamptz not null default now()
);
create index movimientos_user_modo_fecha_idx on movimientos (user_id, modo, fecha);

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
