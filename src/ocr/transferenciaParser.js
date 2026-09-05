// Port de TransferenciaOcrParser.kt. TransferExtractor.kt (la otra mitad
// de la referencia) resultó ser una copia casi idéntica de este archivo —
// no se portó por separado (ver spec de Fase 4c).
//
// Diferencia con el original: la fecha se devuelve como Date (hora local
// del dispositivo), no como epoch millis de Calendar.getInstance().

const TRANSFER_KEYWORDS = [
  "transferencia", "operacion exitosa", "operación exitosa", "destinatario",
  "detalle cuenta destino", "cuenta origen", "monto transferido",
  "fecha y hora", "n° de operacion", "n° de operación",
  "comprobante de transferencia", "transferencia exitosa",
  "transferencia realizada", "transferiste",
  "transferencia recibida", "transferencia enviada",
  "pago exitoso", "pago realizado", "pago recibido",
];

const EXCLUDE_COMERCIO = [
  "bancoestado", "banco estado", "bci", "santander", "banco de chile",
  "itau", "itaú", "scotiabank", "tenpo", "mach", "mercadopago",
  "banco falabella", "banco internacional", "corpbanca", "banco security",
  "cuentarut", "cuenta rut", "cuenta pro", "cta cte", "cta. cte.",
  "cuenta vista", "cuenta corriente", "cuenta de ahorro",
  "cuentanut", "rut", "banco", "transferencia",
  "comprobante", "operacion", "operación", "exitosa",
  "monto", "monto transferido", "total", "transferido",
  "fecha", "hora", "fecha y hora", "n° de operacion", "n° de operación",
  "folio", "codigo", "código", "tipo de cuenta", "tipo cuenta",
  "detalle", "mensaje", "comentario",
  "transferencia exitosa", "transferencia realizada",
  "transferencia recibida", "transferencia enviada",
  "pago exitoso", "pago realizado", "pago recibido",
  "origen", "destino", "destinatario",
  "cuenta origen", "cuenta destino", "detalle cuenta destino",
  "estado", "banco destino", "banco origen",
  "nombre", "nombres", "razon social", "razón social",
  "numero de operacion", "número de operación",
  "para", "pago", "comprobante de transferencia",
];

const MONTO_REGEX = /\$?\s*([\d]+(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/;
const DATE_REGEX = /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/;
const TIME_REGEX = /(\d{1,2}):(\d{2})(?::(\d{2}))?/;
const TIME_REGEX_FLEX = /(\d{1,2})[:.](\d{2})(?::(\d{2}))?(?:\s*(?:hrs?|horas?))?/i;

function aEnteroONull(s) {
  if (typeof s !== "string" || !/^\d+$/.test(s.trim())) return null;
  return parseInt(s, 10);
}

function aDecimalONull(s) {
  if (typeof s !== "string" || s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function coincideCompleto(regex, text) {
  const m = regex.exec(text);
  return m !== null && m[0] === text;
}

function esTransferencia(textoMinuscula) {
  return TRANSFER_KEYWORDS.filter((k) => textoMinuscula.includes(k)).length >= 2;
}

function limpiarValor(value) {
  let v = value.trim();
  for (const p of [":", "-", ">", "→"]) if (v.startsWith(p)) v = v.slice(p.length);
  v = v.trim();
  for (const s of [":", "-"]) if (v.endsWith(s)) v = v.slice(0, -s.length);
  return v.trim();
}

function esLabelLine(text, labels) {
  const lower = text.toLowerCase().trim();
  if (lower.length <= 2) return false;
  return labels.some((l) => {
    const ll = l.toLowerCase();
    return lower === ll || lower.startsWith(`${ll}:`);
  });
}

function findLabelValue(lines, labels) {
  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i].text.trim();
    const lineLower = lineText.toLowerCase();

    for (const label of labels) {
      const labelLower = label.toLowerCase();
      const colonPattern = new RegExp(`\\b${labelLower}\\s*[:>\\-→]\\s*(.+)`, "i");
      const colonMatch = colonPattern.exec(lineText);
      if (colonMatch) {
        const value = colonMatch[1].trim();
        if (value) return limpiarValor(value);
      }

      const labelMatch =
        lineLower === labelLower ||
        lineLower.startsWith(`${labelLower}:`) ||
        lineLower === `${labelLower} -` ||
        lineLower === `${labelLower}-` ||
        lineLower.startsWith(`${labelLower}\t`);

      if (labelMatch) {
        for (let j = 1; j <= 5; j++) {
          const nextIdx = i + j;
          if (nextIdx < lines.length) {
            const nextText = lines[nextIdx].text.trim();
            if (nextText.length > 1 && !esLabelLine(nextText, labels)) {
              return limpiarValor(nextText);
            }
          }
        }
      }

      if (lineLower.startsWith(`${labelLower} `)) {
        const after = lineText.substring(label.length).trim();
        if (after.length > 1 && !esLabelLine(after, labels)) {
          return limpiarValor(after);
        }
      }
    }
  }
  return null;
}

function esLineaNumerica(text) {
  const digits = text.replace(/[\s.,%\-/$]/g, "");
  if (digits.length < 3) return false;
  const digitCount = (text.match(/\d/g) || []).length;
  return digitCount / text.length > 0.6;
}

function esExcluidoComoComercio(text) {
  const lower = text.toLowerCase().trim();
  if (lower.length <= 2) return true;
  if (EXCLUDE_COMERCIO.some((e) => lower.includes(e))) return true;
  if (esLineaNumerica(text)) return true;
  if (coincideCompleto(MONTO_REGEX, text.trim())) return true;
  if (text.includes("$")) return true;
  return false;
}

function extractComercio(lines) {
  const destinoKeywords = ["para", "nombre", "destinatario", "razon social", "razón social", "beneficiario"];
  for (const keyword of destinoKeywords) {
    const valor = findLabelValue(lines, [keyword]);
    if (valor !== null && !esExcluidoComoComercio(valor)) return valor;
  }
  for (const line of lines) {
    const text = line.text.trim();
    if (text.length > 3 && !esExcluidoComoComercio(text) && !text.includes("$") && !esLineaNumerica(text)) {
      return text;
    }
  }
  return null;
}

function parseMonto(text) {
  const match = MONTO_REGEX.exec(text);
  if (match) {
    const raw = match[1];
    if (raw.includes(",") && raw.includes(".")) {
      const parts = raw.split(",");
      const integerPart = parts[0].replace(/\./g, "");
      const decimalPart = parts[1].slice(0, 2);
      return aDecimalONull(`${integerPart}.${decimalPart}`);
    }
    const clean = raw.replace(/\./g, "").replace(/,/g, ".");
    const value = aDecimalONull(clean);
    if (value !== null && value > 0) return value;
  }
  const digits = text.replace(/[^\d]/g, "");
  if (digits.length >= 3 && digits.length <= 9) {
    const value = aDecimalONull(digits);
    if (value !== null && value > 0) return value;
  }
  return null;
}

function extractMonto(lines) {
  const montoLabels = ["monto transferido", "monto", "total", "transferido"];

  for (const label of montoLabels) {
    const value = findLabelValue(lines, [label]);
    if (value !== null) {
      const parsed = parseMonto(value);
      if (parsed !== null) return parsed;
    }
  }

  const montoLineIndices = [];
  lines.forEach((l, i) => {
    const lower = l.text.toLowerCase().trim();
    if (montoLabels.some((label) => lower.startsWith(label) || label.startsWith(lower))) {
      montoLineIndices.push(i);
    }
  });
  for (const idx of montoLineIndices) {
    for (let j = 0; j <= 4; j++) {
      const checkIdx = idx + j;
      if (checkIdx < lines.length) {
        const parsed = parseMonto(lines[checkIdx].text);
        if (parsed !== null) return parsed;
      }
    }
  }

  for (const line of lines) {
    if (line.text.includes("$")) {
      const parsed = parseMonto(line.text);
      if (parsed !== null) return parsed;
    }
  }

  for (const line of lines) {
    const parsed = parseMonto(line.text);
    if (parsed !== null) return parsed;
  }

  return null;
}

function extraerHoraDeTexto(text) {
  const timeMatch = TIME_REGEX.exec(text);
  if (timeMatch) {
    let time = timeMatch[0];
    if ((time.match(/:/g) || []).length === 2) time = time.slice(0, time.lastIndexOf(":"));
    return time;
  }
  const flexMatch = TIME_REGEX_FLEX.exec(text);
  if (flexMatch) return `${flexMatch[1]}:${flexMatch[2]}`;
  return null;
}

function buscarHoraTrasLabelFechaYHora(lines) {
  const labels = ["fecha y hora", "fecha/hora", "fecha y hora de operacion"];
  for (let i = 0; i < lines.length; i++) {
    const lineLower = lines[i].text.toLowerCase().trim();
    if (labels.some((l) => lineLower.includes(l))) {
      let foundDate = false;
      for (let j = 1; j <= 5; j++) {
        const checkIdx = i + j;
        if (checkIdx >= lines.length) break;
        const checkText = lines[checkIdx].text.trim();
        if (!foundDate) {
          if (DATE_REGEX.test(checkText)) {
            foundDate = true;
            const timeInLine = extraerHoraDeTexto(checkText);
            if (timeInLine) return timeInLine;
          }
        } else {
          const time = extraerHoraDeTexto(checkText);
          if (time) return time;
        }
      }
      break;
    }
  }
  return null;
}

function buscarHoraEnLineasCercanas(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (DATE_REGEX.test(lines[i].text)) {
      for (let offset = 1; offset <= 5; offset++) {
        for (const sign of [1, -1]) {
          const checkIdx = i + offset * sign;
          if (checkIdx >= 0 && checkIdx < lines.length) {
            const time = extraerHoraDeTexto(lines[checkIdx].text.trim());
            if (time) return time;
          }
        }
      }
    }
  }
  return null;
}

function buscarHoraGlobal(lines) {
  for (const line of lines) {
    const time = extraerHoraDeTexto(line.text.trim());
    if (time) return time;
  }
  return null;
}

function parseFechaCompleta(text) {
  const dateMatch = DATE_REGEX.exec(text);
  if (!dateMatch) return null;
  const day = aEnteroONull(dateMatch[1]);
  const month = aEnteroONull(dateMatch[2]);
  let year = aEnteroONull(dateMatch[3]);
  if (day === null || month === null || year === null) return null;
  if (year < 100) year += 2000;
  if (year < 2000) return null;

  const timeMatch = TIME_REGEX.exec(text) || TIME_REGEX_FLEX.exec(text);
  const hour = timeMatch ? aEnteroONull(timeMatch[1]) ?? 0 : 0;
  const minute = timeMatch ? aEnteroONull(timeMatch[2]) ?? 0 : 0;
  const second = timeMatch && timeMatch[3] !== undefined ? aEnteroONull(timeMatch[3]) ?? 0 : 0;

  return new Date(year, month - 1, day, hour, minute, second, 0);
}

function parseFechaCompletaConSeparados(fechaStr, horaStr) {
  const dateMatch = DATE_REGEX.exec(fechaStr);
  if (!dateMatch) return null;
  const day = aEnteroONull(dateMatch[1]);
  const month = aEnteroONull(dateMatch[2]);
  let year = aEnteroONull(dateMatch[3]);
  if (day === null || month === null || year === null) return null;
  if (year < 100) year += 2000;
  if (year < 2000) return null;

  const timeMatch = TIME_REGEX.exec(horaStr) || TIME_REGEX_FLEX.exec(horaStr);
  const hour = timeMatch ? aEnteroONull(timeMatch[1]) ?? 0 : 0;
  const minute = timeMatch ? aEnteroONull(timeMatch[2]) ?? 0 : 0;

  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function extractFecha(lines) {
  let fechaStr = null;
  let horaStr = null;

  const fechaValue = findLabelValue(lines, ["fecha y hora", "fecha/hora", "fecha", "fecha y hora de operacion"]);
  const horaValue = findLabelValue(lines, ["hora", "h0ra"]);

  if (fechaValue !== null) {
    const combined = `${fechaValue} ${horaValue ?? ""}`;
    const combinedHasTime = horaValue !== null || TIME_REGEX.test(fechaValue) || TIME_REGEX_FLEX.test(fechaValue);
    if (combinedHasTime) {
      const parsed = parseFechaCompleta(combined.trim());
      if (parsed) return parsed;
    }
    horaStr = buscarHoraTrasLabelFechaYHora(lines);
    const parsed = parseFechaCompleta(fechaValue);
    if (parsed) {
      fechaStr = fechaValue;
      if (horaValue !== null) horaStr = horaValue;
    }
  }

  if (horaValue !== null && horaStr === null) horaStr = horaValue;
  if (fechaStr !== null && horaStr === null) horaStr = buscarHoraEnLineasCercanas(lines);
  if (fechaStr !== null && horaStr !== null) return parseFechaCompletaConSeparados(fechaStr, horaStr);

  for (const line of lines) {
    const text = line.text.trim();
    const dateMatch = DATE_REGEX.exec(text);
    if (dateMatch) {
      const timeMatch = TIME_REGEX.exec(text);
      if (timeMatch) {
        const parsed = parseFechaCompleta(`${dateMatch[0]} ${timeMatch[0]}`);
        if (parsed) return parsed;
      }
    }
  }

  if (fechaStr !== null) return parseFechaCompleta(fechaStr);

  const dateLine = lines.find((l) => DATE_REGEX.test(l.text));
  if (dateLine) {
    const dateMatch = DATE_REGEX.exec(dateLine.text);
    const timeMatch = TIME_REGEX.exec(dateLine.text);
    const datePart = dateMatch ? dateMatch[0] : "";
    const timePart = timeMatch ? timeMatch[0] : "";
    if (!timePart) {
      const horaCercana = buscarHoraEnLineasCercanas(lines);
      if (horaCercana) {
        const parsed = parseFechaCompleta(`${datePart} ${horaCercana}`);
        if (parsed) return parsed;
      }
    } else {
      const parsed = parseFechaCompleta(`${datePart} ${timePart}`);
      if (parsed) return parsed;
    }
  }

  const horaGlobal = buscarHoraGlobal(lines);
  if (horaGlobal) {
    const globalDateLine = lines.find((l) => DATE_REGEX.test(l.text));
    if (!globalDateLine) return null;
    const dateMatch = DATE_REGEX.exec(globalDateLine.text);
    if (!dateMatch) return null;
    const parsed = parseFechaCompleta(`${dateMatch[0]} ${horaGlobal}`);
    if (parsed) return parsed;
  }

  return null;
}

// lines: LineInfo[] (ver construirBloques.js). Devuelve
// { comercio, monto, fecha, detalle } o null si no hay suficientes
// palabras clave de transferencia (esTransferencia, red de seguridad
// interna aunque el router ya haya clasificado antes).
export function parsearTransferencia(lines) {
  const allText = lines.map((l) => l.text).join("\n");
  const allTextLower = allText.toLowerCase();
  if (!esTransferencia(allTextLower)) return null;

  return {
    comercio: extractComercio(lines),
    monto: extractMonto(lines),
    fecha: extractFecha(lines),
    detalle: null, // extractDetalle en el Kotlin original siempre devolvía null.
  };
}
