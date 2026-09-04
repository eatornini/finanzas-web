import { supabase } from "../supabaseClient.js";
import { verificar } from "./_helpers.js";

// Cuenta filas sin traer datos — para el aviso de sobrescritura antes de copiar.
export async function contarMovimientosEstimado(desde, hasta) {
  const { count, error } = await supabase
    .from("movimientos")
    .select("id", { count: "exact", head: true })
    .eq("modo", "estimado")
    .gte("fecha_local", desde)
    .lte("fecha_local", hasta);
  if (error) throw error;
  return count ?? 0;
}

// desde: cualquier fecha del mes origen (YYYY-MM-DD). Devuelve cuántos se copiaron.
export async function copiarMesEstimado(desde) {
  return verificar(await supabase.rpc("copiar_mes_estimado", { p_desde: desde }));
}

export async function borrarMesEstimado(desde, hasta) {
  return verificar(
    await supabase
      .from("movimientos")
      .delete()
      .eq("modo", "estimado")
      .gte("fecha_local", desde)
      .lte("fecha_local", hasta)
  );
}

export async function cambiarEstadoMesEstimado(desde, hasta, activo) {
  return verificar(
    await supabase
      .from("movimientos")
      .update({ activo })
      .eq("modo", "estimado")
      .gte("fecha_local", desde)
      .lte("fecha_local", hasta)
  );
}
