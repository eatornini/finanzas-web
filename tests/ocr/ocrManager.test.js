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
