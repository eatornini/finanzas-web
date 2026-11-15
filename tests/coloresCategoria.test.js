import { describe, it, expect } from "vitest";
import { coloresSugeridos, tonoDe, PALETA_SUGERIDA } from "../src/logic/coloresCategoria.js";

describe("tonoDe", () => {
  it("calcula el tono de colores puros", () => {
    expect(Math.round(tonoDe("#ff0000").h)).toBe(0);
    expect(Math.round(tonoDe("#00ff00").h)).toBe(120);
    expect(Math.round(tonoDe("#0000ff").h)).toBe(240);
  });
  it("devuelve null con un hex inválido", () => {
    expect(tonoDe("rojo")).toBe(null);
  });
});

describe("coloresSugeridos", () => {
  it("sin categorías, sugiere la paleta en su orden", () => {
    expect(coloresSugeridos([], 3)).toEqual(PALETA_SUGERIDA.slice(0, 3));
  });

  it("evita los tonos ya usados y prioriza los más lejanos", () => {
    // Usados: rojo, naranjo y verde → lo más lejano está entre azul y violeta.
    const sug = coloresSugeridos(["#c0392b", "#e67e22", "#2ecc71"], 3);
    for (const hex of sug) {
      const h = tonoDe(hex).h;
      expect(h).toBeGreaterThan(180);
      expect(h).toBeLessThan(320);
    }
  });

  it("nunca repite un color exacto mientras queden otros", () => {
    const usados = PALETA_SUGERIDA.slice(0, 15);
    expect(coloresSugeridos(usados, 1)).toEqual([PALETA_SUGERIDA[15]]);
  });

  it("los grises no cuentan como tono usado", () => {
    expect(coloresSugeridos(["#7f8c8d", "#8a8f98"], 2)).toEqual(PALETA_SUGERIDA.slice(0, 2));
  });
});
