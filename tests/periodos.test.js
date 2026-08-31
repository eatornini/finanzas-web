import { describe, it, expect } from "vitest";
import {
  rangoPeriodo,
  periodoAnterior,
  periodoSiguiente,
  etiquetaPeriodo,
} from "../src/logic/periodos.js";

// Nota: los meses de Date() son base 0 (7 = agosto).

describe("rangoPeriodo - mes", () => {
  it("mes normal", () => {
    expect(rangoPeriodo(new Date(2026, 7, 15), "mes")).toEqual({
      desde: "2026-08-01",
      hasta: "2026-08-31",
    });
  });
  it("febrero en año bisiesto", () => {
    expect(rangoPeriodo(new Date(2024, 1, 10), "mes")).toEqual({
      desde: "2024-02-01",
      hasta: "2024-02-29",
    });
  });
  it("febrero en año no bisiesto", () => {
    expect(rangoPeriodo(new Date(2026, 1, 10), "mes")).toEqual({
      desde: "2026-02-01",
      hasta: "2026-02-28",
    });
  });
});

describe("rangoPeriodo - año", () => {
  it("cubre todo el año", () => {
    expect(rangoPeriodo(new Date(2026, 4, 20), "año")).toEqual({
      desde: "2026-01-01",
      hasta: "2026-12-31",
    });
  });
});

describe("rangoPeriodo - semana (lunes a domingo)", () => {
  it("semana que empieza un lunes y cruza de mes", () => {
    // 2026-08-31 es lunes
    expect(rangoPeriodo(new Date(2026, 7, 31), "semana")).toEqual({
      desde: "2026-08-31",
      hasta: "2026-09-06",
    });
  });
  it("referencia a mitad de semana", () => {
    // 2026-08-12 es miércoles -> lunes 2026-08-10
    expect(rangoPeriodo(new Date(2026, 7, 12), "semana")).toEqual({
      desde: "2026-08-10",
      hasta: "2026-08-16",
    });
  });
  it("semana que cruza de año", () => {
    // 2026-12-30 es miércoles -> lunes 2026-12-28
    expect(rangoPeriodo(new Date(2026, 11, 30), "semana")).toEqual({
      desde: "2026-12-28",
      hasta: "2027-01-03",
    });
  });
});

describe("periodoAnterior / periodoSiguiente", () => {
  const ymd = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  it("mes siguiente cruzando de año", () => {
    expect(ymd(periodoSiguiente(new Date(2026, 11, 15), "mes"))).toBe("2027-01-01");
  });
  it("mes anterior cruzando de año", () => {
    expect(ymd(periodoAnterior(new Date(2026, 0, 10), "mes"))).toBe("2025-12-01");
  });
  it("semana siguiente suma 7 días", () => {
    expect(ymd(periodoSiguiente(new Date(2026, 7, 31), "semana"))).toBe("2026-09-07");
  });
  it("semana anterior resta 7 días cruzando de año", () => {
    expect(ymd(periodoAnterior(new Date(2026, 0, 3), "semana"))).toBe("2025-12-27");
  });
  it("año siguiente normaliza al 1 de enero", () => {
    expect(ymd(periodoSiguiente(new Date(2026, 5, 1), "año"))).toBe("2027-01-01");
  });
});

describe("etiquetaPeriodo", () => {
  it("mes", () => {
    expect(etiquetaPeriodo(new Date(2026, 7, 10), "mes")).toBe("agosto 2026");
  });
  it("año", () => {
    expect(etiquetaPeriodo(new Date(2026, 7, 10), "año")).toBe("2026");
  });
  it("semana dentro del mismo mes", () => {
    expect(etiquetaPeriodo(new Date(2026, 7, 12), "semana")).toBe("10–16 ago 2026");
  });
  it("semana que cruza de mes", () => {
    expect(etiquetaPeriodo(new Date(2026, 7, 31), "semana")).toBe("31 ago – 6 sep 2026");
  });
  it("semana que cruza de año", () => {
    expect(etiquetaPeriodo(new Date(2026, 11, 30), "semana")).toBe(
      "28 dic 2026 – 3 ene 2027"
    );
  });
});

describe("tipo inválido", () => {
  it("lanza error", () => {
    expect(() => rangoPeriodo(new Date(2026, 0, 1), "quincena")).toThrow();
  });
});
