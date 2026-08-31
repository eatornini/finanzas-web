import { describe, it, expect } from "vitest";
import { calcularTotales } from "../src/logic/totales.js";

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
