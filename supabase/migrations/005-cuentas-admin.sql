-- 005 — Cuentas: registro con aprobación manual, roles y panel de
-- administración. Correr una sola vez en el SQL Editor de Supabase.

-- ── perfiles ───────────────────────────────────────────────────────────
-- Una fila por usuario de auth.users. `estado` controla el acceso a la app
-- (solo 'activo' entra); `rol` habilita el panel de administración.
create table if not exists perfiles (
  id            uuid primary key references auth.users on delete cascade,
  email         text not null,
  estado        text not null default 'pendiente'
                check (estado in ('pendiente','activo','deshabilitado','rechazado')),
  rol           text not null default 'usuario' check (rol in ('usuario','admin')),
  creado_en     timestamptz not null default now(),
  ultimo_acceso timestamptz
);

alter table perfiles enable row level security;

-- Los usuarios que YA existían son cuentas legítimas: entran como 'activo'
-- para no perder acceso al aplicar las políticas nuevas de abajo.
insert into perfiles (id, email, estado)
select u.id, coalesce(u.email, ''), 'activo'
from auth.users u
on conflict (id) do nothing;

-- ── alta automática de perfil al registrarse ───────────────────────────
create or replace function handle_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_nuevo_usuario();

-- ── helpers de autorización (bypass RLS: security definer) ──────────────
create or replace function es_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from perfiles
    where id = uid and rol = 'admin' and estado = 'activo'
  );
$$;

create or replace function esta_activo(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from perfiles where id = uid and estado = 'activo'
  );
$$;

grant execute on function es_admin(uuid)    to anon, authenticated;
grant execute on function esta_activo(uuid) to anon, authenticated;

-- ── permisos y RLS de perfiles ────────────────────────────────────────
-- El cliente solo lee. Toda escritura pasa por funciones security definer.
grant select on perfiles to authenticated;
revoke select on perfiles from anon;
revoke insert, update, delete on perfiles from anon, authenticated;

drop policy if exists "perfil_propio" on perfiles;
create policy "perfil_propio" on perfiles for select
  using (id = auth.uid());

drop policy if exists "perfil_admin_lee" on perfiles;
create policy "perfil_admin_lee" on perfiles for select
  using ((select es_admin(auth.uid())));

-- ── endurecer las tablas de datos con la aprobación ───────────────────
-- Un usuario pendiente / deshabilitado / rechazado no lee ni escribe nada
-- aunque se salte la UI. (select …) para evaluarlo una vez por statement.
drop policy if exists "propios" on movimientos;
create policy "propios" on movimientos for all
  using      (user_id = auth.uid() and (select esta_activo(auth.uid())))
  with check (user_id = auth.uid() and (select esta_activo(auth.uid())));

drop policy if exists "propios" on categorias;
create policy "propios" on categorias for all
  using      (user_id = auth.uid() and (select esta_activo(auth.uid())))
  with check (user_id = auth.uid() and (select esta_activo(auth.uid())));

-- ── RPC: registrar el último acceso del propio usuario ────────────────
create or replace function registrar_acceso()
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update perfiles set ultimo_acceso = now() where id = auth.uid();
$$;

grant execute on function registrar_acceso() to authenticated;

-- ── RPC de administración (solo admins activos) ──────────────────────
create or replace function admin_listar_usuarios()
returns table (
  id uuid, email text, estado text, rol text,
  creado_en timestamptz, ultimo_acceso timestamptz, n_movimientos bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not es_admin(auth.uid()) then
    raise exception 'no autorizado' using errcode = '42501';
  end if;
  return query
    select p.id, p.email, p.estado, p.rol, p.creado_en, p.ultimo_acceso,
           count(m.id) as n_movimientos
    from perfiles p
    left join movimientos m on m.user_id = p.id
    group by p.id
    order by p.creado_en desc;
end;
$$;

create or replace function admin_set_estado(p_id uuid, p_estado text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not es_admin(auth.uid()) then
    raise exception 'no autorizado' using errcode = '42501';
  end if;
  if p_estado not in ('pendiente','activo','deshabilitado','rechazado') then
    raise exception 'estado inválido: %', p_estado;
  end if;
  if p_id = auth.uid() then
    raise exception 'no puedes cambiar tu propio estado';
  end if;
  update perfiles set estado = p_estado where id = p_id;
  if not exists (select 1 from perfiles where rol = 'admin' and estado = 'activo') then
    raise exception 'debe quedar al menos un administrador activo';
  end if;
end;
$$;

create or replace function admin_set_rol(p_id uuid, p_rol text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not es_admin(auth.uid()) then
    raise exception 'no autorizado' using errcode = '42501';
  end if;
  if p_rol not in ('usuario','admin') then
    raise exception 'rol inválido: %', p_rol;
  end if;
  update perfiles set rol = p_rol where id = p_id;
  if not exists (select 1 from perfiles where rol = 'admin' and estado = 'activo') then
    raise exception 'debe quedar al menos un administrador activo';
  end if;
end;
$$;

create or replace function admin_estadisticas()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v json;
begin
  if not es_admin(auth.uid()) then
    raise exception 'no autorizado' using errcode = '42501';
  end if;
  select json_build_object(
    'usuarios_total',         (select count(*) from perfiles),
    'usuarios_pendientes',    (select count(*) from perfiles where estado = 'pendiente'),
    'usuarios_activos',       (select count(*) from perfiles where estado = 'activo'),
    'usuarios_inactivos',     (select count(*) from perfiles where estado in ('deshabilitado','rechazado')),
    'admins',                 (select count(*) from perfiles where rol = 'admin' and estado = 'activo'),
    'movimientos_total',      (select count(*) from movimientos),
    'movimientos_30d',        (select count(*) from movimientos where fecha_local >= (current_date - 30))
  ) into v;
  return v;
end;
$$;

grant execute on function admin_listar_usuarios()      to authenticated;
grant execute on function admin_set_estado(uuid, text) to authenticated;
grant execute on function admin_set_rol(uuid, text)    to authenticated;
grant execute on function admin_estadisticas()         to authenticated;

-- ── bootstrap del primer admin ───────────────────────────────────────
-- Después de registrarte en la app con tu email, corre esto UNA sola vez:
--
--   update perfiles set rol = 'admin', estado = 'activo'
--   where email = 'eatornini@gmail.com';
