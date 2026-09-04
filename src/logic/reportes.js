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
