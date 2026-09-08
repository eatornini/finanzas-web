import { describe, it, expect } from "vitest";
import { parsearComprobanteTabular } from "../../src/ocr/comprobanteTabularParser.js";

// Fragmento OCR con bbox. `fila` fija el rango vertical (misma fila visual);
// `x` la posición horizontal para ordenar etiqueta vs valor.
function frag(text, fila, x = 0, ancho = 120) {
  return { text, top: fila * 40, bottom: fila * 40 + 24, height: 24, left: x, right: x + ancho };
}

describe("parsearComprobanteTabular", () => {
  it("voucher POS con etiqueta y valor en el mismo fragmento", () => {
    const lines = [
      frag("Número tarjeta débito ****5925", 0),
      frag("Monto $3.400", 1),
      frag("Fecha 07/09/2026", 2),
      frag("Hora 20:30 horas", 3),
      frag("Comercio TUU*DIERO I", 4),
    ];

    const r = parsearComprobanteTabular(lines);

    expect(r).not.toBeNull();
    expect(r.comercio).toBe("TUU*DIERO I");
    expect(r.monto).toBe(3400);
    expect(r.fecha.getDate()).toBe(7);
    expect(r.fecha.getMonth()).toBe(8);
    expect(r.fecha.getFullYear()).toBe(2026);
    expect(r.fecha.getHours()).toBe(20);
    expect(r.fecha.getMinutes()).toBe(30);
  });

  it("PSM 11: etiqueta y valor en fragmentos separados de la misma fila", () => {
    const lines = [
      frag("Número tarjeta débito", 0, 10),
      frag("****5925", 0, 200),
      frag("Monto", 1, 10),
      frag("$3.400", 1, 200),
      frag("Fecha", 2, 10),
      frag("07/09/2026", 2, 200),
      frag("Hora", 3, 10),
      frag("20:30 horas", 3, 200),
      frag("Comercio", 4, 10),
      frag("TUU*DIERO", 4, 200),
      frag("I", 4, 280), // el token final que el OCR separa
    ];

    const r = parsearComprobanteTabular(lines);

    expect(r.comercio).toBe("TUU*DIERO I");
    expect(r.monto).toBe(3400);
    expect(r.fecha.getHours()).toBe(20);
    expect(r.fecha.getMinutes()).toBe(30);
  });

  it("no confunde el valor de otra fila cuando el orden de líneas viene mezclado", () => {
    // Reproduce el bug: sin geometría, "Monto" agarraba "07/09/2026" -> 7.
    const lines = [
      frag("$3.400", 1, 200),
      frag("Monto", 1, 10),
      frag("07/09/2026", 2, 200),
      frag("Fecha", 2, 10),
      frag("TUU*DIERO", 4, 200),
      frag("I", 4, 280),
      frag("Comercio", 4, 10),
    ];

    const r = parsearComprobanteTabular(lines);

    expect(r.monto).toBe(3400);
    expect(r.comercio).toBe("TUU*DIERO I");
  });

  it("respeta el separador de miles con punto", () => {
    const lines = [frag("Monto: $15.990", 0), frag("Comercio: Farmacia del Barrio", 1)];
    const r = parsearComprobanteTabular(lines);
    expect(r.monto).toBe(15990);
    expect(r.comercio).toBe("Farmacia del Barrio");
  });

  it("separador de miles como espacio ($3 400)", () => {
    const lines = [
      frag("Monto", 0, 10),
      frag("$3 400", 0, 200),
      frag("Comercio", 1, 10),
      frag("Kiosco Sur", 1, 200),
    ];
    const r = parsearComprobanteTabular(lines);
    expect(r.monto).toBe(3400);
  });

  it("sin fecha reconocible: fecha null pero comercio y monto igual salen", () => {
    const lines = [frag("Comercio Kiosco Central", 0), frag("Monto $900", 1)];
    const r = parsearComprobanteTabular(lines);
    expect(r.comercio).toBe("Kiosco Central");
    expect(r.monto).toBe(900);
    expect(r.fecha).toBeNull();
  });

  it("devuelve null si no hay etiqueta 'Comercio' (deja pasar al parser por geometría)", () => {
    const lines = [
      frag("Supermercado Central", 0),
      frag("4 de septiembre a las 19:05", 1),
      frag("Total $8.500", 2),
    ];
    expect(parsearComprobanteTabular(lines)).toBeNull();
  });

  it("devuelve null si hay etiqueta 'Comercio' pero no se reconoce un monto", () => {
    const lines = [frag("Comercio Panadería San José", 0), frag("Gracias por su compra", 1)];
    expect(parsearComprobanteTabular(lines)).toBeNull();
  });

  it("no toma el número de tarjeta enmascarado como monto", () => {
    const lines = [
      frag("Número tarjeta débito", 0, 10),
      frag("****5925", 0, 200),
      frag("Monto", 1, 10),
      frag("$3.400", 1, 200),
      frag("Comercio", 2, 10),
      frag("Almacén Don Juan", 2, 200),
    ];
    const r = parsearComprobanteTabular(lines);
    expect(r.monto).toBe(3400);
  });
});
