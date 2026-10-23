import { describe, it, expect } from "vitest";
import { parsearListaMovimientos, parsearFechaCorta } from "../../src/ocr/listaMovimientosParser.js";
import { analizarLista } from "../../src/ocr/ocrManager.js";

const HOY = new Date(2026, 9, 23, 9, 0); // 23 oct 2026

function linea(text, top, left = 120, right = left + 200, height = 20) {
  return { text, top, bottom: top + height, height, left, right };
}

// Fila como la del listado de Bci: comercio + monto arriba, fecha y
// tarjeta abajo. `junto`: Tesseract devolvió comercio y monto en una línea.
function fila(top, comercio, monto, fecha, junto = false) {
  const arriba = junto
    ? [linea(`${comercio} ${monto}`, top, 120, 790)]
    : [linea(comercio, top, 120, 400), linea(monto, top + 2, 720, 790)];
  return [
    ...arriba,
    linea(fecha, top + 30),
    linea("Bci Visa Debito Premier ••5925", top + 58, 120, 300, 14),
  ];
}

describe("parsearListaMovimientos", () => {
  it("lee cada fila con comercio, monto y fecha propia", () => {
    const lineas = [
      ...fila(40, "ALMACEN YOLI", "$3,600", "22 oct"),
      ...fila(160, "TUU*JACINTA FLORA GONZALE", "$3,000", "22 oct"),
      ...fila(280, "VENDOMATICA 665", "$1,300", "21 oct", true),
      ...fila(400, "SALCOBRAND RAMIREZ 20", "$44,271", "21 oct"),
      ...fila(520, "AHUM L533 RAMIREZ 2092", "$9.081", "21 oct"),
    ];

    const r = parsearListaMovimientos(lineas, HOY);

    expect(r.map((f) => [f.comercio, f.monto])).toEqual([
      ["ALMACEN YOLI", 3600],
      ["TUU*JACINTA FLORA GONZALE", 3000],
      ["VENDOMATICA 665", 1300],
      ["SALCOBRAND RAMIREZ 20", 44271],
      ["AHUM L533 RAMIREZ 2092", 9081],
    ]);
    expect(r[0].fecha).toEqual(new Date(2026, 9, 22, 12));
    expect(r[4].fecha).toEqual(new Date(2026, 9, 21, 12));
  });

  it("aplica encabezados de día a las filas de abajo", () => {
    const lineas = [
      linea("Martes 21 de octubre", 0),
      linea("ALMACEN YOLI", 40, 120, 400),
      linea("$3.600", 40, 720, 790),
      linea("COPEC", 100, 120, 400),
      linea("$20.000", 100, 720, 790),
      linea("Lunes 20 de octubre", 160),
      linea("JUMBO", 200, 120, 400),
      linea("-$15.990", 200, 720, 790),
    ];

    const r = parsearListaMovimientos(lineas, HOY);

    expect(r.map((f) => f.fecha.getDate())).toEqual([21, 21, 20]);
    expect(r[2]).toMatchObject({ comercio: "JUMBO", monto: 15990, signo: "-" });
  });

  it("sin montos devuelve lista vacía", () => {
    expect(parsearListaMovimientos([linea("Hola", 0)], HOY)).toEqual([]);
  });
});

describe("parsearFechaCorta", () => {
  it("una fecha futura sin año es del año anterior", () => {
    expect(parsearFechaCorta("28 dic", HOY)).toEqual(new Date(2025, 11, 28, 12));
  });

  it("entiende hoy, ayer y dd/mm/aaaa", () => {
    expect(parsearFechaCorta("Ayer", HOY)).toEqual(new Date(2026, 9, 22, 12));
    expect(parsearFechaCorta("05/10/2026", HOY)).toEqual(new Date(2026, 9, 5, 12));
  });
});

describe("analizarLista", () => {
  it("saca el prefijo del agregador de pago del comercio", () => {
    const r = analizarLista({ lineas: fila(0, "MERPAGO*MAYENI", "$3,400", "21 oct") }, HOY);
    expect(r[0].comercio).toBe("MAYENI");
  });
});
