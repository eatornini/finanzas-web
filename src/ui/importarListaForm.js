// Alta masiva desde capturas del listado de movimientos del banco: OCR de
// una o varias imágenes, revisión fila por fila y guardado de las marcadas.
// Cada fila trae la categoría que ese comercio tuvo la última vez
// (`categoria_por_comercio`); un comercio nuevo queda "Sin categoría".
import { el, limpiar } from "./dom.js";
import { montarModal } from "./modal.js";
import { mostrarOverlayCarga } from "./overlayCarga.js";
import { crearMovimiento, buscarMovimientoDuplicado } from "../data/movimientos.js";
import { categoriaPorComercio } from "../data/rpc.js";
import { formatoCLP, parseCLP } from "../logic/dinero.js";
import { reconocerImagen, reconocerImagenAlterno } from "../ocr/tesseractWorker.js";
import { invertirImagen } from "../ocr/invertirImagen.js";
import { construirBloques } from "../ocr/construirBloques.js";
import { analizarLista } from "../ocr/ocrManager.js";
import { leerImagenPortapapeles } from "./movimientoForm.js";
import { listaIcono, flechaAbajoCirculo, flechaArribaCirculo } from "./iconos.js";

const p2 = (n) => String(n).padStart(2, "0");
const fechaAInput = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
// La lista no trae hora: se guarda a las 12:00 locales, lo que además deja
// la fecha estable para detectar la misma captura importada dos veces.
const inputAFechaIso = (v) => new Date(`${v}T12:00`).toISOString();

// Mismos reintentos que un comprobante suelto (PSM 11 -> PSM 3 -> imagen
// invertida), pero acá el criterio de éxito es encontrar al menos una fila.
async function leerCaptura(file) {
  const intentos = [
    () => reconocerImagen(file),
    () => reconocerImagenAlterno(file),
    async () => reconocerImagen(await invertirImagen(file)),
  ];
  for (const intento of intentos) {
    try {
      const { lineas } = construirBloques(await intento());
      const filas = analizarLista({ lineas });
      if (filas.length) return filas;
    } catch {
      // se prueba el siguiente intento
    }
  }
  return [];
}

function elegirArchivos() {
  return new Promise((resolve) => {
    const input = el("input", { type: "file", accept: "image/*", multiple: "true", hidden: "true" });
    input.addEventListener("change", () => {
      resolve([...input.files]);
      input.remove();
    });
    // Sin evento estándar al cancelar el selector: si nunca llega "change"
    // la promesa queda pendiente y no pasa nada, que es lo esperado.
    document.body.append(input);
    input.click();
  });
}

// Punto de entrada: pide las capturas (portapapeles o archivos), corre el
// OCR y abre la revisión. `onGuardado` se llama si se agregó algo.
export async function importarListaMovimientos({ modo, categorias, tipoInicial = "gasto", onGuardado }) {
  let archivos = [];
  const portapapeles = await leerImagenPortapapeles();
  if (portapapeles && confirm("Detectamos una imagen copiada. ¿Usarla para importar movimientos?")) {
    archivos = [portapapeles];
  } else {
    archivos = await elegirArchivos();
  }
  if (!archivos.length) return;

  const quitarOverlay = mostrarOverlayCarga(
    archivos.length > 1 ? `Leyendo ${archivos.length} capturas…` : "Leyendo captura…"
  );
  let filas = [];
  try {
    for (const archivo of archivos) filas.push(...(await leerCaptura(archivo)));
  } finally {
    quitarOverlay();
  }

  if (!filas.length) {
    alert("No se encontraron movimientos en la imagen. Probá con una captura más nítida.");
    return;
  }
  abrirRevision({ modo, categorias, tipoInicial, filas, onGuardado });
}

function abrirRevision({ modo, categorias, tipoInicial, filas: filasOcr, onGuardado }) {
  let tipoActual = tipoInicial;
  const hoy = fechaAInput(new Date());

  const error = el("p", { class: "error", role: "alert" });
  const resumen = el("p", { class: "importar-resumen" });
  const lista = el("div", { class: "importar-lista" });
  const btnGuardar = el("button", { type: "button", class: "boton--primario" });
  const btnCancelar = el("button", { type: "button", class: "boton--secundario" }, [
    el("span", { text: "Cancelar" }),
  ]);

  function opcionesCategoria(sel, valor) {
    limpiar(sel);
    sel.append(el("option", { value: "", text: "Sin categoría" }));
    categorias
      .filter((c) => c.tipo === tipoActual && c.modo === modo)
      .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre))
      .forEach((c) => sel.append(el("option", { value: c.id, text: c.nombre })));
    sel.value = valor || "";
  }

  const filas = filasOcr.map((f) => {
    const incluir = el("input", { type: "checkbox", "aria-label": "Incluir" });
    incluir.checked = true;
    const nombre = el("input", { placeholder: "Comercio", value: f.comercio || "" });
    const monto = el("input", {
      inputmode: "numeric",
      placeholder: "Monto",
      value: f.monto ? formatoCLP(f.monto) : "",
    });
    const fecha = el("input", { type: "date", value: f.fecha ? fechaAInput(f.fecha) : hoy });
    const categoria = el("select", { "aria-label": "Categoría" });
    const aviso = el("span", { class: "importar-aviso" });
    const nodo = el("div", { class: "importar-fila" }, [
      incluir,
      el("div", { class: "importar-campos" }, [
        nombre,
        el("div", { class: "importar-campos-fila" }, [monto, fecha]),
        categoria,
        aviso,
      ]),
    ]);
    const fila = {
      incluir, nombre, monto, fecha, categoria, aviso, nodo,
      // true cuando la categoría la eligió la persona: ya no se pisa con la
      // sugerencia por comercio.
      categoriaManual: false,
      secuencia: 0,
    };
    opcionesCategoria(categoria, "");
    categoria.addEventListener("change", () => (fila.categoriaManual = true));
    nombre.addEventListener("change", () => revisarFila(fila));
    monto.addEventListener("change", () => {
      const n = parseCLP(monto.value);
      if (n > 0) monto.value = formatoCLP(n);
      revisarFila(fila);
    });
    fecha.addEventListener("change", () => revisarFila(fila));
    incluir.addEventListener("change", actualizar);
    return fila;
  });

  // Sugerencia de categoría + aviso de duplicado. `secuencia` descarta
  // respuestas viejas si la fila se edita mientras la consulta está en vuelo.
  async function revisarFila(fila, { marcarDuplicado = false } = {}) {
    const token = ++fila.secuencia;
    const nombre = fila.nombre.value.trim();
    const monto = parseCLP(fila.monto.value);
    fila.aviso.textContent = "";
    fila.nodo.classList.remove("importar-fila--duplicado");
    if (!nombre) return actualizar();

    const [catId, duplicado] = await Promise.all([
      fila.categoriaManual
        ? null
        : categoriaPorComercio(tipoActual, modo, nombre).catch(() => null),
      monto > 0 && fila.fecha.value
        ? buscarMovimientoDuplicado({ modo, nombre, monto, fecha: inputAFechaIso(fila.fecha.value) }).catch(
            () => null
          )
        : null,
    ]);
    if (token !== fila.secuencia) return;

    if (!fila.categoriaManual) {
      const existe = categorias.some((c) => c.id === catId && c.tipo === tipoActual && c.modo === modo);
      fila.categoria.value = existe ? catId : "";
    }
    if (duplicado) {
      fila.aviso.textContent = "Ya registrado";
      fila.nodo.classList.add("importar-fila--duplicado");
      // Solo al abrir se desmarca solo; si la persona la volvió a marcar, se respeta.
      if (marcarDuplicado) fila.incluir.checked = false;
    }
    actualizar();
  }

  function seleccionadas() {
    return filas.filter(
      (f) => f.incluir.checked && f.nombre.value.trim() && parseCLP(f.monto.value) > 0 && f.fecha.value
    );
  }

  function actualizar() {
    const sel = seleccionadas();
    const total = sel.reduce((s, f) => s + parseCLP(f.monto.value), 0);
    const sinCat = sel.filter((f) => !f.categoria.value).length;
    resumen.textContent =
      `${sel.length} de ${filas.length} seleccionados · ${formatoCLP(total)}` +
      (sinCat ? ` · ${sinCat} sin categoría` : "");
    limpiar(btnGuardar);
    btnGuardar.append(el("span", { text: sel.length ? `Agregar ${sel.length}` : "Agregar" }));
    btnGuardar.disabled = sel.length === 0;
  }

  // --- Tipo (aplica a todas las filas) ---
  const btnGasto = el("button", { type: "button" }, [flechaAbajoCirculo(), el("span", { text: "Gastos" })]);
  const btnIngreso = el("button", { type: "button" }, [
    flechaArribaCirculo(),
    el("span", { text: "Ingresos" }),
  ]);
  function elegirTipo(t) {
    tipoActual = t;
    btnGasto.classList.toggle("activo", t === "gasto");
    btnIngreso.classList.toggle("activo", t === "ingreso");
    // Las categorías son por tipo: se vuelve a sugerir todo.
    for (const f of filas) {
      f.categoriaManual = false;
      opcionesCategoria(f.categoria, "");
      revisarFila(f);
    }
  }
  btnGasto.addEventListener("click", () => tipoActual !== "gasto" && elegirTipo("gasto"));
  btnIngreso.addEventListener("click", () => tipoActual !== "ingreso" && elegirTipo("ingreso"));
  btnGasto.classList.toggle("activo", tipoActual === "gasto");
  btnIngreso.classList.toggle("activo", tipoActual === "ingreso");

  filas.forEach((f) => lista.append(f.nodo));

  btnGuardar.addEventListener("click", async () => {
    error.textContent = "";
    const sel = seleccionadas();
    btnGuardar.disabled = true;
    btnCancelar.disabled = true;
    const quitarOverlay = mostrarOverlayCarga(`Guardando ${sel.length} movimientos…`);
    let guardados = 0;
    const fallidas = [];
    try {
      for (const f of sel) {
        try {
          await crearMovimiento({
            nombre: f.nombre.value.trim(),
            monto: parseCLP(f.monto.value),
            tipo: tipoActual,
            modo,
            categoria_id: f.categoria.value || null,
            fecha: inputAFechaIso(f.fecha.value),
            detalle: null,
          });
          guardados++;
          // Ya guardada: se saca de la lista para que un reintento no la duplique.
          f.nodo.remove();
          filas.splice(filas.indexOf(f), 1);
        } catch {
          fallidas.push(f);
        }
      }
    } finally {
      quitarOverlay();
    }
    if (guardados) onGuardado?.();
    if (!fallidas.length) {
      cerrar();
      return;
    }
    error.textContent = `No se pudieron guardar ${fallidas.length} movimientos. Intentá de nuevo.`;
    btnCancelar.disabled = false;
    actualizar();
  });

  const contenido = el("div", { class: "importar" }, [
    el("div", { class: "selector-tipo mov-tipo-toggle" }, [btnGasto, btnIngreso]),
    resumen,
    lista,
    error,
  ]);

  const { cerrar } = montarModal({
    titulo: "Importar movimientos",
    subtitulo: "Revisá lo leído de la captura antes de agregarlo.",
    icono: listaIcono,
    contenido,
    acciones: [btnCancelar, btnGuardar],
    claseExtra: "modal-panel--ancho",
  });
  btnCancelar.addEventListener("click", () => cerrar());

  actualizar();
  filas.forEach((f) => revisarFila(f, { marcarDuplicado: true }));
}
