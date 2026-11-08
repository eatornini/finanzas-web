import { describe, it, expect } from "vitest";
import { nombreVisible, etiquetaRelativaDia, diasTranscurridos } from "../src/logic/presentacion.js";

describe("nombreVisible", () => {
  it("pasa a formato título los nombres de varias palabras en mayúsculas", () => {
    expect(nombreVisible("RIKO POLLO")).toBe("Riko Pollo");
    expect(nombreVisible("PAULINA SONIA ARONI N")).toBe("Paulina Sonia Aroni N");
    expect(nombreVisible("CAFÉ ÑUÑOA")).toBe("Café Ñuñoa");
  });
  it("deja igual siglas y nombres que ya tienen minúsculas", () => {
    expect(nombreVisible("AIEP")).toBe("AIEP");
    expect(nombreVisible("VISA Nacional")).toBe("VISA Nacional");
    expect(nombreVisible("funKids")).toBe("funKids");
  });
  it("respeta palabras con números y valores vacíos", () => {
    expect(nombreVisible("CUOTA 3 DE 12")).toBe("Cuota 3 De 12");
    expect(nombreVisible("")).toBe("");
    expect(nombreVisible(null)).toBe("");
  });
});

describe("etiquetaRelativaDia", () => {
  const hoy = new Date(2026, 10, 2, 9);
  it("reconoce hoy y ayer", () => {
    expect(etiquetaRelativaDia("2026-11-02", hoy)).toBe("Hoy");
    expect(etiquetaRelativaDia("2026-11-01T12:00:00", hoy)).toBe("Ayer");
    expect(etiquetaRelativaDia("2026-10-31", hoy)).toBe(null);
  });
  it("cruza cambio de mes", () => {
    expect(etiquetaRelativaDia("2026-10-31", new Date(2026, 10, 1))).toBe("Ayer");
  });
});

describe("diasTranscurridos", () => {
  const nov = { desde: "2026-11-01", hasta: "2026-11-30" };
  it("cuenta hasta hoy dentro del período", () => {
    expect(diasTranscurridos(nov, new Date(2026, 10, 2))).toBe(2);
  });
  it("0 antes del período y el total después", () => {
    expect(diasTranscurridos(nov, new Date(2026, 9, 20))).toBe(0);
    expect(diasTranscurridos(nov, new Date(2026, 11, 5))).toBe(30);
  });
});
