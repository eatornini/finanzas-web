// Sección "Exportar / Importar datos" de Configuración: respaldo y
// restauración de movimientos y categorías, más una "Zona de peligro" para
// borrar todo (usada también por el modo "Reemplazar todo" de importar).
// Vive en su propio módulo (igual que el resto de las secciones grandes de
// la app) para no inflar configuracionView.js; se monta exactamente igual
// que montarSeccionMesEstimado, pero contra dos tarjetas separadas.
import { el, limpiar } from "./dom.js";
import { montarModal } from "./modal.js";
import { rangoPeriodo, etiquetaPeriodo, periodoAnterior, periodoSiguiente } from "../logic/periodos.js";
import {
  construirArchivoExportacion,
  validarArchivoImportado,
  resumenImportacion,
  claveMovimiento,
  claveCategoria,
} from "../logic/exportacionDatos.js";
import {
  listarMovimientosParaExportar,
  listarClavesMovimientos,
  insertarMovimientosLote,
  contarTodosLosDatos,
  borrarTodosLosDatos,
} from "../data/exportacion.js";
import { listarCategorias, crearCategoria } from "../data/categorias.js";
import { mostrarOverlayCarga } from "./overlayCarga.js";
import { descargaIcono, subidaIcono, flechaIzq, flechaDer, basura, alertaIcono } from "./iconos.js";
import { iconoTitulo } from "./tituloVista.js";

function campoSelect(etiqueta, select) {
  return el("label", { class: "campo" }, [etiqueta, select]);
}

// "1 movimiento" / "2 movimientos" — `plural` solo hace falta cuando no es
// agregar una "s" (p. ej. "real" → "reales", "categoría" → "categorías").
function contar(n, singular, plural = `${singular}s`) {
  return `${n} ${n === 1 ? singular : plural}`;
}

function lineaTexto(clase, texto) {
  return el("p", { class: clase, text: texto });
}

function descargarJson(obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `finanzas-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Confirmación reforzada para un borrado total (movimientos + categorías):
// no alcanza con un confirm() nativo como en un borrado puntual, porque acá
// se pierde todo de una. Hay que escribir la frase exacta para habilitar el
// botón. Cierra el modal y recién ahí llama a onConfirmar — los estados de
// carga/error de la acción en sí los maneja quien llama.
function abrirConfirmacionBorrado({ conteo, notaExtra, onConfirmar }) {
  const FRASE = "BORRAR TODO";
  const input = el("input", {
    type: "text",
    placeholder: FRASE,
    "aria-label": `Escribí "${FRASE}" para confirmar`,
  });
  const btnConfirmar = el(
    "button",
    { type: "button", class: "boton--primario boton--peligro", disabled: "true" },
    [basura(), el("span", { text: "Borrar todo" })]
  );
  input.addEventListener("input", () => {
    btnConfirmar.disabled = input.value.trim().toUpperCase() !== FRASE;
  });
  const btnCancelar = el("button", { type: "button", text: "Cancelar", onClick: () => cerrar() });
  btnConfirmar.addEventListener("click", () => {
    cerrar();
    onConfirmar();
  });

  const contenido = el("div", { class: "expimp-peligro-modal" }, [
    el("p", {
      text:
        `Vas a borrar permanentemente ${contar(conteo.movimientos, "movimiento")} y ` +
        `${contar(conteo.categorias, "categoría", "categorías")} de tu cuenta. Esta acción no se puede deshacer.`,
    }),
    notaExtra ? el("p", { text: notaExtra }) : null,
    el("p", { text: 'Si no tenés un respaldo reciente, cancelá y usá primero "Exportar datos" más arriba.' }),
    el("label", { class: "campo" }, [`Escribí "${FRASE}" para confirmar`, input]),
  ]);

  const { cerrar } = montarModal({
    titulo: "¿Borrar todos los datos?",
    icono: alertaIcono,
    contenido,
    acciones: [btnCancelar, btnConfirmar],
    claseExtra: "modal-panel--peligro",
  });
}

export function montarSeccionExportarImportar(seccion, seccionPeligro, fechaInicial) {
  // ---------- Exportar ----------
  let modoExport = "ambos";
  let periodoModo = "mes"; // "mes" | "todos"
  let fechaMes = fechaInicial instanceof Date ? fechaInicial : new Date();
  let tipoExport = "ambos";

  const errorExport = el("p", { class: "error", role: "alert" });
  const avisoExport = el("p", { class: "aviso" });

  const selectModo = el("select", {}, [
    el("option", { value: "real", text: "Real" }),
    el("option", { value: "estimado", text: "Estimado" }),
    el("option", { value: "ambos", text: "Ambos" }),
  ]);
  selectModo.value = modoExport;
  selectModo.addEventListener("change", () => {
    modoExport = selectModo.value;
  });

  const selectPeriodo = el("select", {}, [
    el("option", { value: "mes", text: "Un mes específico" }),
    el("option", { value: "todos", text: "Todos los meses" }),
  ]);
  selectPeriodo.value = periodoModo;
  selectPeriodo.addEventListener("change", () => {
    periodoModo = selectPeriodo.value;
    navegadorMes.hidden = periodoModo !== "mes";
  });

  const etiquetaMes = el("span", { class: "periodo-label" });
  function sincronizarEtiquetaMes() {
    etiquetaMes.textContent = etiquetaPeriodo(fechaMes, "mes");
  }
  sincronizarEtiquetaMes();
  const navegadorMes = el("div", { class: "navegador-periodo" }, [
    el(
      "button",
      {
        type: "button",
        class: "boton--icono",
        "aria-label": "Mes anterior",
        onClick: () => {
          fechaMes = periodoAnterior(fechaMes, "mes");
          sincronizarEtiquetaMes();
        },
      },
      [flechaIzq()]
    ),
    etiquetaMes,
    el(
      "button",
      {
        type: "button",
        class: "boton--icono",
        "aria-label": "Mes siguiente",
        onClick: () => {
          fechaMes = periodoSiguiente(fechaMes, "mes");
          sincronizarEtiquetaMes();
        },
      },
      [flechaDer()]
    ),
  ]);
  // Estado inicial explícito: no depender de que el valor por defecto de
  // periodoModo ("mes") coincida "por las dudas" con lo que se ve.
  navegadorMes.hidden = periodoModo !== "mes";

  const selectTipo = el("select", {}, [
    el("option", { value: "ambos", text: "Gastos e ingresos" }),
    el("option", { value: "gasto", text: "Solo gastos" }),
    el("option", { value: "ingreso", text: "Solo ingresos" }),
  ]);
  selectTipo.value = tipoExport;
  selectTipo.addEventListener("change", () => {
    tipoExport = selectTipo.value;
  });

  const btnExportar = el("button", { type: "button", class: "boton--primario" }, [
    descargaIcono(),
    el("span", { text: "Exportar datos" }),
  ]);
  btnExportar.addEventListener("click", () => exportar());

  async function exportar() {
    errorExport.textContent = "";
    avisoExport.textContent = "";
    btnExportar.disabled = true;
    const ocultar = mostrarOverlayCarga("Preparando exportación…");
    try {
      const rango = periodoModo === "mes" ? rangoPeriodo(fechaMes, "mes") : { desde: null, hasta: null };
      const [movimientos, categorias] = await Promise.all([
        listarMovimientosParaExportar({ modo: modoExport, tipo: tipoExport, ...rango }),
        listarCategorias(),
      ]);
      const archivo = construirArchivoExportacion({
        movimientos,
        categorias,
        filtros: {
          modo: modoExport,
          tipo: tipoExport,
          periodo: periodoModo === "mes" ? { ...rango, etiqueta: etiquetaPeriodo(fechaMes, "mes") } : "todos",
        },
      });
      descargarJson(archivo);
      avisoExport.textContent =
        `✓ Se exportaron ${movimientos.length} movimiento${movimientos.length === 1 ? "" : "s"} ` +
        `y ${categorias.length} categoría${categorias.length === 1 ? "" : "s"}.`;
    } catch (e) {
      errorExport.textContent = "No se pudo generar el archivo de exportación.";
    } finally {
      btnExportar.disabled = false;
      ocultar();
    }
  }

  // ---------- Importar ----------
  let archivoJson = null;
  let archivoNombre = "";

  const inputArchivo = el("input", { type: "file", accept: "application/json,.json", hidden: "true" });
  const errorImport = el("p", { class: "error", role: "alert" });
  const avisoImport = el("p", { class: "aviso" });
  const analizando = el("p", { class: "expimp-analizando", text: "Analizando archivo…", hidden: "true" });

  const btnSeleccionar = el("button", { type: "button", class: "boton--secundario" }, [
    subidaIcono(),
    el("span", { text: "Seleccionar archivo" }),
  ]);
  btnSeleccionar.addEventListener("click", () => inputArchivo.click());

  const selectModoImportar = el("select", {}, [
    el("option", { value: "agregar", text: "Agregar a lo existente" }),
    el("option", { value: "reemplazar", text: "Reemplazar todo (borra lo actual)" }),
  ]);
  selectModoImportar.value = "agregar";
  selectModoImportar.addEventListener("change", () => {
    if (archivoJson) actualizarPreview();
  });

  // Nombre del archivo + resumen compacto + impacto de la importación
  // (vista previa): oculta hasta tener un archivo válido y analizado.
  const previewBox = el("div", { class: "expimp-preview", hidden: "true" });

  const btnCancelarImport = el("button", { type: "button", text: "Cancelar", onClick: () => limpiarSeleccion() });
  const btnImportar = el(
    "button",
    { type: "button", class: "boton--primario", text: "Importar datos", onClick: () => confirmarImportar() }
  );
  const accionesImport = el("div", { class: "expimp-acciones", hidden: "true" }, [btnCancelarImport, btnImportar]);

  function limpiarSeleccion() {
    archivoJson = null;
    archivoNombre = "";
    inputArchivo.value = "";
    selectModoImportar.value = "agregar";
    analizando.hidden = true;
    limpiar(previewBox);
    previewBox.hidden = true;
    accionesImport.hidden = true;
    errorImport.textContent = "";
  }

  // Lecturas de solo consulta — no crean ni modifican nada — para mostrar
  // antes de confirmar exactamente qué va a pasar. La importación real (al
  // tocar "Importar datos") vuelve a calcular todo esto desde cero por las
  // dudas de que haya cambiado algo mientras se miraba la vista previa.
  async function calcularVistaPrevia(json, modoImportar) {
    if (modoImportar === "reemplazar") {
      const actuales = await contarTodosLosDatos();
      return { modo: "reemplazar", actuales };
    }
    const [clavesMov, categoriasExistentes] = await Promise.all([
      listarClavesMovimientos(),
      listarCategorias(),
    ]);
    const resumen = resumenImportacion(json, new Set(clavesMov.map(claveMovimiento)));
    const clavesCatExistentes = new Set(categoriasExistentes.map(claveCategoria));
    const categoriasNuevas = json.categorias.filter((c) => !clavesCatExistentes.has(claveCategoria(c))).length;
    return { modo: "agregar", resumen, categoriasNuevas };
  }

  function pintarPreview(nombreArchivo, json, vistaPrevia) {
    limpiar(previewBox);
    const lineas = [lineaTexto("expimp-archivo-nombre", nombreArchivo)];

    if (vistaPrevia.modo === "reemplazar") {
      lineas.push(
        lineaTexto(
          "expimp-stat-linea",
          `${contar(json.movimientos.length, "movimiento")} · ${contar(json.categorias.length, "categoría", "categorías")} en el archivo`
        ),
        el("hr", { class: "expimp-preview-divisor" }),
        lineaTexto(
          "expimp-preview-linea expimp-preview-linea--peligro",
          `⚠ Se borrarán tus ${contar(vistaPrevia.actuales.movimientos, "movimiento")} y ` +
            `${contar(vistaPrevia.actuales.categorias, "categoría", "categorías")} actuales`
        ),
        lineaTexto(
          "expimp-preview-linea",
          `✓ Se importarán ${contar(json.movimientos.length, "movimiento")} y ` +
            `${contar(json.categorias.length, "categoría", "categorías")}`
        )
      );
      previewBox.append(...lineas);
      return;
    }

    const { resumen, categoriasNuevas } = vistaPrevia;
    lineas.push(
      lineaTexto(
        "expimp-stat-linea",
        `${contar(resumen.totalMovimientos, "movimiento")} · ${contar(resumen.totalCategorias, "categoría", "categorías")}`
      ),
      lineaTexto("expimp-stat-linea", `${contar(resumen.gastos, "gasto")} · ${contar(resumen.ingresos, "ingreso")}`),
      lineaTexto(
        "expimp-stat-linea",
        `${contar(resumen.reales, "real", "reales")} · ${contar(resumen.estimados, "estimado")}`
      ),
      el("hr", { class: "expimp-preview-divisor" })
    );
    if (resumen.nuevos > 0) {
      lineas.push(
        lineaTexto(
          "expimp-preview-linea",
          `✓ Se importarán ${contar(resumen.nuevos, "movimiento nuevo", "movimientos nuevos")}`
        )
      );
    } else {
      lineas.push(
        lineaTexto("expimp-preview-linea expimp-preview-linea--secundaria", "No hay movimientos nuevos para importar.")
      );
    }
    if (resumen.omitidos > 0) {
      lineas.push(
        lineaTexto(
          "expimp-preview-linea expimp-preview-linea--secundaria",
          `${contar(resumen.omitidos, "movimiento", "movimientos")} ya existe${resumen.omitidos === 1 ? "" : "n"} y se omitirá${resumen.omitidos === 1 ? "" : "n"}`
        )
      );
    }
    if (categoriasNuevas > 0) {
      lineas.push(
        lineaTexto(
          "expimp-preview-linea expimp-preview-linea--secundaria",
          `Se creará${categoriasNuevas === 1 ? "" : "n"} ${contar(categoriasNuevas, "categoría nueva", "categorías nuevas")}`
        )
      );
    }
    previewBox.append(...lineas);
  }

  async function actualizarPreview() {
    if (!archivoJson) return;
    errorImport.textContent = "";
    previewBox.hidden = true;
    accionesImport.hidden = true;
    analizando.hidden = false;
    try {
      const vistaPrevia = await calcularVistaPrevia(archivoJson, selectModoImportar.value);
      pintarPreview(archivoNombre, archivoJson, vistaPrevia);
      previewBox.hidden = false;
      accionesImport.hidden = false;
      btnImportar.disabled = vistaPrevia.modo === "agregar" && vistaPrevia.resumen.nuevos === 0;
    } catch (e) {
      errorImport.textContent = "No se pudo analizar el archivo.";
    } finally {
      analizando.hidden = true;
    }
  }

  inputArchivo.addEventListener("change", async () => {
    const archivo = inputArchivo.files?.[0];
    if (!archivo) return;
    errorImport.textContent = "";
    avisoImport.textContent = "";
    previewBox.hidden = true;
    accionesImport.hidden = true;
    selectModoImportar.value = "agregar";
    analizando.hidden = false;
    try {
      const texto = await archivo.text();
      const json = JSON.parse(texto);
      validarArchivoImportado(json);
      archivoJson = json;
      archivoNombre = archivo.name;
      await actualizarPreview();
    } catch (e) {
      archivoJson = null;
      errorImport.textContent =
        e instanceof SyntaxError ? "El archivo no es un JSON válido." : e.message || "No se pudo leer el archivo.";
      analizando.hidden = true;
    }
  });

  async function confirmarImportar() {
    if (!archivoJson) return;
    if (selectModoImportar.value === "reemplazar") {
      errorImport.textContent = "";
      btnImportar.disabled = true;
      try {
        const conteo = await contarTodosLosDatos();
        abrirConfirmacionBorrado({
          conteo,
          notaExtra: "Inmediatamente después se importará el archivo seleccionado.",
          onConfirmar: () => ejecutarImportacion(true),
        });
      } catch (e) {
        errorImport.textContent = "No se pudo consultar el estado actual de tus datos.";
      } finally {
        btnImportar.disabled = false;
      }
      return;
    }
    await ejecutarImportacion(false);
  }

  async function ejecutarImportacion(reemplazar) {
    btnImportar.disabled = true;
    btnCancelarImport.disabled = true;
    errorImport.textContent = "";
    const ocultar = mostrarOverlayCarga(reemplazar ? "Borrando datos actuales…" : "Importando datos…");
    try {
      if (reemplazar) {
        await borrarTodosLosDatos();
      }

      // Categorías: reutiliza una existente equivalente (mismo nombre+tipo+modo)
      // o crea una nueva — nunca duplica. En modo reemplazar no queda ninguna
      // existente (recién se borraron todas), así que esto termina creando
      // todas las del archivo.
      const existentes = await listarCategorias();
      const mapaExistentes = new Map(existentes.map((c) => [claveCategoria(c), c.id]));
      const mapaArchivoADb = new Map();
      let categoriasCreadas = 0;
      for (const c of archivoJson.categorias) {
        const clave = claveCategoria(c);
        let id = mapaExistentes.get(clave);
        if (!id) {
          const creada = await crearCategoria({
            nombre: c.nombre,
            tipo: c.tipo,
            modo: c.modo,
            color: c.color,
            emoji: c.emoji,
            icono: c.icono,
            orden: c.orden ?? 0,
          });
          id = creada.id;
          mapaExistentes.set(clave, id);
          categoriasCreadas++;
        }
        mapaArchivoADb.set(String(c.id), id);
      }

      // Movimientos: se recalculan las claves existentes acá (no se reutiliza
      // el set de la vista previa) para no duplicar si el archivo se importó
      // de nuevo mientras se miraba el resumen. También se van sumando las
      // claves ya aceptadas en este mismo lote, por si el archivo trae el
      // mismo movimiento repetido dos veces. En modo reemplazar no queda
      // ninguna existente, así que esto termina aceptando todo el archivo.
      const clavesExistentes = new Set((await listarClavesMovimientos()).map(claveMovimiento));
      const nuevos = [];
      for (const m of archivoJson.movimientos) {
        const clave = claveMovimiento(m);
        if (clavesExistentes.has(clave)) continue;
        clavesExistentes.add(clave);
        nuevos.push(m);
      }
      const filas = nuevos.map((m) => ({
        nombre: m.nombre,
        monto: m.monto,
        tipo: m.tipo,
        modo: m.modo,
        pagado: m.pagado,
        activo: m.activo,
        recurrente: m.recurrente,
        frecuencia: m.frecuencia,
        categoria_id: m.categoria_id != null ? mapaArchivoADb.get(String(m.categoria_id)) ?? null : null,
        fecha: m.fecha,
        detalle: m.detalle,
      }));
      const insertados = await insertarMovimientosLote(filas);
      const omitidos = archivoJson.movimientos.length - nuevos.length;

      const mensaje =
        `✓ Se importaron ${insertados} movimiento${insertados === 1 ? "" : "s"} nuevo${insertados === 1 ? "" : "s"}` +
        (categoriasCreadas > 0
          ? ` y se ${categoriasCreadas === 1 ? "creó" : "crearon"} ${categoriasCreadas} categoría${categoriasCreadas === 1 ? "" : "s"} nueva${categoriasCreadas === 1 ? "" : "s"}`
          : "") +
        (omitidos > 0 ? `. Se omitieron ${omitidos} por ya existir.` : ".");
      limpiarSeleccion();
      avisoImport.textContent = mensaje;
    } catch (e) {
      errorImport.textContent = "No se pudo completar la importación.";
    } finally {
      btnCancelarImport.disabled = false;
      ocultar();
    }
  }

  seccion.append(
    el("h3", {}, [iconoTitulo(descargaIcono), "Exportar / Importar datos"]),
    el("span", {
      class: "config-color-ayuda",
      text: "Respalda o restaura tus movimientos y categorías en un archivo.",
    }),

    el("div", { class: "expimp-bloque" }, [
      el("h4", { class: "expimp-subtitulo", text: "Exportar datos" }),
      el("div", { class: "expimp-filtros" }, [
        campoSelect("Modo", selectModo),
        campoSelect("Período", selectPeriodo),
        campoSelect("Tipo", selectTipo),
      ]),
      navegadorMes,
      el("div", { class: "expimp-acciones" }, [btnExportar]),
      avisoExport,
      errorExport,
    ]),

    el("div", { class: "expimp-bloque" }, [
      el("h4", { class: "expimp-subtitulo", text: "Importar datos" }),
      el("p", {
        class: "config-color-ayuda",
        text: "Selecciona un archivo previamente exportado desde Finanzas.",
      }),
      el("div", { class: "expimp-seleccionar" }, [btnSeleccionar]),
      inputArchivo,
      analizando,
      previewBox,
      campoSelect("Cómo importar", selectModoImportar),
      accionesImport,
      avisoImport,
      errorImport,
    ])
  );

  // ---------- Zona de peligro ----------
  const errorPeligro = el("p", { class: "error", role: "alert" });
  const avisoPeligro = el("p", { class: "aviso" });
  const btnBorrarTodo = el("button", { type: "button", class: "boton--primario boton--peligro" }, [
    basura(),
    el("span", { text: "Borrar todos los datos" }),
  ]);
  btnBorrarTodo.addEventListener("click", async () => {
    errorPeligro.textContent = "";
    avisoPeligro.textContent = "";
    let conteo;
    try {
      conteo = await contarTodosLosDatos();
    } catch (e) {
      errorPeligro.textContent = "No se pudo consultar el estado actual de tus datos.";
      return;
    }
    if (conteo.movimientos === 0 && conteo.categorias === 0) {
      avisoPeligro.textContent = "No hay datos para borrar.";
      return;
    }
    abrirConfirmacionBorrado({ conteo, onConfirmar: () => ejecutarBorradoTotal(conteo) });
  });

  async function ejecutarBorradoTotal(conteo) {
    errorPeligro.textContent = "";
    avisoPeligro.textContent = "";
    btnBorrarTodo.disabled = true;
    const ocultar = mostrarOverlayCarga("Borrando todos los datos…");
    try {
      await borrarTodosLosDatos();
      avisoPeligro.textContent =
        `✓ Se borraron ${contar(conteo.movimientos, "movimiento")} y ` +
        `${contar(conteo.categorias, "categoría", "categorías")}.`;
    } catch (e) {
      errorPeligro.textContent = "No se pudo completar el borrado.";
    } finally {
      btnBorrarTodo.disabled = false;
      ocultar();
    }
  }

  seccionPeligro.append(
    el("h3", {}, [iconoTitulo(alertaIcono), "Zona de peligro"]),
    el("span", {
      class: "config-color-ayuda",
      text: "Borra permanentemente todos tus movimientos y categorías. Usalo solo para empezar de cero.",
    }),
    el("div", { class: "expimp-acciones" }, [btnBorrarTodo]),
    avisoPeligro,
    errorPeligro
  );
}
