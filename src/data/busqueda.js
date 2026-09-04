import { supabase } from "../supabaseClient.js";
import { verificar } from "./_helpers.js";
import { SELECT } from "./movimientos.js";

// Trae `limite + 1` filas para saber si hay más sin una consulta de conteo
// aparte; el llamador descarta la fila extra si la usa como señal.
export async function buscarMovimientos({ modo, query, tipo, categoriaId, desde = 0, limite = 20 }) {
  let q = supabase
    .from("movimientos")
    .select(SELECT)
    .eq("modo", modo)
    .order("fecha", { ascending: false })
    .range(desde, desde + limite);
  if (query) q = q.ilike("nombre", `%${query}%`);
  if (tipo) q = q.eq("tipo", tipo);
  if (categoriaId) q = q.eq("categoria_id", categoriaId);
  return verificar(await q);
}
