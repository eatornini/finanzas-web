import { periodoAnterior } from "./periodos.js";

// Fechas de referencia de los últimos `cantidad` períodos de `tipo`,
// terminando en fechaRef (incluido), en orden cronológico ascendente.
export function fechasTendencia(fechaRef, tipo, cantidad = 6) {
  const fechas = [fechaRef];
  let f = fechaRef;
  for (let i = 1; i < cantidad; i++) {
    f = periodoAnterior(f, tipo);
    fechas.unshift(f);
  }
  return fechas;
}

// Variación entre dos valores. anterior === 0: sin base para %, porcentaje
// null (la UI lo muestra como "—" en vez de un número o de Infinity).
export function calcularVariacion(actual, anterior) {
  const diferencia = actual - anterior;
  const porcentaje = anterior !== 0 ? (diferencia / Math.abs(anterior)) * 100 : null;
  return { diferencia, porcentaje };
}

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function ymdLocal(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Cantidad de días en un rango [desde, hasta], inclusive.
export function diasEnRango(desde, hasta) {
  const a = new Date(`${desde}T12:00:00`);
  const b = new Date(`${hasta}T12:00:00`);
  return Math.round((b - a) / 86400000) + 1;
}

// Progreso de un período frente a "hoy": cuántos días ya transcurrieron,
// cuántos tiene en total y si todavía está en curso (hoy cae dentro del
// rango) o ya cerró. `diaCorte` es el último día con datos reales — igual
// a diasTotales si el período ya cerró, o al día de hoy si está en curso —
// y es lo que el resto de Reportes usa para no tratar días futuros como $0.
export function progresoPeriodo(rango, hoyYmd) {
  const diasTotales = diasEnRango(rango.desde, rango.hasta);
  if (hoyYmd < rango.desde) {
    return { diasTotales, diaCorte: 0, pct: 0, enCurso: false };
  }
  if (hoyYmd > rango.hasta) {
    return { diasTotales, diaCorte: diasTotales, pct: 100, enCurso: false };
  }
  const diaCorte = diasEnRango(rango.desde, hoyYmd);
  return { diasTotales, diaCorte, pct: Math.round((diaCorte / diasTotales) * 100), enCurso: true };
}

// Serie diaria acumulada de ingresos/gastos/balance dentro de un rango, un
// punto por cada día del período (1..diasTotales) — base tanto para
// comparar "el mismo punto del período" entre meses como para el gráfico
// de ritmo. No recorta nada por fecha de hoy: quien la consuma decide
// hasta qué día mirarla (progresoPeriodo().diaCorte para el período en
// curso, diasTotales para uno cerrado), así nunca se pierden datos ni se
// inventan movimientos futuros.
export function serieAcumulada(movimientos, rango, diasTotales) {
  const porDia = new Map();
  for (const m of movimientos) {
    const fecha = String(m.fecha_local || m.fecha || "").slice(0, 10);
    const g = porDia.get(fecha) || { ingresos: 0, gastos: 0 };
    if (m.tipo === "ingreso") g.ingresos += Number(m.monto) || 0;
    else if (m.tipo === "gasto") g.gastos += Number(m.monto) || 0;
    porDia.set(fecha, g);
  }
  const inicio = new Date(`${rango.desde}T12:00:00`);
  let accIngresos = 0;
  let accGastos = 0;
  const serie = [];
  for (let dia = 1; dia <= diasTotales; dia++) {
    const fecha = ymdLocal(new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + dia - 1));
    const g = porDia.get(fecha) || { ingresos: 0, gastos: 0 };
    accIngresos += g.ingresos;
    accGastos += g.gastos;
    serie.push({
      dia,
      fecha,
      ingresos: r2(accIngresos),
      gastos: r2(accGastos),
      balance: r2(accIngresos - accGastos),
    });
  }
  return serie;
}

// Proyección lineal de cierre: extiende el ritmo diario ya observado hasta
// el día `diaCorte` al total de días del período. No inventa movimientos
// futuros, solo asume que el promedio diario visto hasta ahora se mantiene
// — por eso es una proyección y nunca se trata como un valor real. null si
// el período todavía no tiene ni un día con datos.
export function proyectarCierre(valorAcumulado, diaCorte, diasTotales) {
  if (diaCorte <= 0) return null;
  return r2((valorAcumulado / diaCorte) * diasTotales);
}
