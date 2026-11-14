import { describe, it, expect } from "vitest";
import { parsearComprobanteTabular } from "../../src/ocr/comprobanteTabularParser.js";

// Fragmento OCR con bbox. `fila` fija el rango vertical (misma fila visual);
// `x` la posición horizontal para ordenar etiqueta vs valor.
function frag(text, fila, x = 0, ancho = 120) {
  return { text, top: fila * 40, bottom: fila * 40 + 24, height: 24, left: x, right: x + ancho };
}

describe("parsearComprobanteTabular", () => {
  it("detalle de compra BCI sin monto: carga comercio, fecha y hora", () => {
    // Salida real PSM 11: la etiqueta de hora llega partida ("Hora de" /
    // "compr") y no hay ninguna etiqueta de monto en el comprobante.
    const lines = [
      frag("Fecha de la compra:", 0, 10, 150),
      frag("08/11/2026", 0, 200),
      frag("Hora de", 1, 10, 60),
      frag("17:01", 1, 200, 50),
      frag("compr", 1.3, 80, 50),
      frag("09/11/2026", 2, 200),
      frag("Fecha contable OQ)", 2, 10, 150),
      frag("Tipo de compra:", 3, 10, 150),
      frag("Presencial", 3, 200),
      frag("Nombre del comercio:", 4, 10, 150),
      frag("RESTAURANTE PARRICALAMA CHL", 4, 200, 250),
      frag("Rubro:", 5, 10, 60),
      frag("Restaurantes", 5, 200),
      frag("RUS", 6, 10, 40),
      frag("-0", 6, 200, 20),
      frag("Nacional", 7, 200),
      frag("N? de terjeta:", 8, 10, 150),
      frag("446% 5925", 8, 200),
      frag("Código transacción:", 9, 10, 150),
      frag("212660931661243495", 9, 200, 180),
    ];

    const r = parsearComprobanteTabular(lines);

    expect(r).not.toBeNull();
    expect(r.comercio).toBe("RESTAURANTE PARRICALAMA CHL");
    expect(r.monto).toBeNull();
    expect(r.montoAusente).toBe(true);
    expect(r.fecha.getDate()).toBe(8);
    expect(r.fecha.getMonth()).toBe(10);
    expect(r.fecha.getFullYear()).toBe(2026);
    expect(r.fecha.getHours()).toBe(17);
    expect(r.fecha.getMinutes()).toBe(1);
  });

  it("detalle BCI con la fila del movimiento arriba: toma el $ sin etiqueta", () => {
    const lines = [
      frag("08/11/2026", 0, 10, 80),
      frag("Compra con Tarjeta de Débito en", 0, 140, 200),
      frag("CRUZ VERDE", 0.6, 140, 80),
      frag("$4.990", 0, 420, 50),
      frag("Detalle del movimiento", 2, 30, 200),
      frag("Fecha de la compra:", 3, 50, 150),
      frag("08/11/2026", 3, 210),
      frag("Hora de la compra:", 4, 50, 150),
      frag("18:19", 4, 210, 50),
      frag("Fecha contable", 5, 50, 150),
      frag("09/11/2026", 5, 210),
      frag("Tipo de compra:", 6, 50, 150),
      frag("Presencial", 6, 210),
      frag("Nombre del comercio:", 7, 50, 150),
      frag("CRUZ VERDE", 7, 210),
      frag("Rubro:", 8, 50, 60),
      frag("Farmacias", 8, 210),
      frag("RUT:", 9, 50, 40),
      frag("89.807.200-2", 9, 210),
      frag("Comuna:", 10, 50, 60),
      frag("Calama", 10, 210),
      frag("Tipo de movimiento:", 11, 50, 150),
      frag("Nacional", 11, 210),
      frag("N° de tarjeta:", 12, 50, 150),
      frag("**** 5925", 12, 210),
      frag("Código transacción:", 13, 50, 150),
      frag("212660936346154845", 13, 210, 180),
    ];

    const r = parsearComprobanteTabular(lines);

    expect(r.comercio).toBe("CRUZ VERDE");
    expect(r.monto).toBe(4990);
    expect(r.montoAusente).toBeUndefined();
    expect(r.fecha.getDate()).toBe(8);
    expect(r.fecha.getHours()).toBe(18);
    expect(r.fecha.getMinutes()).toBe(19);
  });

  it("con etiqueta de monto ilegible no devuelve resultado sin monto", () => {
    const lines = [
      frag("Comercio", 0, 10),
      frag("TUU*DIERO", 0, 200),
      frag("Monto", 1, 10),
      frag("$", 1, 200, 10),
      frag("Fecha", 2, 10),
      frag("07/09/2026", 2, 200),
    ];
    expect(parsearComprobanteTabular(lines)).toBeNull();
  });

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

describe("parsearComprobanteTabular — monto en la fila del movimiento BCI", () => {
  function frag(text, fila, x = 0, ancho = 120) {
    return { text, top: fila * 40, bottom: fila * 40 + 24, height: 24, left: x, right: x + ancho };
  }
  const base = (montoTexto) => [
    frag("Compra con Tarjeta de Débito en RIKO", 0, 140, 230),
    frag("POLLO 11001SANTIAGCHL", 0.6, 140, 160),
    ...(montoTexto ? [frag(montoTexto, 0, 420, 50)] : []),
    frag("Fecha de la compra:", 3, 50, 150),
    frag("08/11/2026", 3, 210),
    frag("Nombre del comercio:", 7, 50, 150),
    frag("RIKO POLLO 11001SANTIAGCHL", 7, 210, 220),
    frag("RUT:", 8, 50, 40),
    frag("89.807.200-2", 8, 210),
    frag("Código transacción:", 10, 50, 150),
    frag("212660943953106644", 10, 210, 180),
  ];

  it.each([["$4.100"], ["S4.100"], ["§4.100"], ["$ 4.100"], ["4.100"]])(
    "lee %s como 4100",
    (texto) => {
      const r = parsearComprobanteTabular(base(texto));
      expect(r.monto).toBe(4100);
      expect(r.montoAusente).toBeUndefined();
    }
  );

  it("no confunde RUT ni código de transacción con el monto", () => {
    const r = parsearComprobanteTabular(base(null));
    expect(r.monto).toBeNull();
    expect(r.montoAusente).toBe(true);
  });
});
