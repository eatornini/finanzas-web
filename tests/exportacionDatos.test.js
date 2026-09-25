import { describe, it, expect } from "vitest";
import {
  VERSION_FORMATO,
  claveMovimiento,
  claveCategoria,
  construirArchivoExportacion,
  validarArchivoImportado,
  resumenImportacion,
} from "../src/logic/exportacionDatos.js";

const MOV_BASE = {
  id: 1,
  nombre: "Supermercado",
  monto: 15000,
  tipo: "gasto",
  modo: "real",
  pagado: true,
  activo: true,
  recurrente: false,
  frecuencia: null,
  categoria_id: 7,
  fecha: "2026-09-10T15:00:00.000Z",
  detalle: null,
};

const CAT_BASE = {
  id: 7,
  nombre: "Alimentos",
  tipo: "gasto",
  modo: "real",
  color: "#3498db",
  emoji: null,
  icono: "restaurant",
  orden: 0,
};

describe("claveMovimiento", () => {
  it("misma clave para el mismo contenido, sin importar mayúsculas o espacios en el nombre", () => {
    const a = claveMovimiento({ modo: "real", monto: 1000, fecha: "2026-09-10T15:00:00.000Z", nombre: "Kiosco" });
    const b = claveMovimiento({
      modo: "real",
      monto: 1000,
      fecha: "2026-09-10T15:00:00.000Z",
      nombre: "  KIOSCO  ",
    });
    expect(a).toBe(b);
  });

  it("distinta clave si cambia el modo, el monto o la fecha", () => {
    const base = { modo: "real", monto: 1000, fecha: "2026-09-10T15:00:00.000Z", nombre: "Kiosco" };
    expect(claveMovimiento(base)).not.toBe(claveMovimiento({ ...base, modo: "estimado" }));
    expect(claveMovimiento(base)).not.toBe(claveMovimiento({ ...base, monto: 1001 }));
    expect(claveMovimiento(base)).not.toBe(claveMovimiento({ ...base, fecha: "2026-09-11T15:00:00.000Z" }));
  });
});

describe("claveCategoria", () => {
  it("distingue categorías con el mismo nombre pero distinto tipo o modo", () => {
    const base = { modo: "real", tipo: "gasto", nombre: "Otros" };
    expect(claveCategoria(base)).not.toBe(claveCategoria({ ...base, tipo: "ingreso" }));
    expect(claveCategoria(base)).not.toBe(claveCategoria({ ...base, modo: "estimado" }));
  });
});

describe("construirArchivoExportacion / validarArchivoImportado", () => {
  it("arma un archivo válido con versión, y cada movimiento lleva su idExportacion", () => {
    const archivo = construirArchivoExportacion({
      movimientos: [MOV_BASE],
      categorias: [CAT_BASE],
      filtros: { modo: "real", tipo: "ambos", periodo: "todos" },
    });
    expect(archivo.version).toBe(VERSION_FORMATO);
    expect(archivo.movimientos).toHaveLength(1);
    expect(archivo.movimientos[0].idExportacion).toBe(claveMovimiento(MOV_BASE));
    expect(archivo.movimientos[0].categoria_id).toBe(7);
    expect(() => validarArchivoImportado(archivo)).not.toThrow();
  });

  it("rechaza un archivo de otra versión", () => {
    const archivo = construirArchivoExportacion({ movimientos: [], categorias: [], filtros: {} });
    archivo.version = 999;
    expect(() => validarArchivoImportado(archivo)).toThrow();
  });

  it("rechaza un archivo sin la forma esperada", () => {
    expect(() => validarArchivoImportado({ version: VERSION_FORMATO })).toThrow();
    expect(() => validarArchivoImportado(null)).toThrow();
  });
});

describe("resumenImportacion", () => {
  it("cuenta gastos/ingresos, reales/estimados y detecta duplicados contra lo existente", () => {
    const archivo = construirArchivoExportacion({
      movimientos: [MOV_BASE, { ...MOV_BASE, id: 2, tipo: "ingreso", modo: "estimado", monto: 5000 }],
      categorias: [CAT_BASE],
      filtros: {},
    });
    const clavesExistentes = new Set([claveMovimiento(MOV_BASE)]); // el primero ya existe
    const resumen = resumenImportacion(archivo, clavesExistentes);
    expect(resumen.totalMovimientos).toBe(2);
    expect(resumen.gastos).toBe(1);
    expect(resumen.ingresos).toBe(1);
    expect(resumen.reales).toBe(1);
    expect(resumen.estimados).toBe(1);
    expect(resumen.nuevos).toBe(1);
    expect(resumen.omitidos).toBe(1);
  });

  it("si el propio archivo repite el mismo movimiento, solo cuenta la primera aparición como nueva", () => {
    const archivo = construirArchivoExportacion({
      movimientos: [MOV_BASE, { ...MOV_BASE }],
      categorias: [],
      filtros: {},
    });
    const resumen = resumenImportacion(archivo, new Set());
    expect(resumen.nuevos).toBe(1);
    expect(resumen.omitidos).toBe(1);
  });
});
