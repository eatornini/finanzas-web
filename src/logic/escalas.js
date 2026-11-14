// Escalas "redondas" para los ejes de los gráficos (sin librerías): en vez
// de rotular el eje con el mínimo/máximo exacto de los datos ($195,6 k,
// $-43,4 k), se elige un paso redondo (1, 2 o 5 × 10^n) y marcas parejas
// que cubren todo el rango. El dominio del gráfico pasa a ser [primera,
// última] marca, así los datos nunca quedan fuera ni pegados al borde.
function pasoRedondo(bruto) {
  if (!(bruto > 0)) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(bruto)));
  const f = bruto / exp;
  const lindo = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return lindo * exp;
}

export function ticksAgradables(min, max, cantidad = 4) {
  let lo = Math.min(0, Number(min) || 0);
  let hi = Math.max(0, Number(max) || 0);
  if (hi === lo) hi = lo + 1;
  const paso = pasoRedondo((hi - lo) / cantidad);
  const desde = Math.floor(lo / paso) * paso;
  const hasta = Math.ceil(hi / paso) * paso;
  const ticks = [];
  for (let v = desde; v <= hasta + paso / 2; v += paso) ticks.push(Math.round(v * 100) / 100);
  return { ticks, min: desde, max: hasta, paso };
}

// Índices para rotular un eje X de `n` puntos con a lo más `max`
// etiquetas, con un paso ENTERO (1, 3, 5... días a la misma distancia) en
// vez de saltos irregulares. El último punto se agrega solo si no queda
// pegado al anterior.
export function indicesEtiquetas(n, max) {
  if (n <= 0) return [];
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  const paso = Math.ceil(n / max);
  const indices = [];
  for (let i = 0; i < n; i += paso) indices.push(i);
  const ultimo = n - 1;
  if (indices[indices.length - 1] !== ultimo && ultimo - indices[indices.length - 1] >= paso / 2) {
    indices.push(ultimo);
  }
  return indices;
}
