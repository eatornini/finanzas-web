import { el, limpiar } from "./dom.js";
import { listarMovimientos, actualizarMovimiento, eliminarMovimiento } from "../data/movimientos.js";
import { listarCategorias } from "../data/categorias.js";
import { basura, lupaIcono, embudoIcono, chevronAbajo, check, mas } from "./iconos.js";
import { colorMovimiento } from "./iconosCategoria.js";
import { nodoIconoCategoria } from "./iconoCategoria.js";
import { montarPanelResumen } from "./panelResumenView.js";
import { abrirMovimientoForm } from "./movimientoForm.js";
import { filtrarParaCalculos, calcularTotales } from "../logic/totales.js";
import { agruparPorFecha, agruparPorCategoria } from "../logic/agrupacionMovimientos.js";
import { etiquetaDia } from "../logic/periodos.js";
import { formatoCLP } from "../logic/dinero.js";
import { prefs } from "../prefs.js";

export async function montarMovimientos(contenedor, { rango, modo, tipo, categoriaInicial = null }) {
  limpiar(contenedor);

  const error = el("p", { class: "error", role: "alert" });
  const badge = el("span", { class: "badge", text: "0" });
  const buscador = el("input", {
    class: "buscador",
    type: "search",
    placeholder: "Buscar…",
  });
  const btnFiltros = el("button", { class: "boton--filtros" }, [
    embudoIcono(),
    "Filtros",
    chevronAbajo(),
  ]);
  const panelFiltros = el("div", { class: "panel-filtros", hidden: "true" });
  const selCategoria = el("select", {}, [el("option", { value: "", text: "Todas las categorías" })]);
  panelFiltros.append(el("label", { text: "Categoría" }, [selCategoria]));
  btnFiltros.addEventListener("click", () => {
    panelFiltros.hidden = !panelFiltros.hidden;
    btnFiltros.classList.toggle("activo", !panelFiltros.hidden);
  });

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
  function sincronizarVista() {
    botonesVista.forEach((b, i) => b.classList.toggle("activo", opcionesVista[i].valor === vista));
  }
  sincronizarVista();
  const tabsVista = el("div", { class: "selector-tipo tabs-vista" }, botonesVista);

  // Flotante y siempre visible; "Cargar comprobante" (con OCR) vive ahora
  // solo dentro del propio modal de alta (movimientoForm.js ya lo trae).
  const btnAgregar = el(
    "button",
    { class: "fab-agregar", type: "button", "aria-label": "Agregar movimiento", onClick: () => abrirModalNuevo() },
    [mas(), el("span", { text: "Agregar" })]
  );

  const lista = el("div", { class: "lista" });
  const contador = el("p", { class: "contador-lista" });

  const tarjetaLista = el("section", { class: "panel-tarjeta lista-movimientos" }, [
    el("div", { class: "lista-cabecera" }, [
      el("div", { class: "lista-titulo" }, [el("h3", {}, ["Movimientos ", badge])]),
      el("div", { class: "lista-acciones" }, [
        el("div", { class: "campo-busqueda" }, [lupaIcono(), buscador]),
        btnFiltros,
        panelFiltros,
      ]),
    ]),
    tabsVista,
    error,
    lista,
    contador,
  ]);

  const principal = el("div", { class: "movimientos-principal" }, [tarjetaLista]);
  const aside = el("aside", { class: "panel-lateral" });
  contenedor.append(el("div", { class: "vista-movimientos" }, [principal, aside]), btnAgregar);

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
          class: "lista-grupo-total" + (balance >= 0 ? " valor-ingreso" : ""),
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

  try {
    categorias = await listarCategorias();
    for (const c of categorias) {
      selCategoria.append(el("option", { value: c.id, text: c.nombre }));
    }
  } catch (e) {
    // Se seguirá intentando al abrir el modal.
  }

  if (categoriaInicial) {
    selCategoria.value = String(categoriaInicial);
    panelFiltros.hidden = false;
    btnFiltros.classList.add("activo");
  }

  function abrirModalNuevo() {
    abrirMovimientoForm({ modo, categorias, onGuardado: recargar });
  }

  buscador.addEventListener("input", pintarLista);
  selCategoria.addEventListener("change", pintarLista);

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
      montarPanelResumen(aside, todos, paraTotales, {
        tipo,
        onCategoria: (catId) =>
          montarMovimientos(contenedor, { rango, modo, tipo, categoriaInicial: catId }),
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
      if (texto) {
        const hay = `${m.nombre} ${m.detalle || ""}`.toLowerCase();
        if (!hay.includes(texto)) return false;
      }
      return true;
    });

    badge.textContent = String(todos.length);
    if (todos.length === 0) {
      lista.append(el("p", { class: "vacio", text: "No hay movimientos en este período." }));
    } else if (filtrados.length === 0) {
      lista.append(el("p", { class: "vacio", text: "Ningún movimiento coincide con la búsqueda." }));
    } else if (modo === "estimado") {
      for (const grupo of agruparPorCategoria(filtrados)) {
        const { btn, colapsado } = grupoHeader(`estimado:${grupo.clave}`, grupo.nombre, grupo.movimientos);
        lista.append(btn);
        if (!colapsado) for (const m of grupo.movimientos) lista.append(fila(m, recargar, error, modo, categorias));
      }
    } else {
      for (const grupo of agruparPorFecha(filtrados)) {
        const { btn, colapsado } = grupoHeader(`real:${grupo.clave}`, etiquetaDia(grupo.clave), grupo.movimientos);
        lista.append(btn);
        if (!colapsado) for (const m of grupo.movimientos) lista.append(fila(m, recargar, error, modo, categorias));
      }
    }
    contador.textContent = `Mostrando ${filtrados.length} de ${todos.length} movimientos`;
  }
}

function fila(m, recargar, error, modo, categorias) {
  const signo = m.tipo === "ingreso" ? "+" : "−";
  const cat = m.categoria ? m.categoria.nombre : "Sin categoría";
  const color = colorMovimiento(m);
  const inactivo = m.activo === false;

  const iconoFila = el("span", { class: "fila-icono" }, [nodoIconoCategoria(m.categoria, m.nombre)]);
  iconoFila.style.background = color;
  iconoFila.style.color = "#fff";

  function abrirEdicion() {
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
    `fila tipo-${m.tipo}` +
    (modo === "estimado" && m.pagado ? " fila-pagada" : "") +
    (inactivo ? " fila--inactiva" : "");

  return el("div", { class: claseFila }, [
    iconoFila,
    el("div", { class: "fila-principal" }, [
      el("span", {
        class: "nombre",
        text: m.nombre,
        role: "button",
        tabindex: "0",
        "aria-label": `Editar ${m.nombre}`,
        onClick: abrirEdicion,
        onKeydown: (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            abrirEdicion();
          }
        },
      }),
      inactivo ? el("span", { class: "badge-inactivo", text: "Inactivo" }) : null,
    ]),
    el("span", { class: "fila-meta" }, metaHijos),
    el("div", { class: "acciones" }, controles),
    el("span", { class: "monto", text: `${signo} ${formatoCLP(m.monto)}` }),
  ]);
}
