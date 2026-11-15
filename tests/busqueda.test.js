import { describe, it, expect } from "vitest";
import {
  textoBusqueda,
  filtroTextoMovimientos,
  montoBusqueda,
  rangoBusqueda,
  aniosDisponibles,
  partesResaltadas,
} from "../src/logic/busqueda.js";

describe("textoBusqueda", () => {
  it("limpia comodines y comillas, y exige 2 caracteres", () => {
    expect(textoBusqueda("  riko   pollo ")).toBe("riko pollo");
    expect(textoBusqueda('50%_off"')).toBe("50 off");
    expect(textoBusqueda("a")).toBe(null);
    expect(textoBusqueda("")).toBe(null);
  });
});

describe("filtroTextoMovimientos", () => {
  it("busca en nombre o detalle con el valor entre comillas", () => {
    expect(filtroTextoMovimientos("almuerzo, amigos")).toBe(
      'nombre.ilike."%almuerzo, amigos%",detalle.ilike."%almuerzo, amigos%"'
    );
    expect(filtroTextoMovimientos("x")).toBe(null);
  });
  it("si el texto es un monto, también busca ese monto exacto", () => {
    expect(filtroTextoMovimientos("15990")).toBe(
      'nombre.ilike."%15990%",detalle.ilike."%15990%",monto.eq.15990'
    );
    expect(filtroTextoMovimientos("$15.990")).toBe(
      'nombre.ilike."%$15.990%",detalle.ilike."%$15.990%",monto.eq.15990'
    );
  });
});

describe("montoBusqueda", () => {
  it("reconoce montos con o sin $ y separador de miles", () => {
    expect(montoBusqueda("15990")).toBe(15990);
    expect(montoBusqueda("15.990")).toBe(15990);
    expect(montoBusqueda("$ 1.250.000")).toBe(1250000);
  });
  it("ignora lo que no es solo un monto", () => {
    expect(montoBusqueda("uber 5000")).toBe(null);
    expect(montoBusqueda("12.5")).toBe(null);
    expect(montoBusqueda("")).toBe(null);
  });
});

describe("rangoBusqueda", () => {
  it("año completo", () => {
    expect(rangoBusqueda({ anio: 2025 })).toEqual({ desde: "2025-01-01", hasta: "2025-12-31" });
  });
  it("año y mes (incluye bisiestos)", () => {
    expect(rangoBusqueda({ anio: 2024, mes: 2 })).toEqual({ desde: "2024-02-01", hasta: "2024-02-29" });
    expect(rangoBusqueda({ anio: 2026, mes: 11 })).toEqual({ desde: "2026-11-01", hasta: "2026-11-30" });
  });
  it("el rango manual tiene prioridad y se ordena", () => {
    expect(rangoBusqueda({ anio: 2025, desde: "2026-03-10", hasta: "2026-01-01" })).toEqual({
      desde: "2026-01-01",
      hasta: "2026-03-10",
    });
    expect(rangoBusqueda({ desde: "2026-03-10" })).toEqual({ desde: "2026-03-10", hasta: null });
  });
  it("sin filtros no limita", () => {
    expect(rangoBusqueda({})).toEqual({ desde: null, hasta: null });
  });
});

describe("aniosDisponibles", () => {
  it("del actual al del primer movimiento", () => {
    expect(aniosDisponibles("2024-05-02", new Date(2026, 10, 15))).toEqual([2026, 2025, 2024]);
    expect(aniosDisponibles(null, new Date(2026, 10, 15))).toEqual([2026]);
  });
});

describe("partesResaltadas", () => {
  it("marca las coincidencias sin importar mayúsculas ni tildes", () => {
    expect(partesResaltadas("Almuerzo en Café Riko", "cafe")).toEqual([
      { texto: "Almuerzo en ", coincide: false },
      { texto: "Café", coincide: true },
      { texto: " Riko", coincide: false },
    ]);
  });
  it("sin consulta devuelve el texto completo", () => {
    expect(partesResaltadas("Riko", "")).toEqual([{ texto: "Riko", coincide: false }]);
  });
});
