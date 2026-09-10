import { describe, it, expect } from "vitest";
import { agruparPorFecha, agruparPorCategoria } from "../src/logic/agrupacionMovimientos.js";

describe("agruparPorFecha", () => {
  it("lista vacía da sin grupos", () => {
    expect(agruparPorFecha([])).toEqual([]);
  });

  it("agrupa por fecha_local, preservando el orden de entrada", () => {
    const movs = [
      { id: 1, fecha_local: "2026-09-04", fecha: "2026-09-04T10:00:00" },
      { id: 2, fecha_local: "2026-09-04", fecha: "2026-09-04T15:00:00" },
      { id: 3, fecha_local: "2026-09-03", fecha: "2026-09-03T09:00:00" },
    ];
    const grupos = agruparPorFecha(movs);
    expect(grupos.map((g) => g.clave)).toEqual(["2026-09-04", "2026-09-03"]);
    expect(grupos[0].movimientos.map((m) => m.id)).toEqual([1, 2]);
    expect(grupos[1].movimientos.map((m) => m.id)).toEqual([3]);
  });

  it("usa fecha_local y no la parte UTC de fecha para movimientos nocturnos", () => {
    // 21:10 en Chile (UTC-3) => 00:10 UTC del día siguiente. Debe agrupar
    // bajo el día chileno (fecha_local), no bajo el día UTC.
    const movs = [
      { id: 1, fecha_local: "2026-09-09", fecha: "2026-09-10T00:10:00.000Z" },
    ];
    const grupos = agruparPorFecha(movs);
    expect(grupos.map((g) => g.clave)).toEqual(["2026-09-09"]);
  });

  it("cae a los primeros 10 caracteres de fecha si falta fecha_local", () => {
    const movs = [{ id: 1, fecha: "2026-09-04T10:00:00" }];
    const grupos = agruparPorFecha(movs);
    expect(grupos.map((g) => g.clave)).toEqual(["2026-09-04"]);
  });
});

describe("agruparPorCategoria", () => {
  it("lista vacía da sin grupos", () => {
    expect(agruparPorCategoria([])).toEqual([]);
  });

  it("agrupa por categoria_id y ordena los grupos alfabéticamente por nombre", () => {
    const movs = [
      { id: 1, categoria_id: "b", categoria: { nombre: "Luz" } },
      { id: 2, categoria_id: "a", categoria: { nombre: "Arriendo" } },
      { id: 3, categoria_id: "a", categoria: { nombre: "Arriendo" } },
    ];
    const grupos = agruparPorCategoria(movs);
    expect(grupos.map((g) => g.nombre)).toEqual(["Arriendo", "Luz"]);
    expect(grupos[0].movimientos.map((m) => m.id)).toEqual([2, 3]);
  });

  it("agrupa sin categoría bajo 'Sin categoría'", () => {
    const movs = [{ id: 1, categoria_id: null, categoria: null }];
    const grupos = agruparPorCategoria(movs);
    expect(grupos).toEqual([{ clave: "sin", nombre: "Sin categoría", movimientos: movs }]);
  });
});
