import { el, limpiar } from "./dom.js";
import { montarModal } from "./modal.js";
import { crearMovimiento, actualizarMovimiento, buscarMovimientoDuplicado } from "../data/movimientos.js";
import { usoCategorias, sugerenciasComercio } from "../data/rpc.js";
import { abrirCategoriaForm } from "./categoriaForm.js";
import { formatoCLP, parseCLP } from "../logic/dinero.js";
import { nodoIconoCategoria } from "./iconoCategoria.js";
import {
  camaraIcono,
  cerrarIcono,
  chevronAbajo,
  mas,
  lapiz,
  flechaAbajoCirculo,
  flechaArribaCirculo,
  flechaDer,
  etiquetaIcono,
  notaIcono,
  calendarioIcono,
  tiendaIcono,
  dolarCirculoIcono,
  lupaIcono,
  check,
} from "./iconos.js";
import { subirComprobante, urlComprobante, eliminarComprobante } from "../data/storage.js";
import { reconocerImagen } from "../ocr/tesseractWorker.js";
import { construirBloques } from "../ocr/construirBloques.js";
import { analizarComprobante } from "../ocr/ocrManager.js";
import { mostrarOverlayCarga } from "./overlayCarga.js";
import { sesionActual } from "../auth.js";

const FRECUENCIAS = [
  ["mensual", "Mensual"],
  ["bimestral", "Bimestral"],
  ["trimestral", "Trimestral"],
  ["anual", "Anual"],
];

// Igual que formatoCLP pero sin el "$" — para el campo de monto rediseñado,
// que muestra el símbolo aparte (.input-monto-simbolo).
function formatoMontoCampo(n) {
  return formatoCLP(n).replace("$", "");
}

// ISO (con hora) -> valor para <input type="datetime-local"> en hora local.
function isoAInputLocal(iso) {
  const d = iso ? new Date(iso) : new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(
    d.getMinutes()
  )}`;
}

function formatoFechaHoraLegible(iso) {
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Pregunta qué hacer ante un movimiento ya existente con el mismo comercio,
// monto y fecha/hora (comprobante cargado dos veces). Devuelve una promesa
// que resuelve a "reemplazar" | "agregar" | "cancelar" — cerrar el modal de
// cualquier otra forma (X, click afuera, Escape) cuenta como "cancelar".
function confirmarDuplicado(duplicado) {
  return new Promise((resolve) => {
    let resuelto = false;
    function resolver(valor) {
      if (resuelto) return;
      resuelto = true;
      resolve(valor);
      cerrar();
    }
    const btnCancelar = el("button", { type: "button", class: "boton--secundario" }, [
      el("span", { text: "Cancelar" }),
    ]);
    const btnAgregar = el("button", { type: "button", class: "boton--secundario" }, [
      el("span", { text: "Agregar de todas formas" }),
    ]);
    const btnReemplazar = el("button", { type: "button", class: "boton--primario" }, [
      el("span", { text: "Reemplazar" }),
    ]);
    btnCancelar.addEventListener("click", () => resolver("cancelar"));
    btnAgregar.addEventListener("click", () => resolver("agregar"));
    btnReemplazar.addEventListener("click", () => resolver("reemplazar"));
    const cuerpo = el("div", { class: "confirmacion-duplicado" }, [
      el("p", { text: "Ya hay un movimiento con el mismo comercio, monto y fecha:" }),
      el("p", { class: "confirmacion-duplicado-detalle" }, [
        el("strong", { text: duplicado.nombre }),
        el("span", {
          text: ` — ${formatoCLP(duplicado.monto)} — ${formatoFechaHoraLegible(duplicado.fecha)}`,
        }),
      ]),
      el("p", { text: "¿Reemplazar el anterior, agregarlo de todas formas o cancelar?" }),
    ]);
    const { cerrar } = montarModal({
      titulo: "Posible comprobante duplicado",
      icono: notaIcono,
      contenido: cuerpo,
      acciones: [btnCancelar, btnAgregar, btnReemplazar],
      onCerrar: () => resolver("cancelar"),
    });
  });
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
    "aria-label": "Comercio",
    placeholder: "Ej. Supermercado, Uber, Starbucks…",
    value: movimiento?.nombre || inicial?.comercio || "",
  });
  const sugerencias = el("datalist", { id: "mov-nombre-sugerencias" });
  nombre.setAttribute("list", "mov-nombre-sugerencias");

  const monto = el("input", {
    id: "mov-monto",
    inputmode: "numeric",
    "aria-label": "Monto",
    placeholder: "0",
    value: movimiento
      ? formatoMontoCampo(movimiento.monto)
      : inicial?.monto
      ? formatoMontoCampo(inicial.monto)
      : "",
  });
  monto.addEventListener("input", () => {
    const n = parseCLP(monto.value);
    monto.value = Number.isFinite(n) ? formatoMontoCampo(n) : "";
    actualizarBotones();
  });

  // Toggle Gasto/Ingreso (antes <select id="mov-tipo">). tipoActual sigue
  // siendo la única fuente de verdad; se conserva el mismo reseteo de
  // categoría al cambiar de tipo.
  const btnTipoGasto = el("button", { type: "button" }, [
    flechaAbajoCirculo(),
    el("span", { text: "Gasto" }),
  ]);
  const btnTipoIngreso = el("button", { type: "button" }, [
    flechaArribaCirculo(),
    el("span", { text: "Ingreso" }),
  ]);
  function sincronizarTipo() {
    btnTipoGasto.classList.toggle("activo", tipoActual === "gasto");
    btnTipoIngreso.classList.toggle("activo", tipoActual === "ingreso");
  }
  function elegirTipo(t) {
    if (tipoActual === t) return;
    tipoActual = t;
    categoriaId = null;
    sincronizarTipo();
    cargarUso(); // repinta: placeholder y luego el orden definitivo
    actualizarSelectorCategoria();
    actualizarBotones();
  }
  btnTipoGasto.addEventListener("click", () => elegirTipo("gasto"));
  btnTipoIngreso.addEventListener("click", () => elegirTipo("ingreso"));
  sincronizarTipo();
  const selectorTipoMov = el("div", { class: "selector-tipo mov-tipo-toggle" }, [
    btnTipoGasto,
    btnTipoIngreso,
  ]);

  const fecha = el("input", {
    id: "mov-fecha",
    type: "datetime-local",
    value: isoAInputLocal(movimiento?.fecha || inicial?.fecha?.toISOString()),
  });
  const detalle = el("input", {
    id: "mov-detalle",
    placeholder: "Ej. Almuerzo con amigos…",
    value: movimiento?.detalle || inicial?.detalle || "",
  });

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
    hidden: "true",
  });
  const btnCargarComprobante = el("button", { type: "button", class: "boton--secundario boton--secundario-icono" });
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
    btnCargarComprobante.append(camaraIcono());
    if (archivoComprobante) {
      previewImg.src = URL.createObjectURL(archivoComprobante);
      previewImg.hidden = false;
      btnCargarComprobante.title = "Reemplazar comprobante";
      btnCargarComprobante.setAttribute("aria-label", "Reemplazar comprobante");
      btnQuitarComprobante.hidden = false;
    } else if (imagenExistente && !imagenEliminada) {
      btnCargarComprobante.title = "Reemplazar comprobante";
      btnCargarComprobante.setAttribute("aria-label", "Reemplazar comprobante");
      btnQuitarComprobante.hidden = false;
      try {
        previewImg.src = await urlComprobante(imagenExistente);
        previewImg.hidden = false;
      } catch {
        previewImg.hidden = true;
      }
    } else {
      previewImg.hidden = true;
      btnCargarComprobante.title = "Cargar comprobante";
      btnCargarComprobante.setAttribute("aria-label", "Cargar comprobante");
      btnQuitarComprobante.hidden = true;
    }
  }

  // Valores que puso el OCR la última vez. Sirve para distinguir "el usuario
  // no tocó el campo" (se puede reemplazar al cargar otro comprobante) de "lo
  // editó a mano" (se respeta). Se siembra con los valoresIniciales para que
  // un OCR previo también quede sujeto a reemplazo.
  let ultimoOcr = {
    comercio: inicial?.comercio ? String(inicial.comercio).trim() : "",
    monto: inicial?.monto ? formatoMontoCampo(inicial.monto) : "",
    fecha: inicial?.fecha ? isoAInputLocal(inicial.fecha.toISOString()) : "",
    detalle: inicial?.detalle ? String(inicial.detalle).trim() : "",
  };

  function aplicarValoresOcr(resultado) {
    const comercioOcr = resultado.comercio ? String(resultado.comercio).trim() : "";
    const montoOcr = resultado.monto ? formatoMontoCampo(resultado.monto) : "";
    const fechaOcr = resultado.fecha ? isoAInputLocal(resultado.fecha.toISOString()) : "";
    const detalleOcr = resultado.detalle ? String(resultado.detalle).trim() : "";

    // Cada campo se reemplaza si está vacío o si todavía tiene el valor que
    // puso el OCR anterior; si el usuario lo editó a mano, no se toca.
    if (!nombre.value.trim() || nombre.value === ultimoOcr.comercio) {
      nombre.value = comercioOcr;
    }
    if (!parseCLP(monto.value) || monto.value === ultimoOcr.monto) {
      monto.value = montoOcr;
    }
    if (!fechaTocada || fecha.value === ultimoOcr.fecha) {
      // El campo vive dentro del panel "Más opciones", que en alta arranca
      // colapsado (grid-template-rows: 0fr + visibility: hidden). Abrir el
      // panel y asignar el valor en el mismo tick NO alcanza: el panel tarda
      // 0.28s en animar a visible (ver .mov-avanzado-contenido en app.css) y
      // varios navegadores móviles no repintan el <input type="datetime-
      // local"> si el valor se asigna mientras todavía está en esa
      // transición, dejando el campo en blanco aunque su valor interno sea
      // correcto. Por eso se reasigna al terminar la transición del panel
      // (o a los 300ms si no dispara, p.ej. con prefers-reduced-motion).
      if (fechaOcr) {
        setAvanzado(true);
        const reasignar = () => {
          fecha.value = fechaOcr;
        };
        avanzadoWrap.addEventListener("transitionend", reasignar, { once: true });
        setTimeout(reasignar, 300);
      }
      fecha.value = fechaOcr;
    }
    if (!detalle.value.trim() || detalle.value === ultimoOcr.detalle) {
      detalle.value = detalleOcr;
    }

    ultimoOcr = { comercio: comercioOcr, monto: montoOcr, fecha: fechaOcr, detalle: detalleOcr };
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
    // Overlay bloqueante: el OCR tarda varios segundos y el usuario no debe
    // tocar el formulario mientras corre.
    const quitarOverlay = mostrarOverlayCarga("Leyendo comprobante…");
    try {
      const bloquesTesseract = await reconocerImagen(file);
      const { lineas, bloques } = construirBloques(bloquesTesseract);
      aplicarValoresOcr(analizarComprobante({ lineas, bloques }));
      estadoOcr.textContent = "";
    } catch {
      estadoOcr.textContent = "No se pudo leer el comprobante. Completá los datos a mano.";
    } finally {
      quitarOverlay();
    }
  });

  const comprobante = el("div", { class: "comprobante-campo comprobante-campo--secundario" }, [
    el("div", { class: "comprobante-caja" }, [previewImg, btnQuitarComprobante, inputArchivo]),
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
  // El orden de las tarjetas rápidas depende de `usoCategorias` (RPC async).
  // `usoListo` evita el primer render con orden provisional: hasta que el uso
  // llega (o vence la espera) se muestra un placeholder y luego se pinta una
  // sola vez con el orden definitivo. `usoSecuencia` descarta respuestas
  // obsoletas si se cambia de tipo mientras una carga está en vuelo.
  let usoListo = false;
  let usoSecuencia = 0;

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
    const color = c.color || (tipoActual === "ingreso" ? "#1b7f4d" : "#c0392b");
    const icono = el("span", { class: "mov-chip-icono" }, [nodoIconoCategoria(c)]);
    // Mismo tratamiento visual que la lista de Movimientos (.fila-icono):
    // fondo pastel (tinte suave del color de la categoría) e ícono en el
    // color pleno, en lugar de círculo sólido con ícono blanco.
    icono.style.background = `color-mix(in srgb, ${color} 16%, transparent)`;
    icono.style.color = color;
    const b = el("button", { type: "button", class: "mov-chip" }, [
      icono,
      el("span", { class: "mov-chip-texto", text: c.nombre }),
    ]);
    b.dataset.id = c.id;
    if (c.color) b.style.setProperty("--chip-color", c.color);
    b.addEventListener("click", () => {
      categoriaId = c.id;
      marcarChipActivo();
      actualizarSelectorCategoria();
      actualizarBotones();
    });
    return b;
  }

  // --- Selector grande de categoría (arriba del todo) ---
  const catSelectorIcono = el("span", { class: "mov-cat-selector-icono" });
  const catSelectorNombre = el("span", { class: "mov-cat-selector-nombre" });
  const catSelector = el(
    "button",
    { type: "button", class: "mov-cat-selector" },
    [
      catSelectorIcono,
      el("div", { class: "mov-cat-selector-texto" }, [
        el("span", { class: "mov-cat-selector-etiqueta", text: "Seleccionar categoría" }),
        catSelectorNombre,
      ]),
      chevronAbajo(),
    ]
  );
  catSelector.addEventListener("click", () => abrirListaCompleta(categoriasDelTipo()));
  function actualizarSelectorCategoria() {
    const cat = categorias.find((c) => c.id === categoriaId) || null;
    limpiar(catSelectorIcono);
    catSelectorIcono.append(nodoIconoCategoria(cat));
    catSelectorNombre.textContent = cat ? cat.nombre : "Categoría";
  }

  function marcarChipActivo() {
    for (const b of chips.children) {
      if (b.dataset.id) b.classList.toggle("activo", b.dataset.id === categoriaId);
    }
  }

  // Tarjeta neutra (misma silueta que un chip de categoría) para las dos
  // acciones de la fila: abrir la lista completa y crear una categoría.
  function chipAccion(clase, fabricaIcono, contenidoTexto, onClick) {
    return el("button", { type: "button", class: `mov-chip ${clase}`, onClick }, [
      el("span", { class: "mov-chip-icono mov-chip-icono--neutro" }, [fabricaIcono()]),
      el("span", { class: "mov-chip-texto" }, contenidoTexto),
    ]);
  }

  function pintarChips() {
    limpiar(chips);
    const lista = categoriasDelTipo();

    // Mientras no llega el uso, placeholder del mismo tamaño (evita el
    // reordenamiento visible cuando la RPC responde).
    if (!usoListo) {
      for (let i = 0; i < Math.min(4, lista.length); i++) {
        chips.append(el("span", { class: "mov-chip mov-chip--esqueleto", "aria-hidden": "true" }));
      }
      chips.append(
        chipAccion("mov-chip--nueva-tile", mas, ["Nueva categoría"], abrirNuevaCategoria)
      );
      return;
    }

    for (const c of lista.slice(0, 4)) chips.append(chip(c));
    if (categoriaId && !lista.slice(0, 4).some((c) => c.id === categoriaId)) {
      const sel = lista.find((c) => c.id === categoriaId);
      // La categoría seleccionada que no está entre las 4 primeras se
      // muestra igualmente, al principio de la fila.
      if (sel) chips.insertBefore(chip(sel), chips.children[0] || null);
    }
    chips.append(
      chipAccion("mov-chip--nueva-tile", mas, ["Nueva categoría"], abrirNuevaCategoria)
    );
    marcarChipActivo();
  }

  function abrirNuevaCategoria() {
    abrirCategoriaForm({
      modoInicial: modo,
      tipoInicial: tipoActual,
      onGuardado: (nueva) => {
        categorias.push(nueva);
        categoriaId = nueva.id;
        pintarChips();
        actualizarSelectorCategoria();
        actualizarBotones();
      },
    });
  }

  function abrirListaCompleta(lista) {
    // Selección en dos pasos: al tocar una tarjeta se resalta; recién
    // "Seleccionar" la aplica y cierra. "Cancelar" / X cierran sin cambios.
    let seleccionadaId = categoriaId;

    const buscador = el("input", {
      type: "search",
      placeholder: "Buscar categorías…",
      "aria-label": "Buscar categorías",
    });
    const grid = el("div", { class: "cat-picker-grid" });

    const btnSeleccionar = el("button", {
      type: "button",
      class: "boton--primario",
      text: "Seleccionar",
      onClick: () => {
        if (!seleccionadaId) return;
        categoriaId = seleccionadaId;
        cerrarLista();
        pintarChips();
        actualizarSelectorCategoria();
        actualizarBotones();
      },
    });
    const btnCancelar = el("button", {
      type: "button",
      text: "Cancelar",
      onClick: () => cerrarLista(),
    });

    function sincronizarSeleccion() {
      for (const tile of grid.children) {
        if (tile.dataset.id) tile.classList.toggle("activo", tile.dataset.id === seleccionadaId);
      }
      btnSeleccionar.disabled = !seleccionadaId;
    }

    function pintarGrid() {
      limpiar(grid);
      const q = buscador.value.trim().toLowerCase();
      const filtradas = q ? lista.filter((c) => c.nombre.toLowerCase().includes(q)) : lista;
      for (const c of filtradas) {
        const color = c.color || (tipoActual === "ingreso" ? "#1b7f4d" : "#c0392b");
        const icono = el("span", { class: "mov-chip-icono" }, [nodoIconoCategoria(c)]);
        icono.style.background = `color-mix(in srgb, ${color} 16%, transparent)`;
        icono.style.color = color;
        const tile = el("button", { type: "button", class: "mov-chip" }, [
          icono,
          el("span", { class: "mov-chip-texto", text: c.nombre }),
        ]);
        tile.dataset.id = c.id;
        tile.addEventListener("click", () => {
          seleccionadaId = c.id;
          sincronizarSeleccion();
        });
        grid.append(tile);
      }
      if (!q) {
        grid.append(
          chipAccion("mov-chip--nueva-tile", mas, ["Nueva categoría"], () => {
            cerrarLista();
            abrirNuevaCategoria();
          })
        );
      } else if (!filtradas.length) {
        grid.append(el("p", { class: "cat-picker-vacio", text: "Sin resultados." }));
      }
      sincronizarSeleccion();
    }

    buscador.addEventListener("input", pintarGrid);
    pintarGrid();

    const cont = el("div", { class: "mov-rapido-campo cat-picker" }, [
      el("div", { class: "cat-picker-buscar" }, [lupaIcono(), buscador]),
      grid,
    ]);
    const { cerrar: cerrarLista } = montarModal({
      titulo: "Elegir categoría",
      subtitulo: "Selecciona la categoría que mejor se ajuste a este movimiento.",
      icono: etiquetaIcono,
      contenido: cont,
      acciones: [btnCancelar, btnSeleccionar],
      claseExtra: "modal-panel--ancho",
    });
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

  // Vive en la cabecera del modal (fuera del <form> en el DOM), asociado
  // por el atributo form= — así el clic sigue disparando el mismo submit
  // de siempre aunque el botón ya no esté anidado adentro. Sin botón
  // Cancelar: la "X" de la cabecera ya cierra el modal.
  const btnGuardar = el(
    "button",
    { type: "submit", form: "form-movimiento", class: "boton--primario" },
    [check(), el("span", { text: "Guardar" })]
  );

  function formValido() {
    return Boolean(nombre.value.trim()) && parseCLP(monto.value) > 0 && Boolean(categoriaId);
  }
  function huboCambios() {
    if (!edicion) return true;
    return (
      nombre.value.trim() !== movimiento.nombre ||
      parseCLP(monto.value) !== Math.round(movimiento.monto) ||
      tipoActual !== movimiento.tipo ||
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

  // Encabezado de sección del formulario: icono de acento + título en
  // negrita y, opcionalmente, una acción alineada a la derecha.
  function seccionCab(fabricaIcono, texto, accion = null) {
    return el("div", { class: "mov-seccion-cab" }, [
      el("span", { class: "mov-seccion-titulo" }, [
        el("span", { class: "mov-seccion-icono" }, [fabricaIcono()]),
        texto,
      ]),
      accion,
    ]);
  }

  // Campo con encabezado de icono + título (mismo estilo que las secciones
  // principales), usado dentro del panel "Más opciones".
  //
  // El <input> queda como hermano del <label>, NO anidado: un <label for>
  // que además envuelve a su control hace que el navegador dispare un
  // segundo click sintético sobre el input, y ese segundo click cierra de
  // inmediato el selector nativo de <input type="datetime-local"> (parecía
  // que no abría). Con el input afuera, un solo click llega al control.
  function campoConCab(fabricaIcono, etiqueta, input) {
    return el("div", { class: "campo mov-avanzado-campo" }, [
      el("label", { class: "mov-seccion-cab", for: input.id }, [
        el("span", { class: "mov-seccion-titulo" }, [
          el("span", { class: "mov-seccion-icono" }, [fabricaIcono()]),
          etiqueta,
        ]),
      ]),
      input,
    ]);
  }

  // Opción tipo switch: interruptor a la izquierda + nombre y, si aplica,
  // una línea de ayuda debajo.
  function opcionCheck(input, etiqueta, ayuda = null) {
    return el("label", { class: "campo campo--check mov-opcion-switch", for: input.id }, [
      input,
      el("span", { class: "mov-opcion-switch-texto" }, [
        el("span", { class: "mov-opcion-switch-nombre", text: etiqueta }),
        ...(ayuda ? [el("span", { class: "mov-opcion-switch-ayuda", text: ayuda })] : []),
      ]),
    ]);
  }

  const checksOpciones = [
    opcionCheck(activo, "Activo", "El movimiento se incluirá en tus reportes."),
  ];
  if (esEstimado) {
    checksOpciones.push(
      opcionCheck(pagado, "Pagado", "Marcá el estimado como ya concretado."),
      opcionCheck(recurrente, "Recurrente", "Se repetirá según la frecuencia elegida.")
    );
  }
  const seccionOpciones = el("div", { class: "mov-opciones" }, [
    ...checksOpciones,
    ...(esEstimado ? [campo("Frecuencia", frecuencia)] : []),
  ]);

  // --- "Más opciones": secciona los campos secundarios en un panel
  // colapsable. Solo cambia la presentación: los inputs siguen montados y
  // conservan su valor esté abierto o cerrado, así el submit no cambia. ---
  const avanzadoInner = el("div", { class: "mov-avanzado-inner" }, [
    el("div", { class: "mov-avanzado-panel" }, [
      campoConCab(notaIcono, "Detalle (opcional)", detalle),
      campoConCab(calendarioIcono, "Fecha y hora", fecha),
      seccionOpciones,
    ]),
  ]);
  const btnAvanzado = el(
    "button",
    {
      type: "button",
      class: "mov-avanzado-toggle",
      "aria-expanded": "false",
      "aria-controls": "mov-avanzado-contenido",
    },
    [el("span", { text: "Más opciones" }), el("span", { class: "mov-avanzado-chevron" }, [chevronAbajo()])]
  );
  const avanzadoWrap = el("div", { class: "mov-avanzado" }, [
    btnAvanzado,
    el("div", { class: "mov-avanzado-contenido", id: "mov-avanzado-contenido" }, [avanzadoInner]),
  ]);
  function setAvanzado(abierto) {
    btnAvanzado.setAttribute("aria-expanded", String(abierto));
    avanzadoWrap.classList.toggle("mov-avanzado--abierto", abierto);
  }
  btnAvanzado.addEventListener("click", () => {
    setAvanzado(btnAvanzado.getAttribute("aria-expanded") !== "true");
  });
  // Al editar, abrir de entrada si hay algo que el usuario debería ver: un
  // detalle escrito o una opción fuera de su valor por defecto (Activo
  // desmarcado, o Pagado/Recurrente marcados en modo estimado). La fecha
  // no cuenta: en edición siempre trae la del movimiento y forzaría el
  // panel abierto en todos los casos. En alta siempre empieza cerrado.
  const opcionesFueraDeDefault =
    !activo.checked || (esEstimado && (pagado.checked || recurrente.checked));
  setAvanzado(edicion && (Boolean(detalle.value.trim()) || opcionesFueraDeDefault));

  const filas = [
    selectorTipoMov,
    catSelector,
    el("div", { class: "campo mov-rapido-campo" }, [
      seccionCab(
        etiquetaIcono,
        "Categoría",
        el(
          "button",
          {
            type: "button",
            class: "mov-ver-todas",
            onClick: () => abrirListaCompleta(categoriasDelTipo()),
          },
          [el("span", { text: "Ver todas" }), flechaDer()]
        )
      ),
      chips,
    ]),
    el("div", { class: "campo" }, [
      seccionCab(tiendaIcono, "Comercio"),
      el("div", { class: "comercio-fila" }, [
        el("div", { class: "comercio-input" }, [lupaIcono(), nombre]),
        btnCargarComprobante,
      ]),
    ]),
    sugerencias,
    comprobante,
    el("div", { class: "campo campo-monto" }, [
      seccionCab(dolarCirculoIcono, "Monto"),
      el("div", { class: "input-monto input-monto--grande" }, [
        el("span", { class: "input-monto-simbolo", text: "$" }),
        monto,
      ]),
    ]),
    avanzadoWrap,
  ];

  const form = el(
    "form",
    {
      id: "form-movimiento",
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
          tipo: tipoActual,
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

          // Solo tiene sentido en alta: si se está editando, el movimiento
          // ya es "el mismo", no un duplicado nuevo.
          const duplicado = edicion
            ? null
            : await buscarMovimientoDuplicado({
                modo,
                nombre: datos.nombre,
                monto: datos.monto,
                fecha: datos.fecha,
              });

          if (duplicado) {
            const accion = await confirmarDuplicado(duplicado);
            if (accion === "cancelar") {
              btnGuardar.disabled = false;
              return;
            }
            if (accion === "reemplazar") {
              await actualizarMovimiento(duplicado.id, datos);
              if (duplicado.imagen && duplicado.imagen !== datos.imagen) {
                eliminarComprobante(duplicado.imagen); // best-effort, no bloquea el guardado
              }
            } else {
              await crearMovimiento(datos);
            }
          } else if (edicion) {
            await actualizarMovimiento(movimiento.id, datos);
          } else {
            await crearMovimiento(datos);
          }

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
    [el("div", { class: "form-mov-secciones" }, filas), error]
  );

  const { cerrar } = montarModal({
    titulo: edicion ? "Editar movimiento" : "Agregar movimiento",
    subtitulo: edicion
      ? "Modificá los datos de este movimiento."
      : "Registra un nuevo ingreso o gasto en tu cuenta.",
    icono: edicion ? lapiz : mas,
    contenido: form,
    accionesCabecera: [btnGuardar],
  });

  function cargarUso() {
    const token = ++usoSecuencia;
    usoListo = false;
    usoPorCategoria = {};
    pintarChips(); // placeholder mientras carga

    const marcarListo = () => {
      if (token !== usoSecuencia || usoListo) return;
      usoListo = true;
      pintarChips();
    };
    // Reserva: si la RPC tarda demasiado o falla, no dejar el placeholder fijo.
    const reserva = setTimeout(marcarListo, 1500);

    usoCategorias(tipoActual, modo)
      .then((rows) => {
        if (token === usoSecuencia) {
          usoPorCategoria = Object.fromEntries(rows.map((r) => [r.categoria_id, Number(r.n)]));
        }
      })
      .catch(() => {
        /* sin datos de uso: se ordena por orden y nombre */
      })
      .then(() => {
        if (token !== usoSecuencia) return;
        clearTimeout(reserva);
        marcarListo();
      });
  }

  cargarUso();
  actualizarSelectorCategoria();
  pintarComprobante();
  actualizarBotones();
}
