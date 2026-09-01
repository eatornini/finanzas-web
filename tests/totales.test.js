import { describe, it, expect } from "vitest";
import { calcularTotales, desglosarPorPago } from "../src/logic/totales.js";

describe("calcularTotales", () => {
  it("lista vacía da todo en cero", () => {
    expect(calcularTotales([])).toEqual({ ingresos: 0, gastos: 0, balance: 0 });
  });

  it("suma ingresos y gastos y calcula el balance", () => {
    const movs = [
      { monto: 100, tipo: "ingreso" },
      { monto: 30, tipo: "gasto" },
      { monto: 20.5, tipo: "gasto" },
    ];
    expect(calcularTotales(movs)).toEqual({ ingresos: 100, gastos: 50.5, balance: 49.5 });
  });

  it("redondea a 2 decimales evitando errores de punto flotante", () => {
    const movs = [
      { monto: 0.1, tipo: "gasto" },
      { monto: 0.2, tipo: "gasto" },
    ];
    expect(calcularTotales(movs)).toEqual({ ingresos: 0, gastos: 0.3, balance: -0.3 });
  });

  it("solo ingresos", () => {
    expect(calcularTotales([{ monto: 500, tipo: "ingreso" }])).toEqual({
      ingresos: 500,
      gastos: 0,
      balance: 500,
    });
  });

  it("balance negativo cuando los gastos superan a los ingresos", () => {
    const movs = [
      { monto: 10, tipo: "ingreso" },
      { monto: 40, tipo: "gasto" },
    ];
    expect(calcularTotales(movs).balance).toBe(-30);
  });

  it("acepta monto como string y descarta tipos desconocidos", () => {
    const movs = [
      { monto: "15.75", tipo: "ingreso" },
      { monto: 5, tipo: "otro" },
    ];
    expect(calcularTotales(movs)).toEqual({ ingresos: 15.75, gastos: 0, balance: 15.75 });
  });
});

describe("desglosarPorPago", () => {
  it("lista vacía: total, pagado y pendiente en cero", () => {
    expect(desglosarPorPago([])).toEqual({
      total: { ingresos: 0, gastos: 0, balance: 0 },
      pagado: { ingresos: 0, gastos: 0, balance: 0 },
      pendiente: { ingresos: 0, gastos: 0, balance: 0 },
    });
  });

  it("separa pagados de pendientes y el total es la suma de ambos", () => {
    const movs = [
      { monto: 2000, tipo: "ingreso", pagado: true },
      { monto: 500, tipo: "gasto", pagado: true },
      { monto: 300, tipo: "gasto", pagado: false },
      { monto: 100, tipo: "ingreso", pagado: false },
    ];
    const d = desglosarPorPago(movs);
    expect(d.pagado).toEqual({ ingresos: 2000, gastos: 500, balance: 1500 });
    expect(d.pendiente).toEqual({ ingresos: 100, gastos: 300, balance: -200 });
    expect(d.total).toEqual({ ingresos: 2100, gastos: 800, balance: 1300 });
  });

  it("trata pagado ausente o falsy como pendiente", () => {
    const movs = [
      { monto: 50, tipo: "gasto" },
      { monto: 50, tipo: "gasto", pagado: null },
    ];
    const d = desglosarPorPago(movs);
    expect(d.pendiente.gastos).toBe(100);
    expect(d.pagado.gastos).toBe(0);
  });
});
