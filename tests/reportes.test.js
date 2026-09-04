import { describe, it, expect } from "vitest";
import { fechasTendencia, calcularVariacion } from "../src/logic/reportes.js";

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
