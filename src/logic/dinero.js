// Formato de moneda: pesos chilenos, enteros, sin decimales.
// Los negativos llevan el signo menos antes del símbolo: "−$43.404" (no
// "$-43.404"). Se usa el signo tipográfico "−" (U+2212), igual que en el
// resto de la interfaz.
export function formatoCLP(n) {
  const num = Math.round(Number(n));
  const valor = Number.isFinite(num) ? num : 0;
  const abs = Math.abs(valor).toLocaleString("es-CL");
  return valor < 0 ? `−$${abs}` : `$${abs}`;
}

// Extrae el valor numérico de un texto escrito por el usuario (ej. "$45.000").
export function parseCLP(s) {
  const soloDigitos = String(s).replace(/[^\d]/g, "");
  return soloDigitos ? Number(soloDigitos) : NaN;
}

// Versión corta para ejes de gráficos: "$200 mil", "−$1,5 M".
const COMPACTO = new Intl.NumberFormat("es-CL", { notation: "compact", maximumFractionDigits: 1 });
export function formatoCLPCompacto(n) {
  const valor = Number(n) || 0;
  const abs = COMPACTO.format(Math.abs(valor));
  return valor < 0 ? `−$${abs}` : `$${abs}`;
}
