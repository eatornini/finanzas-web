import { describe, it, expect } from "vitest";
import { parsearCompra } from "../../src/ocr/purchaseExtractor.js";

function bloque(texto, top, bottom, height = 22) {
  return { lines: [{ text: texto, top, bottom, height, left: 0, right: 300 }], top, bottom, left: 0, right: 300 };
}

// Simula un bloque de Tesseract donde el párrafo agrupó dos líneas de
// tamaño de fuente muy distinto (ej. prefijo "CLP" chico + número enorme).
function bloqueMultilinea(textos, top, bottom) {
  const paso = (bottom - top) / textos.length;
  const lines = textos.map((text, i) => ({
    text,
    top: top + i * paso,
    bottom: top + (i + 1) * paso,
    height: paso,
    left: 0,
    right: 300,
  }));
  return { lines, top, bottom, left: 0, right: 300 };
}

describe("parsearCompra", () => {
  it("extrae comercio, monto y fecha de una boleta típica", () => {
    const bloques = [
      bloque("Movistar", 5, 20),
      bloque("Supermercado Central", 100, 130),
      bloque("4 de septiembre a las 19:05", 140, 165),
      bloque("Total $8.500", 200, 230),
    ];
    const lineas = bloques.flatMap((b) => b.lines);

    const r = parsearCompra(lineas, bloques);

    expect(r.comercio).toBe("Supermercado Central");
    expect(r.monto).toBe(8500);
    expect(r.fecha).toBeInstanceOf(Date);
    expect(r.fecha.getDate()).toBe(4);
    expect(r.fecha.getMonth()).toBe(8); // septiembre
    expect(r.fecha.getHours()).toBe(19);
    expect(r.fecha.getMinutes()).toBe(5);
  });

  it("respeta el separador de miles con punto (no trunca el monto)", () => {
    const bloques = [bloque("Farmacia del Barrio", 100, 130), bloque("Total CLP 15.990", 200, 230)];
    const lineas = bloques.flatMap((b) => b.lines);
    const r = parsearCompra(lineas, bloques);
    expect(r.monto).toBe(15990);
  });

  it("boleta sin fecha reconocible: fecha null pero comercio/monto igual se extraen", () => {
    const bloques = [bloque("Café Central", 100, 130), bloque("Total $3.200", 200, 230)];
    const lineas = bloques.flatMap((b) => b.lines);
    const r = parsearCompra(lineas, bloques);
    expect(r.comercio).toBe("Café Central");
    expect(r.monto).toBe(3200);
    expect(r.fecha).toBeNull();
  });

  it("descarta bloques de ruido (operador, fecha/hora) como comercio", () => {
    const bloques = [
      bloque("Entel", 5, 18),
      bloque("15/03/2026", 40, 55),
      bloque("Comercio Real", 100, 130),
      bloque("Total $1.000", 200, 230),
    ];
    const lineas = bloques.flatMap((b) => b.lines);
    const r = parsearCompra(lineas, bloques);
    expect(r.comercio).toBe("Comercio Real");
  });

  it("recibo estilo Google Wallet: 'sept' abreviado y monto partido en dos líneas del mismo bloque", () => {
    const bloques = [
      bloque("JOEL VEGA PEREIRA", 5, 40),
      bloqueMultilinea(["CLP", "1,350"], 60, 160),
      bloque("jueves, 3 de sept a las 21:24", 180, 200),
    ];
    const lineas = bloques.flatMap((b) => b.lines);
    const r = parsearCompra(lineas, bloques);
    expect(r.monto).toBe(1350);
    expect(r.fecha).toBeInstanceOf(Date);
    expect(r.fecha.getDate()).toBe(3);
    expect(r.fecha.getMonth()).toBe(8); // septiembre
    expect(r.fecha.getHours()).toBe(21);
    expect(r.fecha.getMinutes()).toBe(24);
  });

  it("sin ningún bloque de monto: comercio null", () => {
    const bloques = [bloque("Solo texto", 100, 130)];
    const lineas = bloques.flatMap((b) => b.lines);
    const r = parsearCompra(lineas, bloques);
    expect(r.monto).toBeNull();
    expect(r.comercio).toBeNull();
  });
});
