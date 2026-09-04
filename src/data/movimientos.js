import { supabase } from "../supabaseClient.js";
import { verificar } from "./_helpers.js";

export const SELECT =
  "id, nombre, monto, tipo, modo, pagado, activo, recurrente, frecuencia, " +
  "categoria_id, fecha, detalle, " +
  "categoria:categorias(nombre, color, icono, emoji)";

export async function listarMovimientos({ desde, hasta, modo }) {
  return verificar(
    await supabase
      .from("movimientos")
      .select(SELECT)
      .eq("modo", modo)
      .gte("fecha_local", desde)
      .lte("fecha_local", hasta)
      .order("fecha", { ascending: false })
  );
}

export async function crearMovimiento({
  nombre,
  monto,
  tipo,
  modo,
  pagado = false,
  activo = true,
  categoria_id,
  fecha,
  detalle,
  recurrente = false,
  frecuencia = null,
}) {
  return verificar(
    await supabase
      .from("movimientos")
      .insert({
        nombre,
        monto,
        tipo,
        modo,
        pagado,
        activo,
        categoria_id,
        fecha,
        detalle,
        recurrente,
        frecuencia,
      })
      .select(SELECT)
      .single()
  );
}

export async function actualizarMovimiento(id, cambios) {
  return verificar(
    await supabase.from("movimientos").update(cambios).eq("id", id).select(SELECT).single()
  );
}

export async function eliminarMovimiento(id) {
  return verificar(await supabase.from("movimientos").delete().eq("id", id));
}
