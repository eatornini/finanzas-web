// Parser para comprobantes con formato de tabla "etiqueta / valor", típicos
// de los vouchers y correos de POS y bancos chilenos (TUU, Transbank, etc.):
//
//   Número tarjeta débito   ****5925
//   Monto                   $3.400
//   Fecha                   07/09/2026
//   Hora                    20:30 horas
//   Comercio                TUU*DIERO I
//
// Se distingue de los screenshots tipo Google Wallet (que NO traen una
// etiqueta "Comercio") justamente por la presencia de esa etiqueta. Solo se
// activa cuando encuentra la etiqueta "Comercio" con valor y además un monto,
// así que no interfiere con parsearCompra() —extracción por geometría— que ya
// funciona para los otros comprobantes.
//
// Excepción: el detalle de compra de algunos bancos (p.ej. BCI: "Fecha de la
// compra / Hora de la compra / Nombre del comercio / Rubro / ...") NO muestra
// el monto. Si no aparece NINGUNA etiqueta de monto se devuelve igual
// comercio + fecha con `monto: null` y `montoAusente: true`, para que el
// formulario cargue lo que hay y no reintente el OCR buscando un monto que
// no existe.
//
// Tesseract corre en PSM 11 (sparse text): la salida viene fragmentada y sin
// un orden de lectura confiable, así que la etiqueta y su valor casi nunca
// quedan en la misma línea de texto. Por eso el emparejamiento etiqueta→valor
// es geométrico: se busca el/los fragmento(s) que caen en la MISMA fila
// visual (solape vertical) que la etiqueta y se concatenan de izquierda a
// derecha. Recién si eso no da nada se cae a un escaneo por líneas, acotado a
// las que están entre esta etiqueta y la siguiente.

const MONTO_NUM = "[\\d]+(?:[.,]\\d{3})*(?:[.,]\\d{1,2})?";
const DATE_REGEX = /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/;
const TIME_REGEX = /(\d{1,2})[:.](\d{2})/;

// Ordenadas de más específica a más genérica dentro de cada grupo para que la
// etiqueta larga gane sobre la corta ("monto total" antes que "monto").
const COMERCIO_LABELS = [
  "nombre del comercio", "nombre comercio", "comercio", "establecimiento", "local",
];
const MONTO_LABELS = [
  "monto total", "monto compra", "valor compra", "monto", "importe", "valor", "total",
];
const FECHA_LABELS = [
  "fecha de la compra", "fecha de compra", "fecha compra", "fecha transacción", "fecha transaccion", "fecha",
];
const HORA_LABELS = [
  "hora de la compra", "hora de compra", "hora compra", "hora transacción", "hora transaccion", "hora",
];

// Cualquier etiqueta conocida — sirve para no tomar la etiqueta siguiente
// como si fuera el valor de la actual.
const TODAS_LABELS = [
  ...COMERCIO_LABELS, ...MONTO_LABELS, ...FECHA_LABELS, ...HORA_LABELS,
  "número tarjeta débito", "numero tarjeta debito",
  "número tarjeta crédito", "numero tarjeta credito",
  "número de tarjeta", "numero de tarjeta", "tarjeta", "terminada en",
  "código de autorización", "codigo de autorizacion",
  "código autorización", "codigo autorizacion",
  "tipo de transacción", "tipo de transaccion",
  "número de operación", "numero de operacion", "n° de operación", "n° de operacion",
  "folio", "terminal", "número de boleta", "numero de boleta",
  // Detalle de compra BCI.
  "fecha contable", "tipo de compra", "rubro", "rut", "comuna", "tipo de movimiento",
  "n° de tarjeta", "nº de tarjeta", "n? de tarjeta", "código transacción",
  "codigo transaccion", "código de transacción", "codigo de transaccion",
];

function aDecimalONull(s) {
  if (typeof s !== "string" || s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function limpiarValor(value) {
  let v = value.trim();
  for (const p of [":", "-", ">", "→", "|"]) if (v.startsWith(p)) v = v.slice(p.length).trim();
  for (const s of [":", "-", "|"]) if (v.endsWith(s)) v = v.slice(0, -s.length).trim();
  return v.trim();
}

// true si el texto ES una etiqueta. Para las etiquetas compuestas (con
// espacio) también vale que EMPIECE con ella —así "Número tarjeta débito
// ****5925" en un solo fragmento cuenta como etiqueta—, pero NO para las
// cortas de una palabra, para no descartar comercios como "Total Market".
function esAlgunaLabel(text) {
  const l = text.toLowerCase().trim();
  return TODAS_LABELS.some((lab) => {
    if (l === lab || l === `${lab}:`) return true;
    if (lab.includes(" ") && (l.startsWith(`${lab} `) || l.startsWith(`${lab}:`))) return true;
    return false;
  });
}

function seSolapanVert(a, b) {
  return a.top < b.bottom && b.top < a.bottom;
}

// Fragmentos que comparten fila visual con `labelLine` (no la etiqueta misma,
// no otra etiqueta), ordenados de izquierda a derecha.
function fragmentosEnFila(lines, labelLine) {
  return lines
    .filter((l) => l !== labelLine)
    .filter((l) => seSolapanVert(l, labelLine))
    .filter((l) => l.text.trim().length > 0 && !esAlgunaLabel(l.text.trim()))
    .sort((a, b) => a.left - b.left);
}

// Índice de la primera línea (a partir de `desde`) que es otra etiqueta, o
// lines.length si no hay ninguna. Acota el escaneo por líneas para no cruzar
// a la fila siguiente.
function indiceProximaLabel(lines, desde) {
  for (let i = desde; i < lines.length; i++) {
    if (esAlgunaLabel(lines[i].text.trim())) return i;
  }
  return lines.length;
}

// Devuelve el valor asociado a alguna de `labels`. `valida` filtra los
// candidatos: p.ej. para la hora, "Hora de" (OCR que partió "Hora de la
// compra") con prefijo "hora" daría "de" como valor — al no tener formato de
// hora se descarta y se sigue con la geometría de la fila.
function valorDeLabel(lines, labels, valida = () => true) {
  const ok = (v) => v.length > 1 && valida(v);
  for (const label of labels) {
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i].text.trim();
      const lower = raw.toLowerCase();
      const soloLabel = lower.replace(/[\s:>\-|]+$/, "");

      // 1) Etiqueta y valor en el mismo fragmento: "Monto $3.400".
      if (soloLabel !== label) {
        const prefijo = new RegExp(`^${label}\\s*[:>\\-|]?\\s+(.+)$`, "i");
        const m = prefijo.exec(raw);
        if (!m) continue;
        const v = limpiarValor(m[1]);
        if (ok(v) && !esAlgunaLabel(v)) return v;
        // Lo que sigue a la etiqueta no sirve (p.ej. resto de una etiqueta
        // más larga, "de la compra:"): se prueba la geometría igual.
      }

      // 2) Valor por geometría (misma fila visual).
      const fila = fragmentosEnFila(lines, lines[i]);
      if (fila.length) {
        const v = limpiarValor(fila.map((l) => l.text.trim()).join(" "));
        if (ok(v)) return v;
      }

      // 3) Fallback sin geometría: primera línea no vacía antes de la próxima
      //    etiqueta (evita saltar a la fila siguiente y agarrar otro valor).
      const fin = indiceProximaLabel(lines, i + 1);
      for (let j = i + 1; j < fin; j++) {
        const next = limpiarValor(lines[j].text.trim());
        if (next.length > 1) {
          if (ok(next)) return next;
          break;
        }
      }
    }
  }
  return null;
}

// "$3.400" -> 3400 ; "15.990" -> 15990 ; "$3 400" -> 3400 ; "1.234,56" -> 1234.56
function parsearMonto(text) {
  const t = text.trim();
  if (/[*•xX]{3,}/.test(t)) return null; // número de tarjeta enmascarado
  if (/\d{1,2}:\d{2}/.test(t)) return null; // es una hora ("20:30 horas")
  if (/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(t)) return null; // es una fecha

  const m = new RegExp(MONTO_NUM).exec(t);
  if (!m) return null;
  const raw = m[0];

  // ¿Trae decimales reales? = un separador seguido de 1-2 dígitos al final,
  // y que NO sea un patrón puro de miles ("1.234.567").
  const tieneDecimales =
    /[.,]\d{1,2}$/.test(raw) && !/^\d{1,3}(?:[.,]\d{3})+$/.test(raw);
  if (tieneDecimales) {
    const li = Math.max(raw.lastIndexOf(","), raw.lastIndexOf("."));
    const intPart = raw.slice(0, li).replace(/[.,\s]/g, "");
    const decPart = raw.slice(li + 1).slice(0, 2);
    const value = aDecimalONull(`${intPart}.${decPart}`);
    if (value !== null && value > 0) return value;
    return null;
  }

  // Monto entero: se juntan TODOS los dígitos del texto, así el separador de
  // miles da igual si viene como punto, coma o espacio ("$3.400", "$3 400").
  const digits = (t.match(/\d/g) || []).join("");
  if (digits.length >= 2 && digits.length <= 9) {
    const value = aDecimalONull(digits);
    if (value !== null && value > 0) return value;
  }
  return null;
}

function parsearFecha(fechaTexto, horaTexto, lines) {
  let fuenteFecha = fechaTexto || "";
  if (!DATE_REGEX.test(fuenteFecha)) {
    const linea = (lines || []).find((l) => DATE_REGEX.test(l.text));
    if (linea) fuenteFecha = linea.text;
  }
  const dm = DATE_REGEX.exec(fuenteFecha);
  if (!dm) return null;
  const day = parseInt(dm[1], 10);
  const month = parseInt(dm[2], 10);
  let year = parseInt(dm[3], 10);
  if (year < 100) year += 2000;
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000) return null;

  let hour = 0;
  let minute = 0;
  // Último recurso: un fragmento que sea SOLO una hora ("17:01", "20:30
  // horas"), para cuando el OCR rompió la etiqueta de hora.
  const lineaHora = (lines || []).find((l) =>
    /^\s*\d{1,2}:\d{2}(?:\s*(?:hrs?\.?|horas))?\s*$/i.test(l.text)
  );
  const tm =
    TIME_REGEX.exec(horaTexto || "") ||
    TIME_REGEX.exec(fechaTexto || "") ||
    (lineaHora ? TIME_REGEX.exec(lineaHora.text) : null);
  if (tm) {
    hour = parseInt(tm[1], 10);
    minute = parseInt(tm[2], 10);
    if (hour > 23 || minute > 59) {
      hour = 0;
      minute = 0;
    }
  }
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

// lines: LineInfo[] (ver construirBloques.js). Devuelve { comercio, monto,
// fecha } o null si el comprobante no tiene el formato de tabla etiquetado
// (en cuyo caso el llamador cae al parser por geometría).
export function parsearComprobanteTabular(lines) {
  const comercio = valorDeLabel(lines, COMERCIO_LABELS) ?? comercioDeEncabezado(lines);
  if (comercio === null) return null;

  const fechaTexto = valorDeLabel(lines, FECHA_LABELS, (v) => DATE_REGEX.test(v));
  const horaTexto = valorDeLabel(lines, HORA_LABELS, (v) => TIME_REGEX.test(v));
  const fecha = parsearFecha(fechaTexto, horaTexto, lines);

  const montoTexto = valorDeLabel(lines, MONTO_LABELS);
  const monto = montoTexto !== null ? parsearMonto(montoTexto) : null;
  if (monto !== null) return { comercio, monto, fecha };

  // Sin monto: solo se acepta si el comprobante no tiene ninguna etiqueta de
  // monto (detalle de compra que no lo muestra). Si la etiqueta está pero el
  // valor no se pudo leer, decide el parser por geometría, como antes.
  if (hayEtiquetaMonto(lines) || !fecha) return null;

  // El detalle BCI capturado junto con la fila del movimiento trae el monto
  // arriba, sin etiqueta ("Compra con Tarjeta de Débito en CRUZ VERDE
  // $4.990"). Se toma el primer importe con "$" de la captura.
  const montoSuelto = montoConSigno(lines);
  if (montoSuelto !== null) return { comercio, monto: montoSuelto, fecha };
  return { comercio, monto: null, fecha, montoAusente: true };
}

// Respaldo si el OCR no leyó la etiqueta "Nombre del comercio": la fila del
// movimiento BCI dice "Compra con Tarjeta de Débito en RIKO / POLLO
// 11001SANTIAGCHL" (el nombre puede seguir en la línea de abajo, alineada a
// la izquierda del texto). Devuelve el nombre o null.
const ENCABEZADO_REGEX = /tarjeta\s+de\s+(?:d[eé]bito|cr[eé]dito)\s+en\s*(.*)$/i;

function comercioDeEncabezado(lines) {
  const ordenadas = [...lines].sort((a, b) => a.top - b.top || a.left - b.left);
  for (let i = 0; i < ordenadas.length; i++) {
    const l = ordenadas[i];
    const m = ENCABEZADO_REGEX.exec(l.text);
    if (!m) continue;
    const partes = [m[1].trim()].filter(Boolean);
    // Continuación: fragmento justo debajo, que arranca cerca del mismo
    // borde izquierdo y no tiene "$" (el monto va a la derecha).
    const alto = l.bottom - l.top || 24;
    const sigue = ordenadas.find(
      (o) =>
        o !== l &&
        o.top >= l.bottom - alto * 0.3 &&
        o.top <= l.bottom + alto * 1.2 &&
        Math.abs(o.left - l.left) <= alto * 2 &&
        !o.text.includes("$") &&
        !esAlgunaLabel(o.text.trim())
    );
    if (sigue) partes.push(sigue.text.trim());
    const nombre = partes.join(" ").trim();
    if (nombre.length > 1) return nombre;
  }
  return null;
}

// Primer importe precedido por "$" en cualquier fragmento, o null. Exige el
// "$" para no confundir RUT, código de transacción o N° de tarjeta con montos.
//
// Tesseract suele leer el "$" como "S" o "§" ("S4.100"), así que se aceptan
// también, siempre al inicio de palabra (no matchea "11001SANTIAGCHL", que
// lleva letras después de la S). Último recurso: un fragmento que sea SOLO un
// número con separador de miles ("4.100") — el "$" se perdió del todo. El
// RUT ("89.807.200-2") queda afuera por el guion y dígito verificador.
const SIGNO_MONTO_REGEX = new RegExp(`(?:^|[^\\w])[$S§]\\s*(${MONTO_NUM})(?![\\w-])`);
const MONTO_SOLO_REGEX = /^\s*\d{1,3}(?:\.\d{3})+\s*$/;

function montoConSigno(lines) {
  const ordenadas = [...lines].sort((a, b) => a.top - b.top || a.left - b.left);
  for (const l of ordenadas) {
    const m = SIGNO_MONTO_REGEX.exec(l.text);
    if (!m) continue;
    const v = parsearMonto(m[1]);
    if (v !== null) return v;
  }
  for (const l of ordenadas) {
    if (!MONTO_SOLO_REGEX.test(l.text)) continue;
    const v = parsearMonto(l.text);
    if (v !== null) return v;
  }
  return null;
}

function hayEtiquetaMonto(lines) {
  return lines.some((l) => {
    const t = l.text.toLowerCase();
    return MONTO_LABELS.some((lab) =>
      new RegExp(`(^|[^a-záéíóúñ])${lab}([^a-záéíóúñ]|$)`).test(t)
    );
  });
}
