import { detectarTipoDocumento } from "./documentTypeDetector.js";
import { parsearTransferencia } from "./transferenciaParser.js";
import { parsearCompra } from "./purchaseExtractor.js";

// Los comprobantes de POS (ej. TUU) anteponen el proveedor al nombre del
// comercio ("TUU*ALMACEN DON JUAN") — se saca ese prefijo y se deja solo
// el nombre real.
const PREFIJO_PROVEEDOR_REGEX = /^\s*TUU\s*\*\s*/i;

function limpiarComercio(comercio) {
  if (!comercio) return comercio;
  return comercio.replace(PREFIJO_PROVEEDOR_REGEX, "").trim() || null;
}

// { lineas, bloques } ya construidos por construirBloques(). Devuelve
// { comercio, monto, fecha, detalle, tipo } — tipo: "transferencia" | "compra".
export function analizarComprobante({ lineas, bloques }) {
  const fullText = lineas.map((l) => l.text).join(" | ");
  const tipo = detectarTipoDocumento(fullText);

  if (tipo === "transferencia") {
    const r = parsearTransferencia(lineas);
    if (r) return { ...r, comercio: limpiarComercio(r.comercio), tipo };
  }

  const r = parsearCompra(lineas, bloques);
  return { ...r, comercio: limpiarComercio(r.comercio), detalle: null, tipo: "compra" };
}
