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
  // Franja "Monto transferido: $5.000" (texto blanco sobre naranja) que PSM 11
  // descarta: sin etiqueta de monto ni "$", el número tomado es un adivinado.
  it("marca el monto como dudoso si no sale de una etiqueta ni de una línea con $", () => {
    const r = parsearTransferencia(
      lineas([
        "Desde:", "Producto", "Cuenta Pro", "N9 de cuenta", "02070049611", "N9 de TEF:", "7049584",
        "Fecha y Hora de TEF", "25/09/2026 07:33:01", "Hacia:", "Nombre", "Matias Eric Tomini",
        "RUT", "23.409.2251", "Banco", "BancoEstado", "N9 de cuenta", "rm9225",
      ])
    );
    expect(r.montoDudoso).toBe(true);
  });

  it("no marca como dudoso el monto leído de la franja de monto transferido", () => {
    const r = parsearTransferencia(
      lineas([
        "onto transferido: $5.000", "Desde:", "Producto : Cuenta Pro", "N* de cuenta + 02070049611",
        "N* de TEF : 7049584", "Fecha y Hora de TEF + 25/09/2026 07:33:01", "Hacia:",
        "Nombre : Matias Eric Tomini", "Banco + BancoEstado",
      ])
    );
    expect(r.monto).toBe(5000);
    expect(r.montoDudoso).toBe(false);
  });
});
