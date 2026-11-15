// Sugerencia de colores para una categoría nueva: entre una paleta de tonos
// bien repartidos en el círculo cromático, se priorizan los que quedan más
// lejos de los colores que ya usan las categorías existentes. Así una
// categoría nueva no termina con el mismo verde que Alimentos y se distingue
// en la dona, las barras y la lista.

// 16 tonos (cada ~22°), con saturación y luminosidad que se leen bien en
// tema claro y oscuro.
export const PALETA_SUGERIDA = [
  "#e5484d", "#f76b15", "#f5a524", "#d4b106",
  "#8bc34a", "#30a46c", "#12a594", "#0fa3b1",
  "#0090ff", "#3e63dd", "#6e56cf", "#8e4ec6",
  "#ab4aba", "#d6409f", "#e54666", "#a1866f",
];

export function hexARgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// Tono (0-360) y saturación (0-1) en HSL; null si el hex no es válido.
export function tonoDe(hex) {
  const rgb = hexARgb(hex);
  if (!rgb) return null;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

function distanciaTono(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// Devuelve hasta `cantidad` colores de la paleta, del menos parecido al más
// parecido a los ya usados. Los grises (saturación baja) no ocupan tono, así
// que no restan opciones. Un color exactamente igual a uno usado nunca se
// sugiere mientras queden otros.
export function coloresSugeridos(coloresUsados, cantidad = 5, paleta = PALETA_SUGERIDA) {
  const usadosHex = new Set(
    (coloresUsados || []).map((c) => String(c || "").toLowerCase()).filter(Boolean)
  );
  const tonosUsados = [...usadosHex]
    .map(tonoDe)
    .filter((t) => t && t.s >= 0.18)
    .map((t) => t.h);

  const puntuados = paleta.map((hex, i) => {
    const t = tonoDe(hex);
    const lejania = tonosUsados.length
      ? Math.min(...tonosUsados.map((h) => distanciaTono(h, t.h)))
      : 180;
    return { hex, i, lejania, repetido: usadosHex.has(hex.toLowerCase()) };
  });
  puntuados.sort(
    (a, b) => Number(a.repetido) - Number(b.repetido) || b.lejania - a.lejania || a.i - b.i
  );
  return puntuados.slice(0, cantidad).map((p) => p.hex);
}
