// Formato del archivo de respaldo (exportar/importar datos en Configuración).
// Funciones puras: no tocan Supabase, solo arman/leen/validan el objeto que
// se serializa a JSON. La lectura/escritura real vive en data/exportacion.js.

export const VERSION_FORMATO = 1;

// Identificador estable de un movimiento: no depende del id de fila (que
// cambia al reimportar en otra cuenta o tabla), sino de su contenido. Mismo
// criterio que ya usa buscarMovimientoDuplicado (data/movimientos.js) para
// detectar comprobantes cargados dos veces — así "duplicado" significa lo
// mismo en toda la app.
export function claveMovimiento({ modo, monto, fecha, nombre }) {
  return `${modo}|${Number(monto)}|${fecha}|${String(nombre || "").trim().toLowerCase()}`;
}

// Identifica una categoría "equivalente" al importar (mismo nombre, tipo y
// modo) para no crear duplicados si ya existe una similar.
export function claveCategoria({ modo, tipo, nombre }) {
  return `${modo}|${tipo}|${String(nombre || "").trim().toLowerCase()}`;
}

// `categorias` y `movimientos` ya vienen filtrados/traídos de Supabase.
// `filtros` es informativo (queda en el archivo para referencia del usuario,
// no se usa al importar).
export function construirArchivoExportacion({ movimientos, categorias, filtros }) {
  return {
    version: VERSION_FORMATO,
    app: "finanzas-web",
    generadoEn: new Date().toISOString(),
    filtros,
    categorias: categorias.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      tipo: c.tipo,
      modo: c.modo,
      color: c.color,
      emoji: c.emoji,
      icono: c.icono,
      orden: c.orden,
    })),
    movimientos: movimientos.map((m) => ({
      idExportacion: claveMovimiento(m),
      nombre: m.nombre,
      monto: m.monto,
      tipo: m.tipo,
      modo: m.modo,
      pagado: m.pagado,
      activo: m.activo,
      recurrente: m.recurrente,
      frecuencia: m.frecuencia,
      fecha: m.fecha,
      detalle: m.detalle,
      categoria_id: m.categoria_id ?? null,
    })),
  };
}

// Lanza con un mensaje entendible por el usuario si el archivo no es un
// respaldo válido de Finanzas o es de una versión que esta app no sabe leer.
export function validarArchivoImportado(json) {
  if (!json || typeof json !== "object") {
    throw new Error("El archivo no tiene un formato válido.");
  }
  if (json.version !== VERSION_FORMATO) {
    throw new Error("El archivo fue generado con una versión de Finanzas incompatible con esta.");
  }
  if (!Array.isArray(json.movimientos) || !Array.isArray(json.categorias)) {
    throw new Error("El archivo no tiene el formato esperado de un respaldo de Finanzas.");
  }
}

// Resumen para mostrar antes de confirmar la importación. `clavesExistentes`
// es un Set con claveMovimiento(...) de los movimientos ya guardados.
export function resumenImportacion(json, clavesExistentes) {
  const { movimientos, categorias } = json;
  // Copia local: si el propio archivo trae el mismo movimiento repetido dos
  // veces, la segunda aparición debe contarse como "ya existente" (se
  // omite), igual que hará la importación real.
  const vistas = new Set(clavesExistentes);
  let gastos = 0;
  let ingresos = 0;
  let reales = 0;
  let estimados = 0;
  let nuevos = 0;
  for (const m of movimientos) {
    if (m.tipo === "gasto") gastos++;
    else if (m.tipo === "ingreso") ingresos++;
    if (m.modo === "real") reales++;
    else if (m.modo === "estimado") estimados++;
    const clave = claveMovimiento(m);
    if (!vistas.has(clave)) {
      nuevos++;
      vistas.add(clave);
    }
  }
  return {
    totalMovimientos: movimientos.length,
    totalCategorias: categorias.length,
    gastos,
    ingresos,
    reales,
    estimados,
    nuevos,
    omitidos: movimientos.length - nuevos,
  };
}
