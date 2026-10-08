import { describe, it, expect } from "vitest";
import {
  fechasTendencia,
  calcularVariacion,
  diasEnRango,
  progresoPeriodo,
  serieAcumulada,
  proyectarCierre,
} from "../src/logic/reportes.js";

describe("fechasTendencia", () => {
  it("devuelve `cantidad` fechas terminando en fechaRef", () => {
    const ref = new Date(2026, 8, 1);
    const fechas = fechasTendencia(ref, "mes", 6);
    expect(fechas).toHaveLength(6);
    expect(fechas[5].getMonth()).toBe(8);
    expect(fechas[5].getFullYear()).toBe(2026);
  });

  it("orden cronológico ascendente, un mes de diferencia entre cada una", () => {
    const ref = new Date(2026, 8, 1);
    const fechas = fechasTendencia(ref, "mes", 3);
    expect(fechas[0].getMonth()).toBe(6); // julio
    expect(fechas[1].getMonth()).toBe(7); // agosto
    expect(fechas[2].getMonth()).toBe(8); // septiembre
  });

  it("funciona con tipo año", () => {
    const ref = new Date(2026, 0, 1);
    const fechas = fechasTendencia(ref, "año", 3);
    expect(fechas.map((f) => f.getFullYear())).toEqual([2024, 2025, 2026]);
  });
});

describe("calcularVariacion", () => {
  it("caso normal: sube", () => {
    expect(calcularVariacion(150, 100)).toEqual({ diferencia: 50, porcentaje: 50 });
  });

  it("caso normal: baja", () => {
    expect(calcularVariacion(80, 100)).toEqual({ diferencia: -20, porcentaje: -20 });
  });

  it("anterior en cero y actual en cero: diferencia 0, porcentaje null", () => {
    expect(calcularVariacion(0, 0)).toEqual({ diferencia: 0, porcentaje: null });
  });

  it("anterior en cero y actual positivo: porcentaje null (no Infinity)", () => {
    const r = calcularVariacion(50, 0);
    expect(r.diferencia).toBe(50);
    expect(r.porcentaje).toBeNull();
  });
});

describe("diasEnRango", () => {
  it("cuenta inclusive ambos extremos", () => {
    expect(diasEnRango("2026-09-01", "2026-09-30")).toBe(30);
    expect(diasEnRango("2026-09-21", "2026-09-21")).toBe(1);
  });
});

describe("progresoPeriodo", () => {
  const rango = { desde: "2026-09-01", hasta: "2026-09-30" };

  it("período en curso: hoy cae dentro del rango", () => {
    const r = progresoPeriodo(rango, "2026-09-21");
    expect(r).toEqual({ diasTotales: 30, diaCorte: 21, pct: 70, enCurso: true });
  });

  it("período cerrado: hoy es posterior al rango", () => {
    const r = progresoPeriodo(rango, "2026-10-05");
    expect(r).toEqual({ diasTotales: 30, diaCorte: 30, pct: 100, enCurso: false });
  });

  it("período futuro: hoy es anterior al rango", () => {
    const r = progresoPeriodo(rango, "2026-08-15");
    expect(r).toEqual({ diasTotales: 30, diaCorte: 0, pct: 0, enCurso: false });
  });
});

describe("serieAcumulada", () => {
  const rango = { desde: "2026-09-01", hasta: "2026-09-05" };
  const movimientos = [
    { tipo: "ingreso", monto: 1000, fecha_local: "2026-09-01" },
    { tipo: "gasto", monto: 300, fecha_local: "2026-09-02" },
    { tipo: "gasto", monto: 200, fecha_local: "2026-09-04" },
  ];

  it("acumula día por día sin inventar movimientos en días sin datos", () => {
    const serie = serieAcumulada(movimientos, rango, 5);
    expect(serie).toHaveLength(5);
    expect(serie[0]).toMatchObject({ dia: 1, ingresos: 1000, gastos: 0, balance: 1000 });
    expect(serie[1]).toMatchObject({ dia: 2, ingresos: 1000, gastos: 300, balance: 700 });
    expect(serie[2]).toMatchObject({ dia: 3, ingresos: 1000, gastos: 300, balance: 700 });
    expect(serie[3]).toMatchObject({ dia: 4, ingresos: 1000, gastos: 500, balance: 500 });
    expect(serie[4]).toMatchObject({ dia: 5, ingresos: 1000, gastos: 500, balance: 500 });
  });
});

describe("proyectarCierre", () => {
  it("extiende linealmente el ritmo diario observado", () => {
    expect(proyectarCierre(700, 7, 30)).toBe(3000);
  });

  it("null si todavía no hay ningún día con datos", () => {
    expect(proyectarCierre(0, 0, 30)).toBeNull();
  });
});
