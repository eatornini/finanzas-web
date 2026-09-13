-- 007 — Persistir el color de acento en la cuenta (perfiles), no solo en
-- localStorage, para que se vea igual en cualquier dispositivo donde el
-- usuario inicie sesión. Correr una sola vez en el SQL Editor de Supabase.

alter table perfiles add column if not exists acento text;

-- El cliente no puede escribir perfiles directamente (ver 005-cuentas-admin:
-- toda escritura pasa por funciones security definer). p_acento null borra
-- la preferencia (vuelve al color por defecto de la app).
create or replace function actualizar_acento(p_acento text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if p_acento is not null and p_acento !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'color inválido: %', p_acento;
  end if;
  update perfiles set acento = p_acento where id = auth.uid();
end;
$$;

grant execute on function actualizar_acento(text) to authenticated;
