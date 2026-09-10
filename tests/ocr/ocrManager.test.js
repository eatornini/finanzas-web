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
