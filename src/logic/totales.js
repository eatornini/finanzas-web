const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

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
