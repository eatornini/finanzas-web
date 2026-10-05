-- Categoría más usada para un comercio dado (respeta RLS: security invoker).
-- Permite que, al leer un comprobante por OCR con un nombre de comercio ya
-- usado antes, el formulario preseleccione la categoría que se usó la
-- última vez con más frecuencia para ese mismo comercio.
create or replace function categoria_por_comercio(p_tipo text, p_modo text, p_nombre text)
returns uuid
language sql stable as $$
  select categoria_id
  from movimientos
  where tipo = p_tipo and modo = p_modo and categoria_id is not null
    and nombre ilike p_nombre
  group by categoria_id
  order by count(*) desc
  limit 1
$$;

grant execute on function categoria_por_comercio(text, text, text) to anon, authenticated;
