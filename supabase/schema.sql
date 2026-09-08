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

-- ── perfiles: registro con aprobación manual y roles ──────────────────
-- Una fila por usuario de auth.users. `estado` controla el acceso a la app
-- (solo 'activo' entra); `rol` habilita el panel de administración. La crea
-- un trigger al registrarse; el cliente solo la lee (toda escritura pasa
-- por funciones security definer).
create table perfiles (
  id            uuid primary key references auth.users on delete cascade,
  email         text not null,
  estado        text not null default 'pendiente'
                check (estado in ('pendiente','activo','deshabilitado','rechazado')),
  rol           text not null default 'usuario' check (rol in ('usuario','admin')),
  creado_en     timestamptz not null default now(),
  ultimo_acceso timestamptz
);
alter table perfiles enable row level security;

create or replace function handle_nuevo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function handle_nuevo_usuario();

-- Helpers de autorización. security definer => leen `perfiles` sin RLS (sin
-- recursión con las políticas de abajo).
create or replace function es_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles
                 where id = uid and rol = 'admin' and estado = 'activo');
$$;

create or replace function esta_activo(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = uid and estado = 'activo');
$$;

grant execute on function es_admin(uuid)    to anon, authenticated;
grant execute on function esta_activo(uuid) to anon, authenticated;

alter table categorias enable row level security;
alter table movimientos enable row level security;

-- `esta_activo(auth.uid())` exige además que la cuenta esté aprobada: un
-- usuario pendiente / deshabilitado no ve ni escribe nada.
create policy "propios" on categorias for all
  using      (user_id = auth.uid() and (select esta_activo(auth.uid())))
  with check (user_id = auth.uid() and (select esta_activo(auth.uid())));
create policy "propios" on movimientos for all
  using      (user_id = auth.uid() and (select esta_activo(auth.uid())))
  with check (user_id = auth.uid() and (select esta_activo(auth.uid())));

-- Permisos a nivel de tabla para los roles de la API (PostgREST). Sin estos
-- GRANT, una consulta autenticada devuelve 42501 "permission denied" aunque
-- RLS y las políticas estén bien. Las políticas de arriba siguen filtrando
-- fila por fila: un usuario solo ve/edita lo suyo.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;

-- `perfiles` es la excepción: el cliente solo lee (su propia fila; los admins
-- todas). Cualquier escritura pasa por funciones security definer.
revoke select on perfiles from anon;
revoke insert, update, delete on perfiles from anon, authenticated;

create policy "perfil_propio" on perfiles for select
  using (id = auth.uid());
create policy "perfil_admin_lee" on perfiles for select
  using ((select es_admin(auth.uid())));

-- Último acceso del propio usuario (lo llama la shell al montar).
create or replace function registrar_acceso()
returns void language sql volatile security definer set search_path = public as $$
  update perfiles set ultimo_acceso = now() where id = auth.uid();
$$;
grant execute on function registrar_acceso() to authenticated;

-- ── RPC de administración (solo admins activos; el resto recibe 42501) ──
create or replace function admin_listar_usuarios()
returns table (
  id uuid, email text, estado text, rol text,
  creado_en timestamptz, ultimo_acceso timestamptz, n_movimientos bigint
)
language plpgsql stable security definer set search_path = public as $$
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
returns void language plpgsql volatile security definer set search_path = public as $$
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
returns void language plpgsql volatile security definer set search_path = public as $$
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
returns json language plpgsql stable security definer set search_path = public as $$
declare v json;
begin
  if not es_admin(auth.uid()) then
    raise exception 'no autorizado' using errcode = '42501';
  end if;
  select json_build_object(
    'usuarios_total',      (select count(*) from perfiles),
    'usuarios_pendientes', (select count(*) from perfiles where estado = 'pendiente'),
    'usuarios_activos',    (select count(*) from perfiles where estado = 'activo'),
    'usuarios_inactivos',  (select count(*) from perfiles where estado in ('deshabilitado','rechazado')),
    'admins',              (select count(*) from perfiles where rol = 'admin' and estado = 'activo'),
    'movimientos_total',   (select count(*) from movimientos),
    'movimientos_30d',     (select count(*) from movimientos where fecha_local >= (current_date - 30))
  ) into v;
  return v;
end;
$$;

grant execute on function admin_listar_usuarios()      to authenticated;
grant execute on function admin_set_estado(uuid, text) to authenticated;
grant execute on function admin_set_rol(uuid, text)    to authenticated;
grant execute on function admin_estadisticas()         to authenticated;

-- Primer admin (una sola vez, tras registrarte con tu email):
--   update perfiles set rol = 'admin', estado = 'activo'
--   where email = 'tu-email@ejemplo.com';

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

-- Copiar mes estimado al siguiente (Fase 2, herramientas de mes). Borra los
-- movimientos 'estimado' del mes siguiente a p_desde y los reemplaza por una
-- copia del mes de p_desde: los recurrentes mantienen su monto, el resto
-- queda en 0; la fecha de la copia es el día 1 del mes destino con la misma
-- hora/minuto original. Devuelve la cantidad de movimientos copiados.
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

-- Bucket de Storage para imágenes de comprobantes (Fase 4b). Cada usuario
-- solo ve/escribe archivos bajo su propia carpeta ({user_id}/...).
insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;

create policy "comprobantes_select_propio" on storage.objects for select
  using (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "comprobantes_insert_propio" on storage.objects for insert
  with check (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "comprobantes_update_propio" on storage.objects for update
  using (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "comprobantes_delete_propio" on storage.objects for delete
  using (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = auth.uid()::text);
