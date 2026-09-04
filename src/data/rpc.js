import { supabase } from "../supabaseClient.js";
import { verificar } from "./_helpers.js";

// [{ categoria_id, n }] — conteo de movimientos por categoría para ese tipo+modo.
export async function usoCategorias(tipo, modo) {
  return verificar(await supabase.rpc("uso_categorias", { p_tipo: tipo, p_modo: modo }));
}

// [{ nombre, n }] — nombres previos más usados que empiezan con `query`.
export async function sugerenciasComercio(tipo, modo, query) {
  return verificar(
    await supabase.rpc("sugerencias_comercio", { p_tipo: tipo, p_modo: modo, p_query: query })
  );
}
