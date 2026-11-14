import { detectarTipoDocumento } from "./documentTypeDetector.js";
import { parsearTransferencia } from "./transferenciaParser.js";
import { parsearCompra } from "./purchaseExtractor.js";
import { parsearComprobanteTabular } from "./comprobanteTabularParser.js";
import { parsearListaMovimientos } from "./listaMovimientosParser.js";

// Los agregadores de pago (TUU, Mercado Pago, etc.) anteponen su marca y un
// asterisco al nombre real del comercio: "TUU*ALMACEN DON JUAN",
// "MERCADOPAGO*ZORROCHISMITO", "SP *SPOTIFY". Nos quedamos con lo que va
// después del "*" — el prefijo de la marca no es el comercio.
const PREFIJO_AGREGADOR_REGEX = /^\s*[A-Za-z][A-Za-z0-9]+(?:\s+[A-Za-z0-9]+)?\s*\*\s*/;

// Los bancos (BCI, Transbank) agregan al final del nombre el código de
// comuna/ciudad y el país, a veces pegados: "RIKO POLLO 11001SANTIAGCHL",
// "RESTAURANTE PARRICALAMA CHL". Se quitan: un token final que empieza con
// 3+ dígitos ("11001SANTIAGCHL") y un "CHL" final suelto.
const SUFIJO_UBICACION_REGEX = /\s+\d{3,}[A-Za-z]*\s*$/;
const SUFIJO_PAIS_REGEX = /\s+CHL\s*$/i;

function limpiarComercio(comercio) {
  if (!comercio) return comercio;
  const limpio = comercio
    .replace(PREFIJO_AGREGADOR_REGEX, "")
    .replace(SUFIJO_UBICACION_REGEX, "")
    .replace(SUFIJO_PAIS_REGEX, "")
    .trim();
  // Si la limpieza se comió todo, mejor el original que nada.
  return limpio || comercio.trim() || null;
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

  // Comprobantes con tabla "etiqueta / valor" (vouchers TUU/Transbank y
  // correos de POS). Solo gana si reconoce la etiqueta "Comercio" + un monto;
  // si no, cae al parser por geometría que ya sirve para los screenshots.
  const tabular = parsearComprobanteTabular(lineas);
  if (tabular) {
    return { ...tabular, comercio: limpiarComercio(tabular.comercio), detalle: null, tipo: "compra" };
  }

  const r = parsearCompra(lineas, bloques);
  return { ...r, comercio: limpiarComercio(r.comercio), detalle: null, tipo: "compra" };
}

// Captura con varios movimientos (listado del banco). Devuelve
// [{ comercio, monto, fecha, signo }] con el comercio ya limpio de prefijos
// de agregador, igual que en un comprobante suelto.
export function analizarLista({ lineas }, hoy = new Date()) {
  return parsearListaMovimientos(lineas, hoy).map((f) => ({
    ...f,
    comercio: limpiarComercio(f.comercio),
  }));
}
