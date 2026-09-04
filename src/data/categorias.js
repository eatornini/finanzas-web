import { supabase } from "../supabaseClient.js";
import { verificar } from "./_helpers.js";

export async function listarCategorias() {
  return verificar(
    await supabase.from("categorias").select("*").order("orden").order("nombre")
  );
}

export async function crearCategoria({
  nombre,
  tipo,
  modo,
  color,
  emoji = null,
  icono = null,
  orden = 0,
}) {
  return verificar(
    await supabase
      .from("categorias")
      .insert({ nombre, tipo, modo, color, emoji, icono, orden })
      .select()
      .single()
  );
}

export async function actualizarCategoria(id, cambios) {
  return verificar(
    await supabase.from("categorias").update(cambios).eq("id", id).select().single()
  );
}

export async function eliminarCategoria(id) {
  return verificar(await supabase.from("categorias").delete().eq("id", id));
}
