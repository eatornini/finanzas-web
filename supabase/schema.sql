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
  categoria_id uuid references categorias on delete set null,
  fecha date not null,
  detalle text,
  created_at timestamptz not null default now()
);
create index movimientos_user_fecha_idx on movimientos (user_id, fecha);

alter table categorias enable row level security;
alter table movimientos enable row level security;

create policy "propios" on categorias for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "propios" on movimientos for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
