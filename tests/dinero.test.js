import { describe, it, expect } from "vitest";
import { formatoCLP, parseCLP } from "../src/logic/dinero.js";

describe("formatoCLP", () => {
  it("formatea enteros con separador de miles es-CL", () => {
    expect(formatoCLP(45000)).toBe("$45.000");
  });
  it("redondea a entero", () => {
    expect(formatoCLP(1234.6)).toBe("$1.235");
  });
  it("trata valores no numéricos como cero", () => {
    expect(formatoCLP(NaN)).toBe("$0");
    expect(formatoCLP(null)).toBe("$0");
    expect(formatoCLP(undefined)).toBe("$0");
  });
});

describe("parseCLP", () => {
  it("extrae el número de un texto con símbolo y puntos", () => {
    expect(parseCLP("$45.000")).toBe(45000);
  });
  it("ignora cualquier caracter no dígito", () => {
    expect(parseCLP("12a3,4 5")).toBe(12345);
  });
  it("devuelve NaN si no hay dígitos", () => {
    expect(Number.isNaN(parseCLP(""))).toBe(true);
    expect(Number.isNaN(parseCLP("abc"))).toBe(true);
  });
});
