// Agrupa una lista de movimientos ya filtrada, preservando el orden de
// aparición tanto de los grupos como de los movimientos dentro de cada uno
// (no reordena nada — quien llama decide el orden de entrada).

export function agruparPorFecha(movimientos) {
  const grupos = [];
  const indice = new Map();
  for (const m of movimientos) {
    const clave = (m.fecha || "").slice(0, 10);
    let grupo = indice.get(clave);
    if (!grupo) {
      grupo = { clave, movimientos: [] };
      indice.set(clave, grupo);
      grupos.push(grupo);
    }
    grupo.movimientos.push(m);
  }
  return grupos;
}

// Por categoría, ordenado alfabéticamente (a diferencia de agruparPorFecha,
// que preserva el orden cronológico de entrada — acá no hay un orden
// "natural" en los datos que valga la pena preservar).
export function agruparPorCategoria(movimientos) {
  const grupos = [];
  const indice = new Map();
  for (const m of movimientos) {
    const clave = m.categoria_id || "sin";
    let grupo = indice.get(clave);
    if (!grupo) {
      grupo = { clave, nombre: m.categoria ? m.categoria.nombre : "Sin categoría", movimientos: [] };
      indice.set(clave, grupo);
      grupos.push(grupo);
    }
    grupo.movimientos.push(m);
  }
  grupos.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return grupos;
}
