import { describe, it, expect } from "vitest";
import { detectarTipoDocumento } from "../../src/ocr/documentTypeDetector.js";

describe("detectarTipoDocumento", () => {
  it("detecta transferencia con suficientes keywords", () => {
    const texto =
      "Transferencia exitosa | Destinatario: Juan Pérez | Monto transferido $15.000 | Fecha y hora: 04/09/2026 14:30";
    expect(detectarTipoDocumento(texto)).toBe("transferencia");
  });

  it("detecta compra cuando no hay suficientes keywords de transferencia", () => {
    const texto = "Supermercado Central | Boleta electrónica | Total $8.500 | Gracias por tu compra";
    expect(detectarTipoDocumento(texto)).toBe("compra");
  });

  it("una sola keyword de transferencia no alcanza", () => {
    const texto = "Pago exitoso | Total $5.000 | Boleta";
    expect(detectarTipoDocumento(texto)).toBe("compra");
  });

  it("no distingue mayúsculas/minúsculas", () => {
    const texto = "TRANSFERENCIA EXITOSA | DESTINATARIO: JUAN | MONTO TRANSFERIDO $1.000";
    expect(detectarTipoDocumento(texto)).toBe("transferencia");
  });
});
