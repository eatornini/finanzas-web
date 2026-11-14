import { describe, it, expect } from "vitest";
import { ticksAgradables, indicesEtiquetas } from "../src/logic/escalas.js";

describe("ticksAgradables", () => {
  it("cubre un rango con negativos usando pasos redondos e incluye el 0", () => {
    const r = ticksAgradables(-43404, 195576, 5);
    expect(r.paso).toBe(50000);
    expect(r.ticks).toEqual([-50000, 0, 50000, 100000, 150000, 200000]);
    expect(r.min).toBeLessThanOrEqual(-43404);
    expect(r.max).toBeGreaterThanOrEqual(195576);
  });
  it("siempre parte desde 0 cuando todo es positivo", () => {
    const r = ticksAgradables(1000, 2044008, 5);
    expect(r.max).toBe(2500000);
    expect(r.ticks[0]).toBe(0);
    expect(r.ticks.at(-1)).toBeGreaterThanOrEqual(2044008);
  });
  it("tolera rango vacío", () => {
    const r = ticksAgradables(0, 0);
    expect(r.ticks.length).toBeGreaterThanOrEqual(2);
  });
});

describe("indicesEtiquetas", () => {
  it("incluye primero y último y no repite", () => {
    expect(indicesEtiquetas(30, 8)).toEqual([0, 4, 8, 12, 16, 20, 24, 28]);
    expect(indicesEtiquetas(12, 8)).toEqual([0, 2, 4, 6, 8, 10, 11]);
    expect(indicesEtiquetas(3, 7)).toEqual([0, 1, 2]);
    expect(indicesEtiquetas(0, 5)).toEqual([]);
  });
});
