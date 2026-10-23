// Parser de capturas con VARIOS movimientos (listado de la app del banco,
// cartola, historial de la tarjeta). Cada fila trae comercio + monto en la
// misma altura y, debajo, una fecha corta ("22 oct") y a veces el nombre de
// la tarjeta, que se ignora:
//
//   ALMACEN YOLI                 $3,600
//   22 oct
//   Bci Visa Debito Premier ••5925
//
// Otras apps agrupan por día con un encabezado ("Martes 21 de octubre") y
// las filas debajo no repiten la fecha; también se soporta.
//
// Entrada: LineInfo[] de construirBloques() (ordenadas por top).
// Salida: [{ comercio, monto, fecha }] en el orden de la captura; fecha es
// un Date a las 12:00 hora local (la lista no trae hora) o null.

const MESES_ES = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, set: 8, oct: 9, nov: 10, dic: 11,
};

// Monto al final de la línea con "$" (el "$" evita confundir con números
// que son parte del nombre: "VENDOMATICA 665", "RAMIREZ 2092"). Admite
// signo y separador de miles con punto o coma.
const MONTO_CON_PESO_REGEX = /([+-]?)\s*\$\s*(\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,]\d{1,2})?\s*$/;
// Línea que es SOLO un número con separador de miles (Tesseract a veces se
// come el "$"). Sin separador no se acepta: podría ser cualquier cosa.
const MONTO_SOLO_REGEX = /^([+-]?)\s*(\d{1,3}(?:[.,]\d{3})+)(?:[.,]\d{1,2})?$/;

const FECHA_MES_REGEX =
  /(?<![\d])(\d{1,2})\s*(?:de\s+)?(ene|feb|mar|abr|may|jun|jul|ago|sept?|set|oct|nov|dic)[a-záéíóú]*\.?(?:\s*(?:de\s+)?(\d{4}))?/i;
const FECHA_NUM_REGEX = /(?<![\d])(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?(?![\d])/;
const HOY_AYER_REGEX = /^(hoy|ayer)\b/i;

function seSolapanVert(a, b) {
  const solape = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return solape > Math.min(a.height, b.height) * 0.4;
}

function parsearMontoLinea(text) {
  const t = text.trim();
  let m = t.match(MONTO_CON_PESO_REGEX);
  let resto;
  if (m) {
    resto = t.slice(0, m.index).trim();
  } else {
    m = t.match(MONTO_SOLO_REGEX);
    if (!m) return null;
    resto = "";
  }
  const monto = Number(m[2].replace(/[.,]/g, ""));
  if (!monto) return null;
  return { monto, signo: m[1] || "", resto };
}

// Fecha de la línea (Date a las 12:00) o null. Sin año, se asume el año de
// `hoy`; si eso cae en el futuro, es del año anterior (lista de diciembre
// vista en enero).
export function parsearFechaCorta(text, hoy = new Date()) {
  const t = text.trim();
  const hoyAyer = t.match(HOY_AYER_REGEX);
  if (hoyAyer) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 12);
    if (hoyAyer[1].toLowerCase() === "ayer") d.setDate(d.getDate() - 1);
    return d;
  }
  let dia;
  let mes;
  let anio = null;
  let m = t.match(FECHA_MES_REGEX);
  if (m) {
    dia = Number(m[1]);
    mes = MESES_ES[m[2].toLowerCase().slice(0, 3)];
    if (m[3]) anio = Number(m[3]);
  } else {
    m = t.match(FECHA_NUM_REGEX);
    if (!m) return null;
    dia = Number(m[1]);
    mes = Number(m[2]) - 1;
    if (m[3]) anio = Number(m[3].length === 2 ? `20${m[3]}` : m[3]);
  }
  if (mes === undefined || mes < 0 || mes > 11 || dia < 1 || dia > 31) return null;
  if (anio === null) {
    anio = hoy.getFullYear();
    const tentativa = new Date(anio, mes, dia, 12);
    const limite = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
    if (tentativa > limite) anio -= 1;
  }
  const d = new Date(anio, mes, dia, 12);
  return d.getMonth() === mes ? d : null; // descarta 31/02 y similares
}

export function parsearListaMovimientos(lineas, hoy = new Date()) {
  // 1) Filas: cada línea con monto ancla una fila.
  const filas = [];
  for (const linea of lineas) {
    const monto = parsearMontoLinea(linea.text);
    if (monto) filas.push({ linea, ...monto, partesNombre: [] });
  }
  if (!filas.length) return [];

  const usadas = new Set(filas.map((f) => f.linea));

  // 2) Comercio: el texto antes del monto en la misma línea o, si Tesseract
  // los separó, las líneas a su izquierda en la misma altura.
  for (const f of filas) {
    if (f.resto) {
      f.partesNombre.push({ text: f.resto, left: f.linea.left });
      continue;
    }
    for (const l of lineas) {
      if (usadas.has(l) || l.right > f.linea.left + 5 || !seSolapanVert(l, f.linea)) continue;
      f.partesNombre.push(l);
      usadas.add(l);
    }
  }

  // 3) Fechas. Si casi todas las filas tienen su fecha propia, cada fecha va
  // con la fila de arriba; si son pocas, son encabezados de día y valen para
  // las filas de abajo.
  const fechas = [];
  for (const l of lineas) {
    if (usadas.has(l)) continue;
    const fecha = parsearFechaCorta(l.text, hoy);
    if (fecha) fechas.push({ top: l.top, fecha });
  }
  const porFila = fechas.length >= filas.length * 0.8;
  const tops = filas.map((f) => f.linea.top);
  for (const { top, fecha } of fechas) {
    if (porFila) {
      // última fila que empieza arriba de la fecha
      let idx = -1;
      for (let i = 0; i < tops.length; i++) if (tops[i] <= top) idx = i;
      if (idx >= 0 && !filas[idx].fecha) filas[idx].fecha = fecha;
    } else {
      for (let i = 0; i < tops.length; i++) if (tops[i] > top) filas[i].fecha = fecha;
    }
  }

  return filas.map((f) => ({
    comercio:
      f.partesNombre
        .sort((a, b) => a.left - b.left)
        .map((p) => p.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim() || null,
    monto: f.monto,
    signo: f.signo,
    fecha: f.fecha || null,
  }));
}
