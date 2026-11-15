import { el, limpiar } from "./dom.js";
import { listarCategorias, actualizarCategoria, eliminarCategoria } from "../data/categorias.js";
import { abrirCategoriaForm } from "./categoriaForm.js";
import { nodoIconoCategoria } from "./iconoCategoria.js";
import { prefs } from "../prefs.js";
import {
  lapiz,
  basura,
  flechaArribaCirculo,
  flechaAbajoCirculo,
  etiquetasIcono,
  lupaIcono,
  puntosIcono,
  mas,
} from "./iconos.js";
import { tituloVista } from "./tituloVista.js";

// Listener global (cerrar menús al hacer clic fuera) del montaje anterior:
// la vista se re-monta al navegar y hay que quitar el anterior para no
// acumular listeners muertos.
let removerCierreMenus = null;

export function montarCategorias(contenedor) {
  limpiar(contenedor);
  const modo = prefs.get("modo");
  let todas = [];
  const normalizados = new Set();
  let filtroTexto = "";
  let filtroTipo = "gasto"; // gasto | ingreso (pestañas)

  const error = el("p", { class: "error", role: "alert" });
  const cuerpo = el("div", { class: "categorias-cuerpo" });
  const abrirNueva = () =>
    abrirCategoriaForm({
      modoInicial: modo,
      tipoInicial: filtroTipo,
      categoriasExistentes: todas,
      onGuardado: recargar,
    });

  const btnNueva = el("button", { class: "boton--primario categorias-btn-nueva", onClick: abrirNueva }, [
    mas(),
    el("span", { text: "Nueva categoría" }),
  ]);

  const cabecera = el("div", { class: "categorias-cabecera" }, [
    el("div", { class: "categorias-cabecera-texto" }, [
      tituloVista(
        etiquetasIcono,
        "Categorías",
        `Organiza las categorías del modo ${modo === "estimado" ? "Estimado" : "Real"}.`
      ),
    ]),
    btnNueva,
  ]);

  const inputBuscar = el("input", {
    type: "search",
    placeholder: "Buscar categoría...",
    "aria-label": "Buscar categoría",
    onInput: (e) => {
      filtroTexto = e.target.value.trim().toLowerCase();
      render();
    },
  });
  // Pestañas Gastos / Ingresos con su cantidad (reemplazan al desplegable
  // "Todas" y a las tarjetas con los totales).
  const conteoTab = { gasto: el("span", { class: "categorias-tab-conteo" }), ingreso: el("span", { class: "categorias-tab-conteo" }) };
  const tabs = ["gasto", "ingreso"].map((t) =>
    el(
      "button",
      {
        type: "button",
        "data-tipo": t,
        onClick: () => {
          filtroTipo = t;
          render();
        },
      },
      [el("span", { text: t === "gasto" ? "Gastos" : "Ingresos" }), conteoTab[t]]
    )
  );
  const selectorTabs = el(
    "div",
    { class: "selector-tipo categorias-tabs", role: "group", "aria-label": "Tipo de categoría" },
    tabs
  );
  const barraBuscar = el("div", { class: "panel-tarjeta categorias-barra-buscar" }, [
    selectorTabs,
    el("div", { class: "campo-busqueda" }, [lupaIcono(), inputBuscar]),
  ]);

  contenedor.append(cabecera, error, barraBuscar, cuerpo);

  // Cerrar los menús "⋮" abiertos al hacer clic en cualquier otro lugar.
  if (removerCierreMenus) removerCierreMenus();
  const alClickDocumento = (e) => {
    if (!e.target.closest(".categoria-tarjeta-menu")) cerrarMenus();
  };
  const alTeclaDocumento = (e) => {
    if (e.key === "Escape") cerrarMenus();
  };
  document.addEventListener("click", alClickDocumento);
  document.addEventListener("keydown", alTeclaDocumento);
  removerCierreMenus = () => {
    document.removeEventListener("click", alClickDocumento);
    document.removeEventListener("keydown", alTeclaDocumento);
  };

  recargar();

  async function recargar() {
    error.textContent = "";
    try {
      todas = await listarCategorias();
      if (await normalizarTodo()) return; // normalizarOrden ya relanzó recargar()
      render();
    } catch (e) {
      error.textContent = "No se pudieron cargar las categorías.";
    }
  }

  function grupoOrdenado(tipo) {
    return todas
      .filter((c) => c.modo === modo && c.tipo === tipo)
      .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
  }

  async function normalizarTodo() {
    for (const tipo of ["gasto", "ingreso"]) {
      const grupo = grupoOrdenado(tipo);
      if (grupo.length > 1 && (await normalizarOrden(grupo, `${modo}-${tipo}`))) return true;
    }
    return false;
  }

  async function normalizarOrden(grupo, clave) {
    // Si el grupo nunca se reordenó, todos los "orden" valen 0 y ↑/↓ no puede
    // intercambiar. Se asigna orden = índice una sola vez.
    const ordenes = grupo.map((c) => c.orden);
    const hayDuplicados = new Set(ordenes).size !== ordenes.length;
    if (!hayDuplicados || normalizados.has(clave)) return false;
    normalizados.add(clave);
    try {
      await Promise.all(
        grupo.map((c, i) => (c.orden === i ? null : actualizarCategoria(c.id, { orden: i })))
      );
      await recargar();
      return true;
    } catch (e) {
      error.textContent = "No se pudo ordenar las categorías.";
      return false;
    }
  }

  function cerrarMenus() {
    for (const m of cuerpo.querySelectorAll(".categoria-menu:not([hidden])")) m.hidden = true;
  }

  function coincide(c) {
    return !filtroTexto || c.nombre.toLowerCase().includes(filtroTexto);
  }

  function render() {
    cerrarMenus();
    limpiar(cuerpo);

    for (const b of tabs) {
      const activo = b.dataset.tipo === filtroTipo;
      b.classList.toggle("activo", activo);
      b.setAttribute("aria-pressed", String(activo));
      conteoTab[b.dataset.tipo].textContent = String(grupoOrdenado(b.dataset.tipo).filter(coincide).length);
    }

    const grupo = grupoOrdenado(filtroTipo);
    const visibles = grupo.filter(coincide);
    const otroTipo = filtroTipo === "gasto" ? "ingreso" : "gasto";
    const enOtro = filtroTexto ? grupoOrdenado(otroTipo).filter(coincide).length : 0;

    if (filtroTexto && visibles.length === 0) {
      cuerpo.append(
        el("div", { class: "categorias-vacio" }, [
          el("p", { class: "vacio", text: `No hay categorías de ${filtroTipo === "gasto" ? "gasto" : "ingreso"} con "${inputBuscar.value.trim()}".` }),
          enOtro
            ? el("button", {
                type: "button",
                class: "enlace-ver",
                text: `Ver ${enOtro} en ${otroTipo === "gasto" ? "Gastos" : "Ingresos"}`,
                onClick: () => {
                  filtroTipo = otroTipo;
                  render();
                },
              })
            : null,
        ])
      );
      return;
    }

    const tiles = visibles.map((c) => tarjeta(c, grupo));
    // Al final de la grilla, un acceso para crear otra del mismo tipo.
    if (!filtroTexto) {
      tiles.push(
        el("button", { type: "button", class: "categoria-tarjeta categoria-tarjeta--nueva", onClick: abrirNueva }, [
          el("span", { class: "categoria-tarjeta-icono" }, [mas()]),
          el("span", { class: "categoria-tarjeta-nombre", text: "Nueva categoría" }),
        ])
      );
    }
    cuerpo.append(el("div", { class: "categorias-grid" }, tiles));
    cuerpo.append(
      el("p", {
        class: "categorias-ayuda",
        text: "Toca una categoría para editarla. Con ⋮ puedes subirla o bajarla: ese orden es el que se usa al agregar un movimiento.",
      })
    );
  }

  function tarjeta(c, grupo) {
    const indice = grupo.indexOf(c);

    // Mismo lenguaje visual que la lista de Movimientos: círculo con fondo
    // pastel (tinte suave del color de la categoría) + icono en el color pleno.
    const icono = el("span", { class: "categoria-tarjeta-icono" }, [nodoIconoCategoria(c)]);
    if (c.color) {
      icono.style.background = `color-mix(in srgb, ${c.color} 16%, transparent)`;
      icono.style.color = c.color;
    }

    const abrirEdicion = () =>
      abrirCategoriaForm({ categoria: c, modoInicial: modo, categoriasExistentes: todas, onGuardado: recargar });

    return el(
      "div",
      {
        class: "categoria-tarjeta",
        role: "button",
        tabindex: "0",
        onClick: (e) => {
          // El menú "⋮" tiene sus propios manejadores.
          if (e.target.closest(".categoria-tarjeta-menu")) return;
          abrirEdicion();
        },
        onKeydown: (e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            abrirEdicion();
          }
        },
      },
      [
        icono,
        el("span", { class: "categoria-tarjeta-nombre", text: c.nombre }),
        menuAcciones(c, grupo, indice),
      ]
    );
  }

  function menuAcciones(c, grupo, indice) {
    const popover = el("div", { class: "categoria-menu", hidden: "true", role: "menu" });

    const btnMenu = el(
      "button",
      {
        class: "boton--icono categoria-tarjeta-menu-boton",
        "aria-label": `Acciones de ${c.nombre}`,
        "aria-haspopup": "true",
        title: "Acciones",
        onClick: (e) => {
          e.stopPropagation();
          const abrir = popover.hidden;
          cerrarMenus();
          popover.hidden = !abrir;
        },
      },
      [puntosIcono()]
    );

    const item = (label, fabricaIcono, deshabilitado, accion, peligro = false) => {
      const b = el(
        "button",
        {
          class: `categoria-menu-item${peligro ? " categoria-menu-item--peligro" : ""}`,
          type: "button",
          role: "menuitem",
          onClick: (e) => {
            e.stopPropagation();
            popover.hidden = true;
            accion();
          },
        },
        [fabricaIcono(), el("span", { text: label })]
      );
      if (deshabilitado) b.disabled = true;
      return b;
    };

    popover.append(
      item("Subir", flechaArribaCirculo, indice <= 0, () =>
        intercambiarOrden(c, grupo[indice - 1])
      ),
      item("Bajar", flechaAbajoCirculo, indice === grupo.length - 1, () =>
        intercambiarOrden(c, grupo[indice + 1])
      ),
      item("Editar", lapiz, false, () =>
        abrirCategoriaForm({ categoria: c, modoInicial: modo, categoriasExistentes: todas, onGuardado: recargar })
      ),
      item(
        "Eliminar",
        basura,
        false,
        async () => {
          if (!confirm(`¿Borrar "${c.nombre}"? Los movimientos quedarán sin categoría.`)) return;
          try {
            await eliminarCategoria(c.id);
            await recargar();
          } catch (e) {
            error.textContent = "No se pudo borrar la categoría.";
          }
        },
        true
      )
    );

    return el("div", { class: "categoria-tarjeta-menu" }, [btnMenu, popover]);
  }

  async function intercambiarOrden(a, b) {
    if (!a || !b) return;
    try {
      await actualizarCategoria(a.id, { orden: b.orden });
      await actualizarCategoria(b.id, { orden: a.orden });
      await recargar();
    } catch (e) {
      error.textContent = "No se pudo reordenar.";
    }
  }
}
