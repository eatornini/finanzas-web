-- Modo real/estimado. Ejecutar una sola vez en el SQL Editor de Supabase,
-- sobre el proyecto que ya tiene datos.

alter table movimientos
  add column if not exists modo text not null default 'real'
    check (modo in ('real','estimado')),
  add column if not exists pagado boolean not null default false;

drop index if exists movimientos_user_fecha_idx;
create index if not exists movimientos_user_modo_fecha_idx
  on movimientos (user_id, modo, fecha);
