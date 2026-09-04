const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MESES_ABBR = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function ymd(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function lunesDeLaSemana(d) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (r.getDay() + 6) % 7; // 0 = lunes, 6 = domingo
  r.setDate(r.getDate() - dow);
  return r;
}

export function rangoPeriodo(fechaRef, tipo) {
  const d = fechaRef;
  if (tipo === "semana") {
    const lunes = lunesDeLaSemana(d);
    const domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6);
    return { desde: ymd(lunes), hasta: ymd(domingo) };
  }
  if (tipo === "mes") {
    const desde = new Date(d.getFullYear(), d.getMonth(), 1);
    const hasta = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { desde: ymd(desde), hasta: ymd(hasta) };
  }
  if (tipo === "año") {
    return { desde: `${d.getFullYear()}-01-01`, hasta: `${d.getFullYear()}-12-31` };
  }
  throw new Error(`tipo de período inválido: ${tipo}`);
}

function desplazar(d, tipo, signo) {
  if (tipo === "semana") {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * signo);
  }
  if (tipo === "mes") {
    return new Date(d.getFullYear(), d.getMonth() + signo, 1);
  }
  if (tipo === "año") {
    return new Date(d.getFullYear() + signo, 0, 1);
  }
  throw new Error(`tipo de período inválido: ${tipo}`);
}

export function periodoAnterior(fechaRef, tipo) {
  return desplazar(fechaRef, tipo, -1);
}

export function periodoSiguiente(fechaRef, tipo) {
  return desplazar(fechaRef, tipo, 1);
}

// Etiqueta corta para ejes de gráfico (vs. etiquetaPeriodo, más larga).
export function etiquetaCorta(fecha, tipo) {
  if (tipo === "año") return `${fecha.getFullYear()}`;
  if (tipo === "mes") return MESES_ABBR[fecha.getMonth()];
  if (tipo === "semana") {
    const lunes = rangoPeriodo(fecha, "semana").desde;
    const d = new Date(`${lunes}T00:00:00`);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  throw new Error(`tipo de período inválido: ${tipo}`);
}

export function etiquetaPeriodo(fechaRef, tipo) {
  const d = fechaRef;
  if (tipo === "mes") return `${MESES[d.getMonth()]} ${d.getFullYear()}`;
  if (tipo === "año") return `${d.getFullYear()}`;
  if (tipo === "semana") {
    const { desde, hasta } = rangoPeriodo(d, "semana");
    const a = new Date(`${desde}T00:00:00`);
    const b = new Date(`${hasta}T00:00:00`);
    const da = a.getDate();
    const db = b.getDate();
    const ma = MESES_ABBR[a.getMonth()];
    const mb = MESES_ABBR[b.getMonth()];
    if (a.getFullYear() !== b.getFullYear()) {
      return `${da} ${ma} ${a.getFullYear()} – ${db} ${mb} ${b.getFullYear()}`;
    }
    if (a.getMonth() !== b.getMonth()) {
      return `${da} ${ma} – ${db} ${mb} ${a.getFullYear()}`;
    }
    return `${da}–${db} ${ma} ${a.getFullYear()}`;
  }
  throw new Error(`tipo de período inválido: ${tipo}`);
}
