import { el, limpiar } from "./dom.js";
import { buscarMovimientos } from "../data/busqueda.js";
import { listarCategorias } from "../data/categorias.js";
import { abrirMovimientoForm } from "./movimientoForm.js";
import { nodoIconoCategoria } from "./iconoCategoria.js";
import { colorMovimiento } from "./iconosCategoria.js";
import { formatoCLP } from "../logic/dinero.js";
import { lupaIcono } from "./iconos.js";

const LIMITE = 20;

export async function montarBuscador(contenedor, { modo }) {
  limpiar(contenedor);

  const error = el("p", { class: "error", role: "alert" });
  const buscador = el("input", {
    class: "buscador",
    type: "search",
    placeholder: "Buscar por nombre…",
  });
  const selTipo = el("select", {}, [
    el("option", { value: "", text: "Todos los tipos" }),
    el("option", { value: "ingreso", text: "Ingreso" }),
    el("option", { value: "gasto", text: "Gasto" }),
  ]);
  const selCategoria = el("select", {}, [el("option", { value: "", text: "Todas las categorías" })]);
  const lista = el("div", { class: "lista" });
  const btnCargarMas = el("button", {
    class: "buscador-cargar-mas",
    type: "button",
    text: "Cargar más",
    hidden: "true",
    onClick: () => buscar({ continuar: true }),
  });

  contenedor.append(
    el("section", { class: "panel-tarjeta" }, [
      el("div", { class: "buscador-cabecera" }, [
        el("div", { class: "campo-busqueda" }, [lupaIcono(), buscador]),
        selTipo,
        selCategoria,
      ]),
      error,
      lista,
      btnCargarMas,
    ])
  );

  let categorias = [];
  let desde = 0;
  let debounce;

  try {
    categorias = (await listarCategorias()).filter((c) => c.modo === modo);
    for (const c of categorias) {
      selCategoria.append(el("option", { value: c.id, text: c.nombre }));
    }
  } catch (e) {
    // Se reintenta al abrir el formulario de edición si hace falta.
  }

  pintarVacio();

  buscador.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => buscar(), 250);
  });
  selTipo.addEventListener("change", () => buscar());
  selCategoria.addEventListener("change", () => buscar());

  function hayFiltro() {
    return buscador.value.trim().length >= 2 || Boolean(selTipo.value) || Boolean(selCategoria.value);
  }

  function pintarVacio() {
    limpiar(lista);
    btnCargarMas.hidden = true;
    lista.append(el("p", { class: "vacio buscador-vacio", text: "Escribí para buscar o usá los filtros." }));
  }

  async function buscar({ continuar = false } = {}) {
    if (!hayFiltro()) {
      desde = 0;
      pintarVacio();
      return;
    }
    error.textContent = "";
    if (!continuar) {
      desde = 0;
      limpiar(lista);
    }
    btnCargarMas.disabled = true;
    try {
      const texto = buscador.value.trim();
      const resultados = await buscarMovimientos({
        modo,
        query: texto.length >= 2 ? texto : null,
        tipo: selTipo.value || null,
        categoriaId: selCategoria.value || null,
        desde,
        limite: LIMITE,
      });
      const hayMas = resultados.length > LIMITE;
      const pagina = hayMas ? resultados.slice(0, LIMITE) : resultados;

      if (!continuar && pagina.length === 0) {
        limpiar(lista);
        lista.append(el("p", { class: "vacio", text: "Ningún movimiento coincide con la búsqueda." }));
      } else {
        for (const m of pagina) lista.append(fila(m));
      }
      desde += pagina.length;
      btnCargarMas.hidden = !hayMas;
    } catch (e) {
      limpiar(lista);
      error.textContent = "No se pudo buscar. ";
      error.append(el("button", { text: "Reintentar", onClick: () => buscar({ continuar }) }));
    } finally {
      btnCargarMas.disabled = false;
    }
  }

  function fila(m) {
    const signo = m.tipo === "ingreso" ? "+" : "−";
    const cat = m.categoria ? m.categoria.nombre : "Sin categoría";
    const color = colorMovimiento(m);
    const inactivo = m.activo === false;

    const iconoFila = el("span", { class: "fila-icono" }, [nodoIconoCategoria(m.categoria, m.nombre)]);
    iconoFila.style.color = color;
    iconoFila.style.background = `color-mix(in srgb, ${color} 16%, transparent)`;

    return el(
      "button",
      {
        class: `fila fila--resultado tipo-${m.tipo}` + (inactivo ? " fila--inactiva" : ""),
        type: "button",
        onClick: () =>
          abrirMovimientoForm({
            modo,
            categorias,
            movimiento: m,
            onGuardado: () => buscar({ continuar: false }),
          }),
      },
      [
        iconoFila,
        el("div", { class: "fila-principal" }, [
          el("span", { class: "nombre", text: m.nombre }),
          el("span", { class: "fila-meta" }, [
            el("span", { class: "cat", text: cat }),
            el("span", { class: "fecha", text: (m.fecha || "").slice(0, 10) }),
          ]),
        ]),
        el("span", { class: "monto", text: `${signo} ${formatoCLP(m.monto)}` }),
      ]
    );
  }
}
