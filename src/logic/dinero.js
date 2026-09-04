// Formato de moneda: pesos chilenos, enteros, sin decimales.
export function formatoCLP(n) {
  const num = Math.round(Number(n));
  return "$" + (Number.isFinite(num) ? num : 0).toLocaleString("es-CL");
}

// Extrae el valor numérico de un texto escrito por el usuario (ej. "$45.000").
export function parseCLP(s) {
  const soloDigitos = String(s).replace(/[^\d]/g, "");
  return soloDigitos ? Number(soloDigitos) : NaN;
}
