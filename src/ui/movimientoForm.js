import { el, limpiar } from "./dom.js";
import { montarModal } from "./modal.js";
import { crearMovimiento, actualizarMovimiento } from "../data/movimientos.js";
import { usoCategorias, sugerenciasComercio } from "../data/rpc.js";
import { abrirCategoriaForm } from "./categoriaForm.js";
import { formatoCLP, parseCLP } from "../logic/dinero.js";
import { nodoIconoCategoria } from "./iconoCategoria.js";
import { camaraIcono, cerrarIcono } from "./iconos.js";
import { subirComprobante, urlComprobante, eliminarComprobante } from "../data/storage.js";
import { reconocerImagen } from "../ocr/tesseractWorker.js";
import { construirBloques } from "../ocr/construirBloques.js";
import { analizarComprobante } from "../ocr/ocrManager.js";
import { sesionActual } from "../auth.js";

const FRECUENCIAS = [
  ["mensual", "Mensual"],
  ["bimestral", "Bimestral"],
  ["trimestral", "Trimestral"],
  ["anual", "Anual"],
];

// ISO (con hora) -> valor para <input type="datetime-local"> en hora local.
function isoAInputLocal(iso) {
  const d = iso ? new Date(iso) : new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(
    d.getMinutes()
  )}`;
}

export function abrirMovimientoForm({
  modo,
  categorias,
  movimiento = null,
  valoresIniciales = null,
  archivoInicial = null,
  onGuardado,
}) {
  const edicion = Boolean(movimiento);
  const esEstimado = modo === "estimado";
  // valoresIniciales (de un OCR previo) solo prellena en alta, nunca pisa una edición.
  const inicial = edicion ? null : valoresIniciales;

  let tipoActual = movimiento?.tipo || "gasto";
  let categoriaId = movimiento?.categoria_id || null;

  const error = el("p", { class: "error", role: "alert" });

  const nombre = el("input", {
    id: "mov-nombre",
    required: "true",
    autocomplete: "off",
    value: movimiento?.nombre || inicial?.comercio || "",
  });
  const sugerencias = el("datalist", { id: "mov-nombre-sugerencias" });
  nombre.setAttribute("list", "mov-nombre-sugerencias");

  const monto = el("input", {
    id: "mov-monto",
    inputmode: "numeric",
    value: movimiento
      ? formatoCLP(movimiento.monto)
      : inicial?.monto
      ? formatoCLP(inicial.monto)
      : "",
  });
  monto.addEventListener("input", () => {
    const n = parseCLP(monto.value);
    monto.value = Number.isFinite(n) ? formatoCLP(n) : "";
    actualizarBotones();
  });

  const tipo = el("select", { id: "mov-tipo" }, [
    el("option", { value: "gasto", text: "Gasto" }),
    el("option", { value: "ingreso", text: "Ingreso" }),
  ]);
  tipo.value = tipoActual;
  tipo.addEventListener("change", () => {
    tipoActual = tipo.value;
    categoriaId = null;
    cargarUso();
    pintarChips();
    actualizarBotones();
  });

  const fecha = el("input", {
    id: "mov-fecha",
    type: "datetime-local",
    value: isoAInputLocal(movimiento?.fecha || inicial?.fecha?.toISOString()),
  });
  const detalle = el("input", { id: "mov-detalle", value: movimiento?.detalle || inicial?.detalle || "" });

  // --- Comprobante (imagen + OCR) ---
  let archivoComprobante = archivoInicial;
  let imagenEliminada = false;
  let fechaTocada = false;
  const imagenExistente = movimiento?.imagen || null;

  fecha.addEventListener("input", () => {
    fechaTocada = true;
  });

  const previewImg = el("img", { class: "comprobante-preview", alt: "Comprobante", hidden: "true" });
  const estadoOcr = el("p", { class: "comprobante-estado" });
  const inputArchivo = el("input", {
    type: "file",
    accept: "image/*",
    capture: "environment",
    hidden: "true",
  });
  const btnCargarComprobante = el("button", { type: "button" });
  btnCargarComprobante.addEventListener("click", () => inputArchivo.click());
  const btnQuitarComprobante = el(
    "button",
    { type: "button", class: "boton--icono", "aria-label": "Quitar comprobante", hidden: "true" },
    [cerrarIcono()]
  );
  btnQuitarComprobante.addEventListener("click", () => {
    archivoComprobante = null;
    imagenEliminada = true;
    inputArchivo.value = "";
    pintarComprobante();
    actualizarBotones();
  });

  async function pintarComprobante() {
    limpiar(btnCargarComprobante);
    if (archivoComprobante) {
      previewImg.src = URL.createObjectURL(archivoComprobante);
      previewImg.hidden = false;
      btnCargarComprobante.append(camaraIcono(), " Reemplazar");
      btnQuitarComprobante.hidden = false;
    } else if (imagenExistente && !imagenEliminada) {
      btnCargarComprobante.append(camaraIcono(), " Reemplazar");
      btnQuitarComprobante.hidden = false;
      try {
        previewImg.src = await urlComprobante(imagenExistente);
        previewImg.hidden = false;
      } catch {
        previewImg.hidden = true;
      }
    } else {
      previewImg.hidden = true;
      btnCargarComprobante.append(camaraIcono(), " Cargar comprobante");
      btnQuitarComprobante.hidden = true;
    }
  }

  function aplicarValoresOcr(resultado) {
    if (!nombre.value.trim() && resultado.comercio) nombre.value = resultado.comercio;
    if (!parseCLP(monto.value) && resultado.monto) {
      monto.value = formatoCLP(resultado.monto);
    }
    if (!fechaTocada && resultado.fecha) {
      fecha.value = isoAInputLocal(resultado.fecha.toISOString());
    }
    if (!detalle.value.trim() && resultado.detalle) detalle.value = resultado.detalle;
    actualizarBotones();
  }

  inputArchivo.addEventListener("change", async () => {
    const file = inputArchivo.files[0];
    if (!file) return;
    archivoComprobante = file;
    imagenEliminada = false;
    await pintarComprobante();
    actualizarBotones();

    estadoOcr.textContent = "Leyendo comprobante…";
    try {
      const bloquesTesseract = await reconocerImagen(file);
      const { lineas, bloques } = construirBloques(bloquesTesseract);
      aplicarValoresOcr(analizarComprobante({ lineas, bloques }));
      estadoOcr.textContent = "";
    } catch {
      estadoOcr.textContent = "No se pudo leer el comprobante. Completá los datos a mano.";
    }
  });

  const comprobante = el("div", { class: "campo comprobante-campo" }, [
    el("span", { class: "campo-etiqueta", text: "Comprobante" }),
    el("div", { class: "comprobante-caja" }, [previewImg, btnCargarComprobante, btnQuitarComprobante, inputArchivo]),
    estadoOcr,
  ]);

  const activo = el("input", { id: "mov-activo", type: "checkbox" });
  activo.checked = movimiento ? movimiento.activo !== false : true;

  const pagado = el("input", { id: "mov-pagado", type: "checkbox" });
  pagado.checked = Boolean(movimiento?.pagado);
  const recurrente = el("input", { id: "mov-recurrente", type: "checkbox" });
  recurrente.checked = Boolean(movimiento?.recurrente);
  const frecuencia = el(
    "select",
    { id: "mov-frecuencia" },
    FRECUENCIAS.map(([v, t]) => el("option", { value: v, text: t }))
  );
  frecuencia.value = movimiento?.frecuencia || "mensual";
  frecuencia.disabled = !recurrente.checked;
  recurrente.addEventListener("change", () => {
    frecuencia.disabled = !recurrente.checked;
    actualizarBotones();
  });

  const chips = el("div", { class: "mov-chips" });
  let usoPorCategoria = {};

  function categoriasDelTipo() {
    return categorias
      .filter((c) => c.tipo === tipoActual && c.modo === modo)
      .sort(
        (a, b) =>
          (usoPorCategoria[b.id] || 0) - (usoPorCategoria[a.id] || 0) ||
          a.orden - b.orden ||
          a.nombre.localeCompare(b.nombre)
      );
  }

  function chip(c) {
    const b = el("button", { type: "button", class: "mov-chip" }, [
      nodoIconoCategoria(c),
      el("span", { text: c.nombre }),
    ]);
    b.dataset.id = c.id;
    if (c.color) b.style.setProperty("--chip-color", c.color);
    b.addEventListener("click", () => {
      categoriaId = c.id;
      marcarChipActivo();
      actualizarBotones();
    });
    return b;
  }

  function marcarChipActivo() {
    for (const b of chips.children) {
      if (b.dataset.id) b.classList.toggle("activo", b.dataset.id === categoriaId);
    }
  }

  function pintarChips() {
    limpiar(chips);
    const lista = categoriasDelTipo();
    for (const c of lista.slice(0, 5)) chips.append(chip(c));
    chips.append(
      el("button", {
        type: "button",
        class: "mov-chip mov-chip--mas",
        text: "Todas ▾",
        onClick: () => abrirListaCompleta(lista),
      })
    );
    if (categoriaId && !lista.slice(0, 5).some((c) => c.id === categoriaId)) {
      const sel = lista.find((c) => c.id === categoriaId);
      if (sel) chips.insertBefore(chip(sel), chips.firstChild);
    }
    marcarChipActivo();
  }

  function abrirListaCompleta(lista) {
    const cont = el("div", { class: "mov-lista-cats" });
    for (const c of lista) {
      const b = el("button", { type: "button", class: "mov-chip" }, [
        nodoIconoCategoria(c),
        el("span", { text: c.nombre }),
      ]);
      b.addEventListener("click", () => {
        categoriaId = c.id;
        cerrarLista();
        pintarChips();
        actualizarBotones();
      });
      cont.append(b);
    }
    cont.append(
      el("button", {
        type: "button",
        class: "mov-chip mov-chip--nueva",
        text: "+ Nueva categoría",
        onClick: () => {
          cerrarLista();
          abrirCategoriaForm({
            modoInicial: modo,
            tipoInicial: tipoActual,
            onGuardado: (nueva) => {
              categorias.push(nueva);
              categoriaId = nueva.id;
              pintarChips();
              actualizarBotones();
            },
          });
        },
      })
    );
    const { cerrar: cerrarLista } = montarModal({ titulo: "Elegir categoría", contenido: cont });
  }

  // Autocompletado de comercio (debounce simple).
  let debounce;
  nombre.addEventListener("input", () => {
    actualizarBotones();
    clearTimeout(debounce);
    const q = nombre.value.trim();
    if (q.length < 2) return;
    debounce = setTimeout(async () => {
      try {
        const res = await sugerenciasComercio(tipoActual, modo, q);
        limpiar(sugerencias);
        for (const s of res) sugerencias.append(el("option", { value: s.nombre }));
      } catch {
        /* sin sugerencias */
      }
    }, 250);
  });

  const btnGuardar = el("button", {
    type: "submit",
    class: "boton--primario",
    text: edicion ? "Guardar" : "Agregar movimiento",
  });
  const btnCancelar = el("button", { type: "button", text: "Cancelar", onClick: () => cerrar() });

  function formValido() {
    return Boolean(nombre.value.trim()) && parseCLP(monto.value) > 0 && Boolean(categoriaId);
  }
  function huboCambios() {
    if (!edicion) return true;
    return (
      nombre.value.trim() !== movimiento.nombre ||
      parseCLP(monto.value) !== Math.round(movimiento.monto) ||
      tipo.value !== movimiento.tipo ||
      categoriaId !== (movimiento.categoria_id || null) ||
      new Date(fecha.value).toISOString() !== new Date(movimiento.fecha).toISOString() ||
      (detalle.value.trim() || null) !== (movimiento.detalle || null) ||
      activo.checked !== (movimiento.activo !== false) ||
      (esEstimado && pagado.checked !== Boolean(movimiento.pagado)) ||
      (esEstimado && recurrente.checked !== Boolean(movimiento.recurrente)) ||
      (esEstimado &&
        recurrente.checked &&
        frecuencia.value !== (movimiento.frecuencia || "mensual")) ||
      archivoComprobante !== null ||
      imagenEliminada
    );
  }
  function actualizarBotones() {
    btnGuardar.disabled = !(formValido() && huboCambios());
  }

  function campo(etiqueta, input) {
    return el("label", { class: "campo", for: input.id, text: etiqueta }, [input]);
  }

  const filas = [
    comprobante,
    campo("Nombre", nombre),
    sugerencias,
    campo("Monto", monto),
    campo("Tipo", tipo),
    el("div", { class: "campo" }, [
      el("span", { class: "campo-etiqueta", text: "Categoría" }),
      chips,
    ]),
    campo("Fecha y hora", fecha),
    campo("Detalle (opcional)", detalle),
    el("label", { class: "campo campo--check", for: "mov-activo" }, [activo, "Activo"]),
  ];
  if (esEstimado) {
    filas.push(
      el("label", { class: "campo campo--check", for: "mov-pagado" }, [pagado, "Pagado"]),
      el("label", { class: "campo campo--check", for: "mov-recurrente" }, [recurrente, "Recurrente"]),
      campo("Frecuencia", frecuencia)
    );
  }

  const form = el(
    "form",
    {
      class: "form-mov",
      onSubmit: async (ev) => {
        ev.preventDefault();
        error.textContent = "";
        if (!formValido()) {
          error.textContent = "Completá nombre, monto mayor a 0 y categoría.";
          return;
        }
        btnGuardar.disabled = true;
        const datos = {
          nombre: nombre.value.trim(),
          monto: parseCLP(monto.value),
          tipo: tipo.value,
          modo,
          categoria_id: categoriaId,
          fecha: new Date(fecha.value).toISOString(),
          detalle: detalle.value.trim() || null,
          activo: activo.checked,
          pagado: esEstimado ? pagado.checked : false,
          recurrente: esEstimado ? recurrente.checked : false,
          frecuencia: esEstimado && recurrente.checked ? frecuencia.value : null,
        };
        try {
          if (archivoComprobante) {
            const sesion = await sesionActual();
            datos.imagen = await subirComprobante(sesion.user.id, archivoComprobante);
          } else if (imagenEliminada) {
            datos.imagen = null;
          }

          if (edicion) await actualizarMovimiento(movimiento.id, datos);
          else await crearMovimiento(datos);

          if (imagenExistente && (archivoComprobante || imagenEliminada)) {
            eliminarComprobante(imagenExistente); // best-effort, no bloquea el guardado
          }

          cerrar();
          onGuardado?.();
        } catch (e) {
          error.textContent = "No se pudo guardar. Intentá de nuevo.";
          btnGuardar.disabled = false;
        }
      },
    },
    [el("div", { class: "form-grid" }, filas), error, el("div", { class: "modal-acciones" }, [btnCancelar, btnGuardar])]
  );

  const { cerrar } = montarModal({
    titulo: edicion ? "Editar movimiento" : "Agregar movimiento",
    contenido: form,
  });

  function cargarUso() {
    usoCategorias(tipoActual, modo)
      .then((rows) => {
        usoPorCategoria = Object.fromEntries(rows.map((r) => [r.categoria_id, Number(r.n)]));
        pintarChips();
      })
      .catch(() => pintarChips());
  }

  cargarUso();
  pintarChips();
  pintarComprobante();
  actualizarBotones();
}
