import { el, limpiar } from "./dom.js";
import {
  listarMovimientos,
  crearMovimiento,
  actualizarMovimiento,
  eliminarMovimiento,
} from "../data/movimientos.js";
import { listarCategorias } from "../data/categorias.js";
import { lapiz, basura, lupaIcono, embudoIcono, chevronAbajo } from "./iconos.js";
import { iconoMovimiento, colorMovimiento } from "./iconosCategoria.js";
import { montarPanelResumen } from "./panelResumenView.js";
import { montarModal } from "./modal.js";

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function fmt(n) {
  return Number(n).toLocaleString("es", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export async function montarMovimientos(contenedor, { rango, modo, tipo }) {
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
    // Se seguirá intentando al abrir el modal; el alta permite "Sin categoría".
  }

  function abrirModalNuevo() {
    const errorModal = el("p", { class: "error", role: "alert" });
    const { cerrar } = montarModal({
      titulo: "Agregar movimiento",
      contenido: formularioNuevo({
        recargar,
        error: errorModal,
        modo,
        categorias,
        onGuardado: () => cerrar(),
        onCancelar: () => cerrar(),
      }),
    });
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
      montarPanelResumen(aside, todos, { tipo });
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
      for (const m of filtrados) lista.append(fila(m, recargar, error, modo));
    }
    contador.textContent = `Mostrando ${filtrados.length} de ${todos.length} movimientos`;
  }
}

function opcionesCategoria(categorias, tipo) {
  return categorias
    .filter((c) => c.tipo === tipo)
    .map((c) => el("option", { value: c.id, text: c.nombre }));
}

function formularioNuevo({ recargar, error, modo, categorias = [], onGuardado, onCancelar }) {
  const nombre = el("input", { id: "campo-nombre", placeholder: "Ej: Bencina", required: "true" });
  const monto = el("input", {
    id: "campo-monto",
    type: "number",
    step: "0.01",
    min: "0",
    placeholder: "0",
    required: "true",
  });
  const tipo = el("select", { id: "campo-tipo" }, [
    el("option", { value: "gasto", text: "Gasto" }),
    el("option", { value: "ingreso", text: "Ingreso" }),
  ]);
  const categoria = el("select", { id: "campo-categoria" }, [
    el("option", { value: "", text: "Sin categoría" }),
    ...opcionesCategoria(categorias, "gasto"),
  ]);
  tipo.addEventListener("change", () => {
    limpiar(categoria);
    categoria.append(
      el("option", { value: "", text: "Sin categoría" }),
      ...opcionesCategoria(categorias, tipo.value)
    );
  });
  const fecha = el("input", { id: "campo-fecha", type: "date", value: hoyISO() });
  const detalle = el("input", { id: "campo-detalle", placeholder: "Detalle…" });
  const botonGuardar = el("button", {
    type: "submit",
    class: "boton--primario",
    text: "Agregar movimiento",
  });
  const botonCancelar = el("button", {
    type: "button",
    text: "Cancelar",
    onClick: () => onCancelar?.(),
  });

  function campo(etiqueta, input) {
    return el("label", { class: "campo", for: input.id, text: etiqueta }, [input]);
  }

  function campoMonto(etiqueta, input) {
    return el("label", { class: "campo", for: input.id, text: etiqueta }, [
      el("div", { class: "input-monto" }, [
        input,
        el("span", { class: "input-monto-simbolo", text: "$" }),
      ]),
    ]);
  }

  return el(
    "form",
    {
      class: "form-mov",
      onSubmit: async (ev) => {
        ev.preventDefault();
        error.textContent = "";
        const montoNum = Number(monto.value);
        if (!nombre.value.trim() || !Number.isFinite(montoNum) || montoNum < 0) {
          error.textContent = "Completa el nombre y un monto válido (0 o mayor).";
          return;
        }
        botonGuardar.disabled = true;
        botonGuardar.textContent = "Guardando…";
        try {
          await crearMovimiento({
            nombre: nombre.value.trim(),
            monto: montoNum,
            tipo: tipo.value,
            modo,
            pagado: false,
            categoria_id: categoria.value || null,
            fecha: fecha.value || hoyISO(),
            detalle: detalle.value.trim() || null,
          });
          await recargar();
          onGuardado?.();
        } catch (e) {
          error.textContent = "No se pudo guardar. Intenta de nuevo.";
          botonGuardar.disabled = false;
          botonGuardar.textContent = "Agregar movimiento";
        }
      },
    },
    [
      el("div", { class: "form-grid" }, [
        campo("Nombre", nombre),
        campoMonto("Monto", monto),
        campo("Tipo", tipo),
        campo("Categoría", categoria),
        campo("Fecha", fecha),
        campo("Detalle (opcional)", detalle),
      ]),
      error,
      el("div", { class: "modal-acciones" }, [botonCancelar, botonGuardar]),
    ]
  );
}

function fila(m, recargar, error, modo) {
  const signo = m.tipo === "ingreso" ? "+" : "−";
  const cat = m.categoria ? m.categoria.nombre : "Sin categoría";
  const color = colorMovimiento(m);

  const iconoFila = el("span", { class: "fila-icono" }, [iconoMovimiento(m)]);
  iconoFila.style.color = color;
  iconoFila.style.background = `color-mix(in srgb, ${color} 16%, transparent)`;

  const editarMonto = el(
    "button",
    {
      class: "boton--icono",
      "aria-label": "Editar monto",
      title: "Editar monto",
      onClick: async () => {
        const nuevo = prompt("Nuevo monto", m.monto);
        const num = Number(nuevo);
        if (nuevo === null || !Number.isFinite(num) || num < 0) return;
        try {
          await actualizarMovimiento(m.id, { monto: num });
          await recargar();
        } catch (e) {
          error.textContent = "No se pudo actualizar el movimiento.";
        }
      },
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

  const controles = [editarMonto, borrar];
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
    modo === "estimado" && m.pagado ? `fila tipo-${m.tipo} fila-pagada` : `fila tipo-${m.tipo}`;

  return el("div", { class: claseFila }, [
    iconoFila,
    el("div", { class: "fila-principal" }, [
      el("span", { class: "nombre", text: m.nombre }),
      el("span", { class: "fila-meta" }, [
        el("span", { class: "cat", text: cat }),
        el("span", { class: "fecha", text: m.fecha }),
      ]),
    ]),
    el("span", { class: "monto", text: `${signo} $${fmt(m.monto)}` }),
    el("div", { class: "acciones" }, controles),
  ]);
}
