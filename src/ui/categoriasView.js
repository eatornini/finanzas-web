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
  listaIcono,
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
  let filtroTipo = "todos"; // todos | gasto | ingreso

  const error = el("p", { class: "error", role: "alert" });
  const cuerpo = el("div", { class: "categorias-cuerpo" });
  const resumen = el("div", { class: "categorias-resumen" });

  const btnNueva = el("button", {
    class: "boton--primario",
    text: "+ Nueva categoría",
    onClick: () =>
      abrirCategoriaForm({ modoInicial: modo, tipoInicial: "gasto", onGuardado: recargar }),
  });

  const cabecera = el("div", { class: "categorias-cabecera" }, [
    el("div", { class: "categorias-cabecera-texto" }, [
      tituloVista(etiquetasIcono, "Categorías", "Organiza tus movimientos según tus necesidades."),
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
  const selectFiltro = el(
    "select",
    {
      class: "categorias-filtro-select",
      "aria-label": "Filtrar categorías por tipo",
      onChange: (e) => {
        filtroTipo = e.target.value;
        render();
      },
    },
    [
      el("option", { value: "todos", text: "Todas" }),
      el("option", { value: "gasto", text: "Gastos" }),
      el("option", { value: "ingreso", text: "Ingresos" }),
    ]
  );
  const barraBuscar = el("div", { class: "categorias-barra-buscar" }, [
    el("div", { class: "campo-busqueda" }, [lupaIcono(), inputBuscar]),
    selectFiltro,
  ]);

  contenedor.append(cabecera, error, resumen, barraBuscar, cuerpo);

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

  function render() {
    cerrarMenus();
    pintarResumen();
    limpiar(cuerpo);

    const tipos = ["gasto", "ingreso"].filter(
      (t) => filtroTipo === "todos" || filtroTipo === t
    );
    let huboResultados = false;

    for (const tipo of tipos) {
      const grupo = grupoOrdenado(tipo);
      const visibles = filtroTexto
        ? grupo.filter((c) => c.nombre.toLowerCase().includes(filtroTexto))
        : grupo;
      if (filtroTexto && visibles.length === 0) continue;
      if (visibles.length) huboResultados = true;
      cuerpo.append(seccionGrupo(tipo, grupo, visibles));
    }

    if (filtroTexto && !huboResultados) {
      cuerpo.append(
        el("p", {
          class: "vacio",
          text: `No se encontraron categorías para "${inputBuscar.value.trim()}".`,
        })
      );
    }
  }

  function pintarResumen() {
    limpiar(resumen);
    const nGastos = grupoOrdenado("gasto").length;
    const nIngresos = grupoOrdenado("ingreso").length;
    resumen.append(
      tarjetaResumen(flechaAbajoCirculo, nGastos, "Categorías de gastos", "gasto"),
      tarjetaResumen(flechaArribaCirculo, nIngresos, "Categorías de ingresos", "ingreso"),
      tarjetaResumen(listaIcono, nGastos + nIngresos, "Categorías en total", "neutro")
    );
  }

  function tarjetaResumen(fabricaIcono, numero, etiqueta, variante) {
    return el("div", { class: `categorias-resumen-tarjeta categorias-resumen-tarjeta--${variante}` }, [
      el("span", { class: "categorias-resumen-icono" }, [fabricaIcono()]),
      el("div", { class: "categorias-resumen-texto" }, [
        el("span", { class: "categorias-resumen-numero", text: String(numero) }),
        el("span", { class: "categorias-resumen-etiqueta", text: etiqueta }),
      ]),
    ]);
  }

  function seccionGrupo(tipo, grupo, visibles) {
    const esGasto = tipo === "gasto";
    const n = visibles.length;
    const cabeceraGrupo = el("div", { class: "categorias-grupo-cabecera" }, [
      el("h3", { class: "categorias-grupo-titulo" }, [
        el("span", { class: `categorias-grupo-icono categorias-grupo-icono--${tipo}` }, [
          (esGasto ? flechaAbajoCirculo : flechaArribaCirculo)(),
        ]),
        esGasto ? "Gastos" : "Ingresos",
      ]),
      el("span", {
        class: "categorias-grupo-conteo",
        text: `${n} categoría${n === 1 ? "" : "s"}`,
      }),
    ]);

    const contenido = visibles.length
      ? el("div", { class: "categorias-grid" }, visibles.map((c) => tarjeta(c, grupo)))
      : el("p", { class: "vacio", text: "Sin categorías en este grupo." });

    return el("section", { class: "categorias-grupo" }, [cabeceraGrupo, contenido]);
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
      abrirCategoriaForm({ categoria: c, modoInicial: modo, onGuardado: recargar });

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
        abrirCategoriaForm({ categoria: c, modoInicial: modo, onGuardado: recargar })
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
