// Piezas puras de la pantalla Buscar: cómo se arma el texto a buscar y el
// rango de fechas a partir de los filtros elegidos.

function ymd(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Texto apto para un ilike de PostgREST dentro de un filtro `or(...)`:
// se quitan los comodines (% _ *) y las comillas/barras que romperían el
// valor entre comillas. Menos de 2 caracteres útiles = sin búsqueda (null).
export function textoBusqueda(texto) {
  const limpio = String(texto ?? "")
    .replace(/["\\%_*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return limpio.length >= 2 ? limpio : null;
}

// Monto entero si el texto es solo un monto ("15990", "15.990", "$ 15.990");
// null si no lo es. El punto solo se acepta como separador de miles.
export function montoBusqueda(texto) {
  const t = String(texto ?? "").trim();
  if (!/^\$?\s*(\d{1,3}(\.\d{3})+|\d+)$/.test(t)) return null;
  const n = Number(t.replace(/[^\d]/g, ""));
  return Number.isSafeInteger(n) ? n : null;
}

// Filtro `or` que busca el texto en el nombre (comercio) O en el detalle y,
// si el texto es un monto, también los movimientos de ese monto exacto.
// El valor va entre comillas dobles para que comas o paréntesis del texto
// no se interpreten como sintaxis de PostgREST.
export function filtroTextoMovimientos(texto) {
  const t = textoBusqueda(texto);
  if (!t) return null;
  const filtro = `nombre.ilike."%${t}%",detalle.ilike."%${t}%"`;
  const monto = montoBusqueda(t);
  return monto === null ? filtro : `${filtro},monto.eq.${monto}`;
}

// Rango [desde, hasta] (YYYY-MM-DD, inclusive) según los filtros de fecha:
// - un rango manual (desde/hasta) tiene prioridad;
// - si no, año y opcionalmente mes (1-12);
// - sin nada, sin límite (null / null).
export function rangoBusqueda({ anio = null, mes = null, desde = null, hasta = null } = {}) {
  if (desde || hasta) {
    let a = desde || null;
    let b = hasta || null;
    if (a && b && a > b) [a, b] = [b, a];
    return { desde: a, hasta: b };
  }
  const y = Number(anio);
  if (!y) return { desde: null, hasta: null };
  const m = Number(mes);
  if (m >= 1 && m <= 12) {
    return { desde: ymd(new Date(y, m - 1, 1)), hasta: ymd(new Date(y, m, 0)) };
  }
  return { desde: `${y}-01-01`, hasta: `${y}-12-31` };
}

// Años a ofrecer en el filtro: del año del primer movimiento al actual,
// del más reciente al más antiguo.
export function aniosDisponibles(primeraFecha, hoy = new Date()) {
  const actual = hoy.getFullYear();
  const primero = Number(String(primeraFecha || "").slice(0, 4)) || actual;
  const anios = [];
  for (let y = actual; y >= Math.min(primero, actual); y--) anios.push(y);
  return anios;
}

// Partes de un texto para resaltar las coincidencias (sin distinguir
// mayúsculas ni tildes): [{ texto, coincide }].
function sinTildes(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
export function partesResaltadas(texto, consulta) {
  const original = String(texto ?? "");
  const q = textoBusqueda(consulta);
  if (!q || !original) return [{ texto: original, coincide: false }];
  const base = sinTildes(original);
  const aguja = sinTildes(q);
  const partes = [];
  let i = 0;
  while (i < original.length) {
    const j = base.indexOf(aguja, i);
    if (j === -1) break;
    if (j > i) partes.push({ texto: original.slice(i, j), coincide: false });
    partes.push({ texto: original.slice(j, j + aguja.length), coincide: true });
    i = j + aguja.length;
  }
  if (i < original.length) partes.push({ texto: original.slice(i), coincide: false });
  return partes.length ? partes : [{ texto: original, coincide: false }];
}
