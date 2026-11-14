import { describe, it, expect } from "vitest";
import { analizarComprobante } from "../../src/ocr/ocrManager.js";

function bloque(texto, top, bottom, height = 22) {
  return { lines: [{ text: texto, top, bottom, height, left: 0, right: 300 }], top, bottom, left: 0, right: 300 };
}

describe("analizarComprobante", () => {
  it("clasifica y parsea una transferencia", () => {
    const bloques = [
      bloque("Transferencia exitosa", 0, 20),
      bloque("Comprobante de transferencia", 25, 45),
      bloque("Para", 50, 70),
      bloque("Juan Pérez", 75, 95),
      bloque("Monto transferido $15.000", 100, 120),
    ];
    const lineas = bloques.flatMap((b) => b.lines);

    const r = analizarComprobante({ lineas, bloques });

    expect(r.tipo).toBe("transferencia");
    expect(r.comercio).toBe("Juan Pérez");
    expect(r.monto).toBe(15000);
  });

  it("clasifica y parsea una compra", () => {
    const bloques = [
      bloque("Café Central", 100, 130),
      bloque("Total $3.500", 200, 230),
      bloque("Gracias por tu compra", 240, 260),
    ];
    const lineas = bloques.flatMap((b) => b.lines);

    const r = analizarComprobante({ lineas, bloques });

    expect(r.tipo).toBe("compra");
    expect(r.comercio).toBe("Café Central");
    expect(r.monto).toBe(3500);
    expect(r.detalle).toBeNull();
  });

  it("saca el prefijo TUU* del comercio en una compra", () => {
    const bloques = [
      bloque("TUU*Café Central", 100, 130),
      bloque("Total $3.500", 200, 230),
      bloque("Gracias por tu compra", 240, 260),
    ];
    const lineas = bloques.flatMap((b) => b.lines);

    const r = analizarComprobante({ lineas, bloques });

    expect(r.comercio).toBe("Café Central");
  });

  it("parsea un voucher POS con tabla etiqueta / valor y saca el prefijo TUU*", () => {
    const bloques = [
      bloque("Número tarjeta débito ****5925", 0, 20),
      bloque("Monto $3.400", 30, 50),
      bloque("Fecha 07/09/2026", 60, 80),
      bloque("Hora 20:30 horas", 90, 110),
      bloque("Comercio TUU*DIERO I", 120, 140),
    ];
    const lineas = bloques.flatMap((b) => b.lines);

    const r = analizarComprobante({ lineas, bloques });

    expect(r.tipo).toBe("compra");
    expect(r.comercio).toBe("DIERO I");
    expect(r.monto).toBe(3400);
    expect(r.detalle).toBeNull();
    expect(r.fecha.getDate()).toBe(7);
    expect(r.fecha.getMonth()).toBe(8);
    expect(r.fecha.getHours()).toBe(20);
    expect(r.fecha.getMinutes()).toBe(30);
  });

  it("recibo Google Wallet: saca el prefijo 'MERCADOPAGO*' y re-arma el nombre cortado en dos líneas", () => {
    const bloques = [
      bloque("MERCADOPAGO*ZORROCHIS", 210, 245, 35),
      bloque("MITO", 250, 285, 35),
      bloque("CLP3,750", 340, 400, 55),
      bloque("miércoles, 9 de sept a las 21:10", 470, 495),
      bloque("Nombre del estado de cuenta", 1100, 1120),
      bloque("MERCADOPAGO*ZORROCHISMITO", 1125, 1145),
    ];
    const lineas = bloques.flatMap((b) => b.lines).sort((a, b) => a.top - b.top);

    const r = analizarComprobante({ lineas, bloques });

    expect(r.tipo).toBe("compra");
    expect(r.comercio).toBe("ZORROCHISMITO");
    expect(r.monto).toBe(3750);
  });

  it("degrada a compra si el clasificador dice transferencia pero el parser específico no encuentra suficientes keywords", () => {
    // Menos de 2 keywords del set (más chico) de transferenciaParser, pero
    // >= 2 del set (más amplio) de documentTypeDetector.
    const bloques = [
      bloque("Beneficiario Juan Pérez", 100, 130),
      bloque("Cuenta rut 12345678", 135, 155),
      bloque("Total $2.000", 200, 230),
    ];
    const lineas = bloques.flatMap((b) => b.lines);

    const r = analizarComprobante({ lineas, bloques });

    expect(r.tipo).toBe("compra");
    expect(r.monto).toBe(2000);
  });
});

describe("analizarComprobante — detalle de compra BCI", () => {
  function frag(text, fila, x = 0, ancho = 120) {
    return { text, top: fila * 40, bottom: fila * 40 + 24, height: 24, left: x, right: x + ancho };
  }
  const detalle = (comercioFrags) => [
    frag("08/11/2026", 0, 10, 80),
    frag("Compra con Tarjeta de Débito en RIKO", 0, 140, 230),
    frag("POLLO 11001SANTIAGCHL", 0.6, 140, 160),
    frag("$4.100", 0, 420, 50),
    frag("Detalle del movimiento", 2, 30, 200),
    frag("Fecha de la compra:", 3, 50, 150),
    frag("08/11/2026", 3, 210),
    frag("Hora de la compra:", 4, 50, 150),
    frag("20:25", 4, 210, 50),
    frag("Fecha contable", 5, 50, 150),
    frag("09/11/2026", 5, 210),
    frag("Tipo de compra:", 6, 50, 150),
    frag("Presencial", 6, 210),
    ...comercioFrags,
    frag("Tipo de movimiento:", 8, 50, 150),
    frag("Nacional", 8, 210),
    frag("N° de tarjeta:", 9, 50, 150),
    frag("**** 5925", 9, 210),
    frag("Código transacción:", 10, 50, 150),
    frag("212660943953106644", 10, 210, 180),
  ];

  it("quita el código de comuna y país del nombre del comercio", () => {
    const lineas = detalle([
      frag("Nombre del comercio:", 7, 50, 150),
      frag("RIKO POLLO 11001SANTIAGCHL", 7, 210, 220),
    ]);
    const r = analizarComprobante({ lineas, bloques: [] });
    expect(r.comercio).toBe("RIKO POLLO");
    expect(r.monto).toBe(4100);
    expect(r.fecha.getHours()).toBe(20);
    expect(r.fecha.getMinutes()).toBe(25);
  });

  it("sin la etiqueta del comercio, lo toma del encabezado del movimiento", () => {
    const lineas = detalle([frag("RIKO POLLO 11001SANTIAGCHL", 7, 210, 220)]);
    const r = analizarComprobante({ lineas, bloques: [] });
    expect(r.comercio).toBe("RIKO POLLO");
    expect(r.monto).toBe(4100);
  });

  it("quita el CHL final pegado al nombre", () => {
    const lineas = detalle([
      frag("Nombre del comercio:", 7, 50, 150),
      frag("RESTAURANTE PARRICALAMA CHL", 7, 210, 220),
    ]);
    expect(analizarComprobante({ lineas, bloques: [] }).comercio).toBe("RESTAURANTE PARRICALAMA");
  });
});
