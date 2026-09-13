-- 006 — Categorías por defecto para cuentas nuevas. Correr una sola vez en
-- el SQL Editor de Supabase. Afecta altas nuevas (vía el trigger de
-- auth.users) y, como backfill al final de este archivo, a las cuentas
-- existentes que hoy no tienen NINGUNA categoría — las que ya tienen al
-- menos una quedan intactas.

create or replace function sembrar_categorias_default(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- (nombre, icono, color)
  v_gastos constant text[][] := array[
    ['Alimentación',    'restaurant',        '#e67e22'],
    ['Transporte',      'directions_car',    '#3498db'],
    ['Vivienda',        'home',              '#9b59b6'],
    ['Salud',           'health_and_safety', '#2ecc71'],
    ['Educación',       'school',            '#1abc9c'],
    ['Entretenimiento', 'movie',             '#e84393'],
    ['Compras',         'shopping_cart',     '#f1c40f'],
    ['Servicios',       'receipt_long',      '#7f8c8d'],
    ['Otros gastos',    'category',          '#c0392b']
  ];
  v_ingresos constant text[][] := array[
    ['Sueldo',             'payments',     '#2ecc71'],
    ['Ventas y freelance', 'sell',         '#3498db'],
    ['Inversiones',        'trending_up',  '#9b59b6'],
    ['Otros ingresos',     'attach_money', '#f1c40f']
  ];
  v_modo text;
  v_fila text[];
  v_orden int;
begin
  -- Idempotente: si la cuenta ya tiene alguna categoría (p. ej. se llama dos
  -- veces por error), no duplica nada.
  if exists (select 1 from categorias where user_id = p_user_id) then
    return;
  end if;

  foreach v_modo in array array['real', 'estimado'] loop
    v_orden := 0;
    foreach v_fila slice 1 in array v_gastos loop
      v_orden := v_orden + 1;
      insert into categorias (user_id, nombre, tipo, modo, color, icono, orden)
      values (p_user_id, v_fila[1], 'gasto', v_modo, v_fila[3], v_fila[2], v_orden);
    end loop;
    v_orden := 0;
    foreach v_fila slice 1 in array v_ingresos loop
      v_orden := v_orden + 1;
      insert into categorias (user_id, nombre, tipo, modo, color, icono, orden)
      values (p_user_id, v_fila[1], 'ingreso', v_modo, v_fila[3], v_fila[2], v_orden);
    end loop;
  end loop;
end;
$$;

-- El alta de perfil ya la hacía este trigger — se agrega la siembra de
-- categorías al mismo paso, sin tocar el resto del flujo de registro.
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
  perform sembrar_categorias_default(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_nuevo_usuario();

-- ── Backfill ────────────────────────────────────────────────────────────
-- Cuentas que ya existían antes de esta migración y nunca crearon ninguna
-- categoría (ni a mano ni por este mismo trigger, porque no existía)
-- reciben el mismo set por defecto. Cuentas con al menos una categoría
-- propia no se tocan.
do $$
declare
  v_perfil record;
begin
  for v_perfil in
    select p.id from perfiles p
    where not exists (select 1 from categorias c where c.user_id = p.id)
  loop
    perform sembrar_categorias_default(v_perfil.id);
  end loop;
end;
$$;
