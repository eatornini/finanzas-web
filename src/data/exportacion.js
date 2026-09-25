import { supabase } from "../supabaseClient.js";
import { verificar } from "./_helpers.js";

// Campos crudos (sin el join de categoría) — a diferencia de movimientos.js,
// acá interesa el categoria_id tal cual para poder reconstruir la relación
// al importar, no el detalle ya resuelto de la categoría.
const SELECT_EXPORT =
  "id, nombre, monto, tipo, modo, pagado, activo, recurrente, frecuencia, categoria_id, fecha, detalle";

const PAGINA = 1000;

// Supabase pagina de a 1000 filas por consulta — junta todas las páginas en
// un solo array. `construirConsulta` recibe (ini, fin) y devuelve el query
// builder ya armado (con .range aplicado).
async function traerTodo(construirConsulta) {
  const filas = [];
  let desde = 0;
  for (;;) {
    const { data, error } = await construirConsulta(desde, desde + PAGINA - 1);
    if (error) throw error;
    filas.push(...data);
    if (data.length < PAGINA) break;
    desde += PAGINA;
  }
  return filas;
}

// modo: "real" | "estimado" | "ambos". tipo: "gasto" | "ingreso" | "ambos".
// desde/hasta: "YYYY-MM-DD" o null (sin acotar por fecha).
export async function listarMovimientosParaExportar({ modo, tipo, desde, hasta }) {
  return traerTodo((ini, fin) => {
    let q = supabase
      .from("movimientos")
      .select(SELECT_EXPORT)
      .order("fecha", { ascending: true })
      .range(ini, fin);
    if (modo !== "ambos") q = q.eq("modo", modo);
    if (tipo !== "ambos") q = q.eq("tipo", tipo);
    if (desde) q = q.gte("fecha_local", desde);
    if (hasta) q = q.lte("fecha_local", hasta);
    return q;
  });
}

// Campos mínimos de todos los movimientos existentes, para armar en el
// cliente el set de claves y detectar duplicados al importar (ver
// logic/exportacionDatos.js#claveMovimiento).
export async function listarClavesMovimientos() {
  return traerTodo((ini, fin) =>
    supabase.from("movimientos").select("modo, monto, fecha, nombre").range(ini, fin)
  );
}

// Inserta en lotes (Supabase acepta arrays, pero se trocea por las dudas en
// respaldos grandes). Devuelve la cantidad de filas insertadas.
export async function insertarMovimientosLote(filas) {
  const LOTE = 500;
  let total = 0;
  for (let i = 0; i < filas.length; i += LOTE) {
    const trozo = filas.slice(i, i + LOTE);
    const insertadas = await verificar(await supabase.from("movimientos").insert(trozo).select("id"));
    total += insertadas.length;
  }
  return total;
}

// Conteo total sin traer filas — para mostrar antes de un borrado masivo.
export async function contarTodosLosDatos() {
  const [movimientos, categorias] = await Promise.all([
    supabase.from("movimientos").select("id", { count: "exact", head: true }),
    supabase.from("categorias").select("id", { count: "exact", head: true }),
  ]);
  if (movimientos.error) throw movimientos.error;
  if (categorias.error) throw categorias.error;
  return { movimientos: movimientos.count ?? 0, categorias: categorias.count ?? 0 };
}

// Borra TODOS los movimientos y categorías de la cuenta — usado por "Borrar
// todos los datos" y por importar en modo "Reemplazar todo". RLS acota esto
// a las filas del usuario autenticado; .not("id","is",null) es el filtro
// "siempre verdadero" que exige un DELETE explícito (no borra por accidente
// si algún día se le saca el filtro sin querer: PostgREST rechazaría un
// DELETE sin ninguna condición).
export async function borrarTodosLosDatos() {
  await verificar(await supabase.from("movimientos").delete().not("id", "is", null));
  await verificar(await supabase.from("categorias").delete().not("id", "is", null));
}
