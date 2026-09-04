import { detectarTipoDocumento } from "./documentTypeDetector.js";
import { parsearTransferencia } from "./transferenciaParser.js";
import { parsearCompra } from "./purchaseExtractor.js";

// { lineas, bloques } ya construidos por construirBloques(). Devuelve
// { comercio, monto, fecha, detalle, tipo } — tipo: "transferencia" | "compra".
export function analizarComprobante({ lineas, bloques }) {
  const fullText = lineas.map((l) => l.text).join(" | ");
  const tipo = detectarTipoDocumento(fullText);

  if (tipo === "transferencia") {
    const r = parsearTransferencia(lineas);
    if (r) return { ...r, tipo };
  }

  const r = parsearCompra(lineas, bloques);
  return { ...r, detalle: null, tipo: "compra" };
}
