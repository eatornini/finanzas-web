import { el, limpiar } from "./dom.js";
import { listarMovimientos, actualizarMovimiento, eliminarMovimiento } from "../data/movimientos.js";
import { listarCategorias } from "../data/categorias.js";
import { lapiz, basura, lupaIcono, embudoIcono, chevronAbajo, check } from "./iconos.js";
import { colorMovimiento } from "./iconosCategoria.js";
import { nodoIconoCategoria } from "./iconoCategoria.js";
import { montarPanelResumen } from "./panelResumenView.js";
import { abrirMovimientoForm } from "./movimientoForm.js";
import { filtrarParaCalculos } from "../logic/totales.js";
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
  const selTipo = el("select", {}, [
    el("option", { value: "", text: "Todos los tipos" }),
    el("option", { value: "ingreso", text: "Ingreso" }),
    el("option", { value: "gasto", text: "Gasto" }),
  ]);
  const selCategoria = el("select", {}, [el("option", { value: "", text: "Todas las categorías" })]);
  panelFiltros.append(
    el("label", { text: "Tipo" }, [selTipo]),
    el("label", { text: "Categoría" }, [selCategoria])
  );
  btnFiltros.addEventListener("click", () => {
    panelFiltros.hidden = !panelFiltros.hidden;
    btnFiltros.classList.toggle("activo", !panelFiltros.hidden);
  });

  const btnAgregar = el(
    "button",
    { class: "boton--primario", type: "button", onClick: () => abrirModalNuevo() },
    ["+ Agregar movimiento"]
  );

  const lista = el("div", { class: "lista" });
  const contador = el("p", { class: "contador-lista" });

  const tarjetaLista = el("section", { class: "panel-tarjeta lista-movimientos" }, [
    el("div", { class: "lista-cabecera" }, [
      el("div", { class: "lista-titulo" }, [
        el("h3", {}, ["Movimientos ", badge]),
        btnAgregar,
      ]),
      el("div", { class: "lista-acciones" }, [
        el("div", { class: "campo-busqueda" }, [lupaIcono(), buscador]),
        btnFiltros,
      ]),
    ]),
    panelFiltros,
    error,
    lista,
    contador,
  ]);

  const principal = el("div", { class: "movimientos-principal" }, [tarjetaLista]);
  const aside = el("aside", { class: "panel-lateral" });
  contenedor.append(el("div", { class: "vista-movimientos" }, [principal, aside]));

  let categorias = [];
  let todos = [];

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
  selTipo.addEventListener("change", pintarLista);
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
      if (selTipo.value && m.tipo !== selTipo.value) return false;
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
    } else {
      for (const m of filtrados) lista.append(fila(m, recargar, error, modo, categorias));
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
  iconoFila.style.color = color;
  iconoFila.style.background = `color-mix(in srgb, ${color} 16%, transparent)`;

  const editar = el(
    "button",
    {
      class: "boton--icono",
      "aria-label": "Editar",
      title: "Editar",
      onClick: () => abrirMovimientoForm({ modo, categorias, movimiento: m, onGuardado: recargar }),
    },
    [lapiz()]
  );

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

  const controles = [toggleActivo, editar, borrar];
  if (modo === "estimado") {
    const togglePagado = el(
      "button",
      {
        class: m.pagado ? "pagado" : "pendiente",
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
    controles.unshift(togglePagado);
  }

  const claseFila =
    `fila tipo-${m.tipo}` +
    (modo === "estimado" && m.pagado ? " fila-pagada" : "") +
    (inactivo ? " fila--inactiva" : "");

  return el("div", { class: claseFila }, [
    iconoFila,
    el("div", { class: "fila-principal" }, [
      el("span", { class: "nombre", text: m.nombre }),
      inactivo ? el("span", { class: "badge-inactivo", text: "Inactivo" }) : null,
      el("span", { class: "fila-meta" }, [
        el("span", { class: "cat", text: cat }),
        el("span", { class: "fecha", text: (m.fecha || "").slice(0, 10) }),
      ]),
    ]),
    el("span", { class: "monto", text: `${signo} ${formatoCLP(m.monto)}` }),
    el("div", { class: "acciones" }, controles),
  ]);
}
