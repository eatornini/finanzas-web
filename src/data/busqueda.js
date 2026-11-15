import { supabase } from "../supabaseClient.js";
import { verificar } from "./_helpers.js";
import { SELECT } from "./movimientos.js";
import { filtroTextoMovimientos } from "../logic/busqueda.js";

const ORDENES = {
  recientes: [["fecha", { ascending: false }]],
  antiguos: [["fecha", { ascending: true }]],
  mayor: [["monto", { ascending: false }], ["fecha", { ascending: false }]],
  menor: [["monto", { ascending: true }], ["fecha", { ascending: false }]],
};

// Trae `limite + 1` filas para saber si hay más sin una consulta de conteo
// aparte; el llamador descarta la fila extra si la usa como señal.
// `query` busca en el nombre (comercio) y en el detalle del movimiento; si
// es un monto ("15990", "$15.990"), también en el monto exacto.
export async function buscarMovimientos({
  modo,
  query,
  tipo,
  categoriaId,
  fechaDesde = null,
  fechaHasta = null,
  montoMin = null,
  montoMax = null,
  orden = "recientes",
  desde = 0,
  limite = 20,
}) {
  let q = supabase.from("movimientos").select(SELECT).eq("modo", modo);
  const filtroTexto = filtroTextoMovimientos(query);
  if (filtroTexto) q = q.or(filtroTexto);
  if (tipo) q = q.eq("tipo", tipo);
  if (categoriaId === "sin") q = q.is("categoria_id", null);
  else if (categoriaId) q = q.eq("categoria_id", categoriaId);
  if (fechaDesde) q = q.gte("fecha_local", fechaDesde);
  if (fechaHasta) q = q.lte("fecha_local", fechaHasta);
  if (Number.isFinite(montoMin)) q = q.gte("monto", montoMin);
  if (Number.isFinite(montoMax)) q = q.lte("monto", montoMax);
  for (const [col, opts] of ORDENES[orden] || ORDENES.recientes) q = q.order(col, opts);
  return verificar(await q.range(desde, desde + limite));
}

// Fecha (YYYY-MM-DD) del primer movimiento del modo, para ofrecer los años
// del filtro. null si todavía no hay movimientos.
export async function primeraFechaMovimiento(modo) {
  const filas = await verificar(
    await supabase
      .from("movimientos")
      .select("fecha_local")
      .eq("modo", modo)
      .order("fecha_local", { ascending: true })
      .limit(1)
  );
  return filas && filas[0] ? filas[0].fecha_local : null;
}
