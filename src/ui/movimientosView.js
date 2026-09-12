import { el, limpiar } from "./dom.js";
import { listarMovimientos, actualizarMovimiento, eliminarMovimiento } from "../data/movimientos.js";
import { listarCategorias } from "../data/categorias.js";
import { basura, lupaIcono, embudoIcono, chevronAbajo, check, mas, cerrarIcono, intercambioIcono } from "./iconos.js";
import { colorMovimiento } from "./iconosCategoria.js";
import { nodoIconoCategoria } from "./iconoCategoria.js";
import { montarPanelResumen } from "./panelResumenView.js";
import { abrirMovimientoForm } from "./movimientoForm.js";
import { filtrarParaCalculos, calcularTotales } from "../logic/totales.js";
import { agruparPorFecha, agruparPorCategoria } from "../logic/agrupacionMovimientos.js";
import { etiquetaDia, etiquetaPeriodo } from "../logic/periodos.js";
import { formatoCLP } from "../logic/dinero.js";
import { prefs } from "../prefs.js";
import { tituloVista } from "./tituloVista.js";

export async function montarMovimientos(
  contenedor,
  { rango, modo, tipo, fechaRef, categoriaInicial = null, irA }
) {
  limpiar(contenedor);

  const error = el("p", { class: "error", role: "alert" });
  const badge = el("span", { class: "badge", text: "0" });
  const subtitulo = el("p", {});
  const buscador = el("input", {
    class: "buscador",
    type: "search",
    placeholder: "Buscar…",
  });
  const btnFiltros = el(
    "button",
    { class: "boton--filtros", "aria-label": "Filtros" },
    [embudoIcono()]
  );
  const panelFiltros = el("div", {
    class: "panel-filtros",
    role: "dialog",
    "aria-label": "Filtros",
    hidden: "true",
  });
  // Fondo oscuro para el modo bottom sheet en móvil (en escritorio queda
  // oculto por CSS y el panel sigue siendo un popover anclado al botón).
  const backdropFiltros = el("div", { class: "panel-filtros-backdrop", hidden: "true" });
  const selCategoria = el("select", {}, [el("option", { value: "", text: "Todas las categorías" })]);
  const ORDENES = [
    ["fecha_desc", "Más recientes primero"],
    ["fecha_asc", "Más antiguos primero"],
    ["monto_desc", "Monto: mayor a menor"],
    ["monto_asc", "Monto: menor a mayor"],
  ];
  const selOrden = el(
    "select",
    {},
    ORDENES.map(([v, t]) => el("option", { value: v, text: t }))
  );
  const selectDe = (opciones) =>
    el(
      "select",
      {},
      opciones.map(([v, t]) => el("option", { value: v, text: t }))
    );
  // "Estado" (activo/inactivo) aplica a ambos modos; "Pago" (pagado/pendiente)
  // solo tiene sentido en estimado, donde los movimientos se marcan pagados.
  const selEstado = selectDe([
    ["", "Todos"],
    ["activo", "Solo activos"],
    ["inactivo", "Solo inactivos"],
  ]);
  const selPago = selectDe([
    ["", "Todos"],
    ["pagado", "Solo pagados"],
    ["pendiente", "Solo pendientes"],
  ]);
  const btnCerrarFiltros = el(
    "button",
    { class: "boton--icono panel-filtros-cerrar", type: "button", "aria-label": "Cerrar filtros" },
    [cerrarIcono()]
  );
  panelFiltros.append(
    ...[
      el("div", { class: "panel-filtros-cabecera" }, [
        el("span", { class: "panel-filtros-titulo", text: "Filtros" }),
        btnCerrarFiltros,
      ]),
      el("label", { text: "Categoría" }, [selCategoria]),
      el("label", { text: "Ordenar por" }, [selOrden]),
      el("label", { text: "Estado" }, [selEstado]),
      modo === "estimado" ? el("label", { text: "Pago" }, [selPago]) : null,
    ].filter(Boolean)
  );

  function alTeclearFiltros(ev) {
    if (ev.key === "Escape") cerrarFiltros();
  }
  // En escritorio el panel es un popover sin backdrop que cubra la
  // pantalla (eso es solo el bottom sheet móvil) — por eso hace falta este
  // listener aparte para cerrar al hacer clic fuera del panel/botón.
  function alClickFuera(ev) {
    if (panelFiltros.contains(ev.target) || btnFiltros.contains(ev.target)) return;
    cerrarFiltros();
  }
  function abrirFiltros() {
    if (!panelFiltros.hidden) return;
    panelFiltros.hidden = false;
    backdropFiltros.hidden = false;
    btnFiltros.classList.add("activo");
    document.addEventListener("keydown", alTeclearFiltros);
    document.addEventListener("click", alClickFuera, true);
  }
  function cerrarFiltros() {
    if (panelFiltros.hidden) return;
    panelFiltros.hidden = true;
    backdropFiltros.hidden = true;
    btnFiltros.classList.remove("activo");
    document.removeEventListener("keydown", alTeclearFiltros);
    document.removeEventListener("click", alClickFuera, true);
  }
  btnFiltros.addEventListener("click", () => {
    if (panelFiltros.hidden) abrirFiltros();
    else cerrarFiltros();
  });
  btnCerrarFiltros.addEventListener("click", cerrarFiltros);
  backdropFiltros.addEventListener("click", cerrarFiltros);

  // Punto indicador en el botón de filtros: refleja si hay algún filtro
  // aplicado (categoría, estado o pago). "Ordenar por" no cuenta como
  // filtro, así que selOrden queda afuera a propósito.
  function actualizarIndicadorFiltros() {
    const hayFiltro = Boolean(selCategoria.value || selEstado.value || selPago.value);
    btnFiltros.classList.toggle("boton--filtros--marcado", hayFiltro);
  }

  const opcionesVista =
    modo === "estimado"
      ? [
          { valor: "gasto", texto: "Gastos estimados" },
          { valor: "ingreso", texto: "Ingresos estimados" },
        ]
      : [
          { valor: "todos", texto: "Todos" },
          { valor: "gasto", texto: "Gastos" },
          { valor: "ingreso", texto: "Ingresos" },
        ];
  let vista = opcionesVista[0].valor === "todos" ? "todos" : "gasto";
  const botonesVista = opcionesVista.map((op) =>
    el("button", {
      type: "button",
      text: op.texto,
      onClick: () => {
        vista = op.valor;
        sincronizarVista();
        pintarLista();
      },
    })
  );
  // Subtítulo del encabezado: se adapta al período y a la pestaña activa.
  function textoSubtitulo() {
    const periodo = etiquetaPeriodo(fechaRef, tipo);
    const estim = modo === "estimado" ? " estimados" : "";
    if (vista === "gasto") return `Tus gastos${estim} de ${periodo}.`;
    if (vista === "ingreso") return `Tus ingresos${estim} de ${periodo}.`;
    return `Todos tus movimientos de ${periodo}.`;
  }
  function sincronizarVista() {
    botonesVista.forEach((b, i) => b.classList.toggle("activo", opcionesVista[i].valor === vista));
    subtitulo.textContent = textoSubtitulo();
  }
  sincronizarVista();
  const tabsVista = el("div", { class: "selector-tipo tabs-vista" }, botonesVista);

  // En escritorio vive dentro del encabezado (ver `encabezado` más abajo);
  // en móvil el propio CSS lo vuelve flotante circular en la esquina
  // inferior derecha. "Cargar comprobante" (con OCR) vive ahora solo dentro
  // del propio modal de alta (movimientoForm.js ya lo trae).
  const btnAgregar = el(
    "button",
    {
      class: "boton--primario fab-agregar",
      type: "button",
      "aria-label": "Agregar movimiento",
      onClick: () => abrirModalNuevo(),
    },
    [mas(), el("span", { class: "fab-agregar-texto", text: "Agregar" })]
  );

  const lista = el("div", { class: "lista lista-grupos" });
  const contador = el("p", { class: "contador-lista" });

  // Solo mobile (CSS): balance del período arriba de todo, además del panel
  // de resumen completo que ya se ve más abajo (aside) — no lo reemplaza.
  const balanceMovilValor = el("span", { class: "balance-movil-valor valor-balance" });
  const balanceMovil = el("div", { class: "balance-movil" }, [
    el("span", { class: "balance-movil-etiqueta", text: "Balance actual" }),
    balanceMovilValor,
  ]);

  // Encabezado de la página: vive sobre el fondo general, FUERA de la tarjeta.
  // A la izquierda: icono + título + contador + subtítulo. A la derecha,
  // en la misma fila: buscador, filtros y el botón "Agregar" al final.
  const encabezado = el("header", { class: "movimientos-encabezado" }, [
    tituloVista(intercambioIcono, ["Movimientos", badge], subtitulo),
    el("div", { class: "movimientos-encabezado-acciones" }, [
      el("div", { class: "lista-acciones" }, [
        el("div", { class: "campo-busqueda" }, [lupaIcono(), buscador]),
        btnFiltros,
        backdropFiltros,
        panelFiltros,
      ]),
      btnAgregar,
    ]),
  ]);

  // Cada grupo (fecha o categoría) se pinta como su propia tarjeta
  // independiente dentro de `lista`; no hay una tarjeta contenedora general.
  const principal = el("div", { class: "movimientos-principal" }, [
    encabezado,
    balanceMovil,
    tabsVista,
    error,
    lista,
    contador,
  ]);
  const aside = el("aside", { class: "panel-lateral" });
  contenedor.append(el("div", { class: "vista-movimientos" }, [principal, aside]));

  let categorias = [];
  let todos = [];
  const colapsados = new Set(prefs.get("gruposColapsados"));

  function grupoHeader(claveGrupo, etiqueta, movimientosGrupo) {
    const colapsado = colapsados.has(claveGrupo);
    const { balance } = calcularTotales(movimientosGrupo);
    const signo = balance >= 0 ? "+" : "−";
    const btn = el(
      "button",
      {
        type: "button",
        class: "lista-grupo-titulo" + (colapsado ? " colapsado" : ""),
        "aria-expanded": String(!colapsado),
      },
      [
        chevronAbajo(),
        el("span", { text: etiqueta }),
        el("span", {
          class: "lista-grupo-total",
          text: `${signo} ${formatoCLP(Math.abs(balance))}`,
        }),
      ]
    );
    btn.addEventListener("click", () => {
      if (colapsados.has(claveGrupo)) colapsados.delete(claveGrupo);
      else colapsados.add(claveGrupo);
      prefs.set("gruposColapsados", [...colapsados]);
      pintarLista();
    });
    return { btn, colapsado };
  }

  function actualizarOpcionesCategoria() {
    const valorPrevio = selCategoria.value;
    limpiar(selCategoria);
    selCategoria.append(el("option", { value: "", text: "Todas las categorías" }));
    // Solo las categorías del modo activo: en "Real" no se listan las de
    // "Estimado" y viceversa.
    for (const c of categorias.filter((c) => c.modo === modo)) {
      selCategoria.append(el("option", { value: c.id, text: c.nombre }));
    }
    selCategoria.value = valorPrevio;
  }

  async function cargarCategorias() {
    try {
      categorias = await listarCategorias();
    } catch (e) {
      categorias = [];
    }
    actualizarOpcionesCategoria();
  }

  // Reintenta si la carga inicial falló (ej. corte de red momentáneo): sin
  // esto, categorias quedaba vacío para siempre y el formulario no dejaba
  // elegir ninguna categoría hasta cerrar y volver a abrir la pantalla.
  async function asegurarCategorias() {
    if (categorias.length === 0) await cargarCategorias();
    return categorias;
  }

  await cargarCategorias();

  if (categoriaInicial) {
    selCategoria.value = String(categoriaInicial);
    actualizarIndicadorFiltros();
  }

  // Al agregar (no al editar) se limpian los filtros que podrían esconder
  // el movimiento recién creado — de lo contrario parece que "no se guardó"
  // hasta recargar la página, cuando en realidad quedó afuera de la pestaña
  // o el filtro de categoría activos.
  function alAgregarMovimiento() {
    buscador.value = "";
    selCategoria.value = "";
    selEstado.value = "";
    selPago.value = "";
    actualizarIndicadorFiltros();
    if (vista !== "todos" && opcionesVista.some((o) => o.valor === "todos")) {
      vista = "todos";
      sincronizarVista();
    }
    return recargar();
  }

  async function abrirModalNuevo() {
    const cats = await asegurarCategorias();
    abrirMovimientoForm({ modo, categorias: cats, onGuardado: alAgregarMovimiento });
  }

  buscador.addEventListener("input", pintarLista);
  selCategoria.addEventListener("change", () => {
    actualizarIndicadorFiltros();
    pintarLista();
  });
  selOrden.addEventListener("change", pintarLista);
  selEstado.addEventListener("change", () => {
    actualizarIndicadorFiltros();
    pintarLista();
  });
  selPago.addEventListener("change", () => {
    actualizarIndicadorFiltros();
    pintarLista();
  });

  await recargar();

  async function recargar() {
    error.textContent = "";
    try {
      todos = await listarMovimientos({ ...rango, modo });
      pintarLista();
      const paraTotales = filtrarParaCalculos(todos, {
        modo,
        incluirInactivos: prefs.get("incluirInactivos"),
      });
      const { balance } = calcularTotales(paraTotales);
      balanceMovilValor.textContent = prefs.get("ocultarTotal") ? "*****" : formatoCLP(balance);
      montarPanelResumen(aside, todos, paraTotales, {
        tipo,
        fechaRef,
        onCategoria: (catId) =>
          montarMovimientos(contenedor, { rango, modo, tipo, fechaRef, categoriaInicial: catId, irA }),
        irA,
      });
    } catch (e) {
      todos = [];
      limpiar(lista);
      contador.textContent = "";
      error.textContent = "No se pudo conectar. ";
      error.append(el("button", { text: "Reintentar", onClick: recargar }));
    }
  }

  function pintarLista() {
    limpiar(lista);
    const texto = buscador.value.trim().toLowerCase();
    const filtrados = todos.filter((m) => {
      if (vista !== "todos" && m.tipo !== vista) return false;
      if (selCategoria.value && String(m.categoria_id || "") !== selCategoria.value) return false;
      const inactivo = m.activo === false;
      if (selEstado.value === "activo" && inactivo) return false;
      if (selEstado.value === "inactivo" && !inactivo) return false;
      if (selPago.value === "pagado" && m.pagado !== true) return false;
      if (selPago.value === "pendiente" && m.pagado === true) return false;
      if (texto) {
        const hay = `${m.nombre} ${m.detalle || ""}`.toLowerCase();
        if (!hay.includes(texto)) return false;
      }
      return true;
    });

    const comparadores = {
      fecha_desc: (a, b) => (b.fecha || "").localeCompare(a.fecha || ""),
      fecha_asc: (a, b) => (a.fecha || "").localeCompare(b.fecha || ""),
      monto_desc: (a, b) => Number(b.monto) - Number(a.monto),
      monto_asc: (a, b) => Number(a.monto) - Number(b.monto),
    };
    filtrados.sort(comparadores[selOrden.value] || comparadores.fecha_desc);

    // Al ordenar por "Monto", los grupos se ordenan por el total de su
    // encabezado (magnitud del balance del grupo), no por el valor suelto de
    // cada movimiento. El orden interno de cada grupo lo sigue fijando el
    // sort de arriba (montos de mayor a menor / menor a mayor).
    function ordenarGruposPorMonto(grupos) {
      const v = selOrden.value;
      if (v !== "monto_desc" && v !== "monto_asc") return grupos;
      const totalGrupo = (g) => Math.abs(calcularTotales(g.movimientos).balance);
      const dir = v === "monto_desc" ? -1 : 1;
      return [...grupos].sort((a, b) => dir * (totalGrupo(a) - totalGrupo(b)));
    }

    // Cada grupo es una tarjeta propia: encabezado (fecha/categoría + total)
    // y, debajo, sus movimientos. Sin tarjeta contenedora general.
    function pintarGrupo(claveGrupo, etiqueta, movimientosGrupo) {
      const { btn, colapsado } = grupoHeader(claveGrupo, etiqueta, movimientosGrupo);
      const tarjeta = el("section", { class: "panel-tarjeta lista-grupo" }, [btn]);
      if (!colapsado) {
        for (const m of movimientosGrupo) {
          tarjeta.append(fila(m, recargar, error, modo, asegurarCategorias));
        }
      }
      lista.append(tarjeta);
    }

    badge.textContent = String(todos.length);
    if (todos.length === 0) {
      lista.append(
        el("section", { class: "panel-tarjeta" }, [
          el("p", { class: "vacio", text: "No hay movimientos en este período." }),
        ])
      );
    } else if (filtrados.length === 0) {
      lista.append(
        el("section", { class: "panel-tarjeta" }, [
          el("p", { class: "vacio", text: "Ningún movimiento coincide con la búsqueda." }),
        ])
      );
    } else if (modo === "estimado") {
      for (const grupo of ordenarGruposPorMonto(agruparPorCategoria(filtrados))) {
        pintarGrupo(`estimado:${grupo.clave}`, grupo.nombre, grupo.movimientos);
      }
    } else {
      for (const grupo of ordenarGruposPorMonto(agruparPorFecha(filtrados))) {
        pintarGrupo(`real:${grupo.clave}`, etiquetaDia(grupo.clave), grupo.movimientos);
      }
    }
    contador.textContent = `Mostrando ${filtrados.length} de ${todos.length} movimientos`;
  }
}

function fila(m, recargar, error, modo, asegurarCategorias) {
  const signo = m.tipo === "ingreso" ? "+" : "−";
  const cat = m.categoria ? m.categoria.nombre : "Sin categoría";
  const color = colorMovimiento(m);
  const inactivo = m.activo === false;

  const iconoFila = el("span", { class: "fila-icono" }, [nodoIconoCategoria(m.categoria, m.nombre)]);
  // Fondo pastel (tinte suave del color de la categoría) + icono en el
  // color pleno de la categoría, para bajar el peso visual del círculo.
  iconoFila.style.background = `color-mix(in srgb, ${color} 16%, transparent)`;
  iconoFila.style.color = color;

  async function abrirEdicion() {
    const categorias = await asegurarCategorias();
    abrirMovimientoForm({ modo, categorias, movimiento: m, onGuardado: recargar });
  }

  const borrar = el(
    "button",
    {
      class: "boton--icono",
      "aria-label": `Borrar ${m.nombre}`,
      title: "Borrar",
      onClick: async () => {
        if (!confirm(`¿Borrar "${m.nombre}"?`)) return;
        try {
          await eliminarMovimiento(m.id);
          await recargar();
        } catch (e) {
          error.textContent = "No se pudo borrar el movimiento.";
        }
      },
    },
    [basura()]
  );

  const toggleActivo = el(
    "button",
    {
      class: inactivo ? "boton--icono estado-off" : "boton--icono estado-on",
      title: inactivo ? "Activar" : "Desactivar",
      "aria-label": inactivo ? "Activar" : "Desactivar",
      onClick: async () => {
        try {
          await actualizarMovimiento(m.id, { activo: inactivo });
          await recargar();
        } catch (e) {
          error.textContent = "No se pudo cambiar el estado.";
        }
      },
    },
    [check()]
  );

  const controles = [toggleActivo, borrar];

  const metaHijos = [el("span", { class: "cat", text: cat })];
  if (modo === "estimado") {
    const togglePagado = el(
      "button",
      {
        class: (m.pagado ? "pagado" : "pendiente") + " mov-badge-estado",
        text: m.pagado ? "Pagado" : "Pendiente",
        onClick: async () => {
          try {
            await actualizarMovimiento(m.id, { pagado: !m.pagado });
            await recargar();
          } catch (e) {
            error.textContent = "No se pudo actualizar el estado.";
          }
        },
      },
      []
    );
    metaHijos.push(el("span", { class: "fila-meta-sep", text: "·" }), togglePagado);
  }

  const claseFila =
    `fila fila--editable tipo-${m.tipo}` +
    (modo === "estimado" && m.pagado ? " fila-pagada" : "") +
    (inactivo ? " fila--inactiva" : "");

  // Toda la fila abre la edición. Se ignoran los clics que nacen en los
  // controles propios (activar/desactivar, borrar, badge Pagado/Pendiente),
  // que tienen su propia acción.
  const esControl = (nodo) => nodo instanceof Element && nodo.closest(".acciones, .mov-badge-estado");

  return el(
    "div",
    {
      class: claseFila,
      role: "button",
      tabindex: "0",
      "aria-label": `Editar ${m.nombre}`,
      onClick: (ev) => {
        if (esControl(ev.target)) return;
        abrirEdicion();
      },
      onKeydown: (ev) => {
        if (ev.target !== ev.currentTarget) return;
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          abrirEdicion();
        }
      },
    },
    [
      iconoFila,
      el("div", { class: "fila-principal" }, [
        el("span", { class: "fila-nombre-linea" }, [
          el("span", { class: "nombre", text: m.nombre }),
          inactivo ? el("span", { class: "badge-inactivo", text: "Inactivo" }) : null,
        ]),
      ]),
      el("span", { class: "fila-meta" }, metaHijos),
      el("div", { class: "acciones" }, controles),
      el("span", { class: "monto", text: `${signo} ${formatoCLP(m.monto)}` }),
    ]
  );
}
