// Port de PurchaseExtractor.kt.
//
// Diferencia con el original: las 3 regex de monto (CLP/$/etiqueta) tenían
// un bug en el Kotlin original — el grupo de captura era
// `[\d\s,]+(?:[.,]\d{1,2})?`, que no reconoce el separador de miles con
// punto ("$8.500" se truncaba a "8.50" -> 8,5). Se corrige acá usando el
// mismo patrón de miles que ya funciona en transferenciaParser.js
// (`[\d]+(?:[.,]\d{3})*(?:[.,]\d{1,2})?`), decisión tomada explícitamente
// al portar (ver Fase 4c). El resto es puerto 1:1.
//
// La fecha se devuelve como Date (hora local), no epoch millis.

const MESES_ES = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7,
  septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

const EXCLUSION_WORDS = [
  "lte", "4g", "5g", "3g", "volte", "vo lte", "wifi",
  "batería", "bateria", "señal", "senal", "operador",
  "visa", "mastercard", "débito", "debito", "crédito", "credito",
  "american express", "dinners",
  "id de transacción", "id de transaccion", "id transacción", "id transaccion",
  "comunicarse con la entidad emisora",
  "comunicate con la entidad emisora",
  "obtén recibos más detallados", "obten recibos mas detallados",
  "configurar", "notificaciones", "edge", "gprs", "battery",
  "movistar", "entel", "claro", "wom", "virgin mobile",
  "tarjeta", "terminada en", "cuotas", "cuota",
  "fecha", "hora", "completada", "domingo", "lunes", "martes",
  "miércoles", "miercoles", "jueves", "viernes", "sábado", "sabado",
];

const MONTO_NUM = "[\\d]+(?:[.,]\\d{3})*(?:[.,]\\d{1,2})?";
const CLP_REGEX = new RegExp(`CLP\\s*\\$?\\s*(${MONTO_NUM})`, "i");
const DOLLAR_REGEX = new RegExp(`\\$\\s*(${MONTO_NUM})`);
const LABEL_MONTO_REGEX = new RegExp(`(?:Total|Monto|Importe|Valor|Pago)\\s*:?\\s*\\$?\\s*(${MONTO_NUM})`, "i");
const FECHA_TEXTO_REGEX = /(\d{1,2})\s+de\s+([a-zA-Záéíóúñ]+)\s+a\s+las\s+(\d{1,2}):(\d{2})/;
const HORA_REGEX = /(\d{1,2}):(\d{2})/;

function aEnteroONull(s) {
  if (typeof s !== "string" || !/^\d+$/.test(s.trim())) return null;
  return parseInt(s, 10);
}

function aDecimalONull(s) {
  if (typeof s !== "string" || s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function soloDigitos(s) {
  return (s.match(/\d/g) || []).join("");
}

function limpiarMonto(raw) {
  if (raw.includes(",") && raw.includes(".")) {
    const lastCommaIdx = raw.lastIndexOf(",");
    const integerPart = raw.slice(0, lastCommaIdx).replace(/\./g, "");
    const decimalPart = raw.slice(lastCommaIdx + 1).slice(0, 2);
    return aDecimalONull(`${integerPart}.${decimalPart}`);
  }
  if (raw.includes(",")) {
    const parts = raw.split(",");
    if (parts.length === 2 && parts[1].length <= 2) return aDecimalONull(raw.replace(",", "."));
    return aDecimalONull(raw.replace(/,/g, ""));
  }
  if (raw.includes(".")) {
    const parts = raw.split(".");
    if (parts.length === 2 && parts[1].length <= 2) return aDecimalONull(raw);
    return aDecimalONull(raw.replace(/\./g, ""));
  }
  return aDecimalONull(raw);
}

function buscarMontoEnTexto(text) {
  const clpMatch = CLP_REGEX.exec(text);
  if (clpMatch) {
    const parsed = limpiarMonto(clpMatch[1].trim());
    if (parsed !== null && parsed > 0) return parsed;
  }

  const dollarMatch = DOLLAR_REGEX.exec(text);
  if (dollarMatch) {
    const parsed = limpiarMonto(dollarMatch[1].trim());
    if (parsed !== null && parsed > 0) return parsed;
  }

  const labelMatch = LABEL_MONTO_REGEX.exec(text);
  if (labelMatch) {
    const parsed = limpiarMonto(labelMatch[1].trim());
    if (parsed !== null && parsed > 0) return parsed;
  }

  return null;
}

function extractMonto(blocks) {
  for (const block of blocks) {
    for (const line of block.lines) {
      const parsed = buscarMontoEnTexto(line.text.trim());
      if (parsed !== null) return [parsed, block];
    }
  }

  // Fallback: montos grandes (ej. "CLP1,350") a veces quedan en líneas
  // separadas dentro del mismo bloque por la diferencia de tamaño de fuente
  // entre el prefijo de moneda y el número — se reintenta uniendo todo el
  // texto del bloque.
  for (const block of blocks) {
    const parsed = buscarMontoEnTexto(block.lines.map((l) => l.text.trim()).join(" "));
    if (parsed !== null) return [parsed, block];
  }

  return [null, null];
}

function extractFechaHora(lines) {
  for (const line of lines) {
    const match = FECHA_TEXTO_REGEX.exec(line.text.trim());
    if (match) {
      const day = aEnteroONull(match[1]);
      const mesTexto = match[2].toLowerCase();
      // Google Wallet abrevia "septiembre" como "sept" (4 letras); el resto
      // de las abreviaturas chilenas usan 3 — se acepta el prefijo de 3 como
      // fallback en vez de listar cada variante posible.
      const month = MESES_ES[mesTexto] ?? MESES_ES[mesTexto.slice(0, 3)];
      const hour = aEnteroONull(match[3]);
      const minute = aEnteroONull(match[4]);
      if (day === null || month === undefined || hour === null || minute === null) continue;
      if (day < 1 || day > 31 || hour > 23 || minute > 59) continue;
      const year = new Date().getFullYear();
      const horaStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      return [new Date(year, month, day, hour, minute, 0, 0), horaStr];
    }
  }

  for (const line of lines) {
    const text = line.text.trim();
    if (!text.includes("/")) continue;
    const parts = text.split("/");
    if (parts.length < 3) continue;
    const day = aEnteroONull(soloDigitos(parts[0]));
    const month = aEnteroONull(soloDigitos(parts[1]));
    let year = aEnteroONull(soloDigitos(parts[2].slice(0, Math.min(4, parts[2].length))));
    if (day === null || month === null || year === null) continue;
    if (day < 1 || day > 31 || month < 1 || month > 12) continue;
    if (year < 100) year += 2000;
    const timeMatch = HORA_REGEX.exec(text);
    const hour = timeMatch ? aEnteroONull(timeMatch[1]) ?? 0 : 0;
    const minute = timeMatch ? aEnteroONull(timeMatch[2]) ?? 0 : 0;
    const horaStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    return [new Date(year, month - 1, day, hour, minute, 0, 0), horaStr];
  }

  return [null, null];
}

function contieneTextoExcluido(block) {
  const fullText = block.lines.map((l) => l.text).join(" ").toLowerCase();
  if (EXCLUSION_WORDS.some((w) => fullText.includes(w))) return true;
  const condensed = block.lines.map((l) => l.text).join("");
  if (condensed.length <= 4 && [...condensed].every((c) => /[\p{L}\p{N}+\-]/u.test(c))) return true;
  const digitRatio = (condensed.match(/\d/g) || []).length / Math.max(condensed.length, 1);
  if (digitRatio > 0.6 && condensed.length >= 3) return true;
  return false;
}

function esBloqueMonetario(block) {
  const text = block.lines.map((l) => l.text).join(" ");
  if (text.includes("$")) return true;
  if (/\bCLP\b/i.test(text)) return true;
  if (/^(Monto|Total|Importe|Valor|Pago)\b/i.test(text)) return true;
  if (/^\$?\s*[\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?\s*$/.test(text.trim())) return true;
  return false;
}

function esBloqueSecundario(block) {
  const text = block.lines.map((l) => l.text).join(" ").toLowerCase();
  if (text.includes("a las")) return true;
  if (text.startsWith("completada")) return true;
  if (/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(text)) return true;
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text.trim())) return true;
  if (text.includes("gracias por tu compra")) return true;
  if (text.includes("aprobada")) return true;
  if (text.length <= 3) return true;
  return false;
}

function extractComercio(blocks, montoBlock, imageHeight) {
  if (!montoBlock) return null;
  const statusBarThreshold = Math.min(100, Math.max(50, Math.trunc(imageHeight * 0.08)));

  const candidates = blocks.filter(
    (block) =>
      block.top > statusBarThreshold &&
      block.bottom <= montoBlock.top &&
      block !== montoBlock &&
      !contieneTextoExcluido(block) &&
      !esBloqueMonetario(block) &&
      !esBloqueSecundario(block)
  );
  if (candidates.length === 0) return null;

  const conClave = candidates.map((block) => ({
    block,
    distancia: montoBlock.top - block.bottom,
    alturaMax: Math.max(...block.lines.map((l) => l.height)),
    largoTotal: block.lines.reduce((s, l) => s + l.text.trim().length, 0),
  }));
  conClave.sort(
    (a, b) => a.distancia - b.distancia || b.alturaMax - a.alturaMax || b.largoTotal - a.largoTotal
  );
  const bestBlock = conClave[0].block;

  const name = bestBlock.lines.map((l) => l.text.trim()).join(" ").trim();
  return name || null;
}

// lineas/bloques: ver construirBloques.js. Devuelve
// { comercio, monto, fecha } — nunca null (el documento ya se clasificó
// como compra antes de llamar acá).
export function parsearCompra(lineas, bloques) {
  const imageHeight = bloques.length ? Math.max(...bloques.map((b) => b.bottom)) : 0;
  const [monto, montoBlock] = extractMonto(bloques);
  const [fecha] = extractFechaHora(lineas);
  const comercio = extractComercio(bloques, montoBlock, imageHeight);
  return { comercio, monto, fecha };
}
