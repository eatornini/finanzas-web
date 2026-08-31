import { supabase } from "../supabaseClient.js";
import { verificar } from "./_helpers.js";

const SELECT =
  "id, nombre, monto, tipo, categoria_id, fecha, detalle, categoria:categorias(nombre, color)";

export async function listarMovimientos({ desde, hasta }) {
  return verificar(
    await supabase
      .from("movimientos")
      .select(SELECT)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: false })
  );
}

export async function crearMovimiento({ nombre, monto, tipo, categoria_id, fecha, detalle }) {
  return verificar(
    await supabase
      .from("movimientos")
      .insert({ nombre, monto, tipo, categoria_id, fecha, detalle })
      .select(SELECT)
      .single()
  );
}

export async function actualizarMovimiento(id, cambios) {
  return verificar(
    await supabase
      .from("movimientos")
      .update(cambios)
      .eq("id", id)
      .select(SELECT)
      .single()
  );
}

export async function eliminarMovimiento(id) {
  return verificar(await supabase.from("movimientos").delete().eq("id", id));
}
