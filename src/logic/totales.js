const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Selecciona los movimientos que participan en los totales/resumen,
// replicando la regla de la app Android (debeParticiparEnCalculos):
// - un movimiento activo (o sin dato) siempre cuenta;
// - un inactivo solo cuenta en modo estimado con "incluir inactivos".
export function filtrarParaCalculos(movimientos, { modo, incluirInactivos }) {
  return movimientos.filter((m) => {
    if (m.activo !== false) return true;
    return modo === "estimado" && incluirInactivos === true;
  });
}

export function calcularTotales(movimientos) {
  let ingresos = 0;
  let gastos = 0;
  for (const m of movimientos) {
    const monto = Number(m.monto) || 0;
    if (m.tipo === "ingreso") ingresos += monto;
    else if (m.tipo === "gasto") gastos += monto;
  }
  ingresos = r2(ingresos);
  gastos = r2(gastos);
  return { ingresos, gastos, balance: r2(ingresos - gastos) };
}

// Para el modo estimado: separa lo ya pagado de lo pendiente.
// Cada bloque tiene la misma forma que calcularTotales.
export function desglosarPorPago(movimientos) {
  const pagados = movimientos.filter((m) => m.pagado === true);
  const pendientes = movimientos.filter((m) => m.pagado !== true);
  return {
    total: calcularTotales(movimientos),
    pagado: calcularTotales(pagados),
    pendiente: calcularTotales(pendientes),
  };
}
