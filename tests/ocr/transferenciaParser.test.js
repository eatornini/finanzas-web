import { describe, it, expect } from "vitest";
import { parsearTransferencia } from "../../src/ocr/transferenciaParser.js";

function lineas(textos) {
  return textos.map((text, i) => ({ text, top: i * 30, bottom: i * 30 + 20, height: 20, left: 0, right: 300 }));
}

describe("parsearTransferencia", () => {
  it("extrae comercio/monto/fecha con etiquetas claras", () => {
    const r = parsearTransferencia(
      lineas([
        "Transferencia exitosa",
        "Comprobante de transferencia",
        "Para",
        "Juan Pérez",
        "Monto",
        "$15.000",
        "Fecha",
        "04/09/2026",
        "Hora",
        "14:30",
      ])
    );
    expect(r).not.toBeNull();
    expect(r.comercio).toBe("Juan Pérez");
    expect(r.monto).toBe(15000);
    expect(r.fecha).toBeInstanceOf(Date);
    expect(r.fecha.getFullYear()).toBe(2026);
    expect(r.fecha.getMonth()).toBe(8); // septiembre, base 0
    expect(r.fecha.getDate()).toBe(4);
    expect(r.fecha.getHours()).toBe(14);
    expect(r.fecha.getMinutes()).toBe(30);
    expect(r.detalle).toBeNull();
  });

  it("devuelve null si no hay suficientes palabras clave de transferencia", () => {
    const r = parsearTransferencia(lineas(["Supermercado Central", "Total $8.500", "Boleta electrónica"]));
    expect(r).toBeNull();
  });

  it("cae al fallback de la primera línea razonable si no hay etiqueta de destinatario", () => {
    const r = parsearTransferencia(
      lineas([
        "Transferencia realizada",
        "Pago exitoso",
        "Farmacia del Barrio",
        "$3.200",
        "01/02/2026 09:15",
      ])
    );
    expect(r).not.toBeNull();
    expect(r.comercio).toBe("Farmacia del Barrio");
    expect(r.monto).toBe(3200);
  });

  it("extrae fecha combinada de dd/mm/yyyy y hora sueltas en el texto", () => {
    const r = parsearTransferencia(
      lineas(["Transferencia exitosa", "Pago realizado", "Destinatario", "María López", "05/01/2026 10:45", "$500"])
    );
    expect(r.fecha.getFullYear()).toBe(2026);
    expect(r.fecha.getMonth()).toBe(0);
    expect(r.fecha.getDate()).toBe(5);
    expect(r.fecha.getHours()).toBe(10);
    expect(r.fecha.getMinutes()).toBe(45);
  });
});
