// Búsqueda por substring sobre un mapa nombre->caracter de iconos Material
// Symbols (el subset completo). Separado del DOM para poder testearlo.
export function buscarIconos(mapa, consulta, limite = 30) {
  const q = consulta.trim().toLowerCase().replace(/\s+/g, "_");
  if (!q) return [];

  const empieza = [];
  const contiene = [];
  for (const nombre of Object.keys(mapa)) {
    if (nombre.startsWith(q)) empieza.push(nombre);
    else if (nombre.includes(q)) contiene.push(nombre);
  }
  empieza.sort();
  contiene.sort();

  return [...empieza, ...contiene]
    .slice(0, limite)
    .map((nombre) => ({ nombre, caracter: mapa[nombre] }));
}
