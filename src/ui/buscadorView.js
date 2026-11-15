// Vista Buscar: encuentra movimientos por comercio O por detalle, con
// filtros de tipo, categoría, año/mes o rango de fechas, montos y orden.
import { el, limpiar } from "./dom.js";
import { buscarMovimientos, primeraFechaMovimiento } from "../data/busqueda.js";
import { listarCategorias } from "../data/categorias.js";
import { abrirMovimientoForm } from "./movimientoForm.js";
import { nodoIconoCategoria } from "./iconoCategoria.js";
import { colorMovimiento } from "./iconosCategoria.js";
import { formatoCLP, parseCLP } from "../logic/dinero.js";
import { nombreVisible } from "../logic/presentacion.js";
import {
  textoBusqueda,
  rangoBusqueda,
  aniosDisponibles,
  partesResaltadas,
} from "../logic/busqueda.js";
import { prefs } from "../prefs.js";
import { lupaIcono, embudoIcono, cerrarIcono } from "./iconos.js";
import { tituloVista } from "./tituloVista.js";

const LIMITE = 30;
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const MESES_ABBR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ORDENES = [
  ["recientes", "Más recientes"],
  ["antiguos", "Más antiguos"],
  ["mayor", "Mayor monto"],
  ["menor", "Menor monto"],
];

function fechaLegible(valor) {
  const s = String(valor || "").slice(0, 10);
  const d = new Date(`${s}T12:00:00`);
  if (Number.isNaN(d.getTime())) return s;
  return `${d.getDate()} ${MESES_ABBR[d.getMonth()]} ${d.getFullYear()}`;
}

// Texto con las coincidencias envueltas en <mark>.
function resaltado(texto, consulta, clase) {
  return el(
    "span",
    { class: clase },
    partesResaltadas(texto, consulta).map((p) =>
      p.coincide ? el("mark", { class: "buscar-marca", text: p.texto }) : p.texto
    )
  );
}

export async function montarBuscador(contenedor, { modo }) {
  limpiar(contenedor);

  const filtros = {
    tipo: "",
    categoriaId: "",
    anio: "",
    mes: "",
    desde: "",
    hasta: "",
    montoMin: "",
    montoMax: "",
    orden: "recientes",
  };
  let categorias = [];
  let paginaDesde = 0;
  let cargados = 0;
  let debounce;
  let secuencia = 0;

  const error = el("p", { class: "error", role: "alert" });

  // --- Barra principal: texto + tipo + botón de filtros ---
  const buscador = el("input", {
    class: "buscador",
    type: "search",
    placeholder: "Buscar por comercio, detalle o monto…",
    "aria-label": "Buscar por comercio o detalle",
    autocomplete: "off",
  });
  const botonesTipo = [
    ["", "Todos"],
    ["gasto", "Gastos"],
    ["ingreso", "Ingresos"],
  ].map(([valor, texto]) =>
    el("button", {
      type: "button",
      text: texto,
      onClick: () => {
        filtros.tipo = valor;
        pintarCategorias();
        cambio();
      },
    })
  );
  const selectorTipo = el(
    "div",
    { class: "selector-tipo buscar-tipo", role: "group", "aria-label": "Tipo" },
    botonesTipo
  );
  const contadorFiltros = el("span", { class: "buscar-filtros-contador", hidden: "true" });
  const btnFiltros = el(
    "button",
    {
      type: "button",
      class: "buscar-btn-filtros",
      "aria-expanded": "false",
      "aria-controls": "buscar-panel-filtros",
      onClick: () => setPanel(panel.hidden),
    },
    [embudoIcono(), el("span", { text: "Filtros" }), contadorFiltros]
  );

  // --- Panel de filtros ---
  const selAnio = el("select", { id: "buscar-anio" }, [el("option", { value: "", text: "Todos los años" })]);
  const selMes = el("select", { id: "buscar-mes" }, [
    el("option", { value: "", text: "Todo el año" }),
    ...MESES.map((m, i) => el("option", { value: String(i + 1), text: m })),
  ]);
  const inDesde = el("input", { id: "buscar-desde", type: "date" });
  const inHasta = el("input", { id: "buscar-hasta", type: "date" });
  const selCategoria = el("select", { id: "buscar-categoria" });
  const inMin = el("input", { id: "buscar-min", inputmode: "numeric", placeholder: "$0" });
  const inMax = el("input", { id: "buscar-max", inputmode: "numeric", placeholder: "Sin límite" });
  const selOrden = el(
    "select",
    { id: "buscar-orden" },
    ORDENES.map(([v, t]) => el("option", { value: v, text: t }))
  );

  const campo = (id, etiqueta, control) =>
    el("div", { class: "buscar-campo" }, [el("label", { for: id, text: etiqueta }), control]);

  const btnLimpiar = el("button", {
    type: "button",
    class: "enlace-ver",
    text: "Limpiar filtros",
    onClick: () => limpiarFiltros(),
  });
  const panel = el(
    "div",
    { class: "buscar-panel", id: "buscar-panel-filtros", hidden: "true" },
    [
      el("div", { class: "buscar-panel-grupo" }, [
        el("span", { class: "buscar-panel-titulo", text: "Período" }),
        el("div", { class: "buscar-panel-fila" }, [
          campo("buscar-anio", "Año", selAnio),
          campo("buscar-mes", "Mes", selMes),
        ]),
        el("div", { class: "buscar-panel-fila" }, [
          campo("buscar-desde", "Desde", inDesde),
          campo("buscar-hasta", "Hasta", inHasta),
        ]),
        el("p", { class: "buscar-ayuda", text: "Un rango Desde/Hasta reemplaza al año y mes." }),
      ]),
      el("div", { class: "buscar-panel-grupo" }, [
        el("span", { class: "buscar-panel-titulo", text: "Movimiento" }),
        campo("buscar-categoria", "Categoría", selCategoria),
        el("div", { class: "buscar-panel-fila" }, [
          campo("buscar-min", "Monto mínimo", inMin),
          campo("buscar-max", "Monto máximo", inMax),
        ]),
        campo("buscar-orden", "Ordenar por", selOrden),
      ]),
      el("div", { class: "buscar-panel-pie" }, [btnLimpiar]),
    ]
  );

  const chips = el("div", { class: "buscar-chips" });
  const resumen = el("p", { class: "buscar-resumen", "aria-live": "polite" });
  const lista = el("div", { class: "lista buscar-lista" });
  const btnCargarMas = el("button", {
    class: "buscador-cargar-mas",
    type: "button",
    text: "Cargar más",
    hidden: "true",
    onClick: () => buscar({ continuar: true }),
  });

  contenedor.append(
    tituloVista(
      lupaIcono,
      "Buscar",
      `Encuentra movimientos por comercio o por detalle · modo ${modo === "estimado" ? "Estimado" : "Real"}.`
    ),
    el("section", { class: "panel-tarjeta buscar-barra" }, [
      el("div", { class: "buscar-barra-fila" }, [
        el("div", { class: "campo-busqueda buscar-campo-texto" }, [lupaIcono(), buscador]),
        selectorTipo,
        btnFiltros,
      ]),
      panel,
      chips,
    ]),
    error,
    el("section", { class: "panel-tarjeta buscar-resultados" }, [resumen, lista, btnCargarMas])
  );

  // --- Datos para los selectores ---
  try {
    categorias = (await listarCategorias()).filter((c) => c.modo === modo);
  } catch {
    categorias = []; // se reintenta al abrir el formulario de edición si hace falta
  }
  pintarCategorias();
  try {
    const primera = await primeraFechaMovimiento(modo);
    for (const y of aniosDisponibles(primera)) {
      selAnio.append(el("option", { value: String(y), text: String(y) }));
    }
  } catch {
    for (const y of aniosDisponibles(null)) selAnio.append(el("option", { value: String(y), text: String(y) }));
  }

  function pintarCategorias() {
    const actual = filtros.categoriaId;
    limpiar(selCategoria);
    selCategoria.append(el("option", { value: "", text: "Todas las categorías" }));
    const visibles = categorias
      .filter((c) => !filtros.tipo || c.tipo === filtros.tipo)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    for (const c of visibles) selCategoria.append(el("option", { value: String(c.id), text: c.nombre }));
    selCategoria.append(el("option", { value: "sin", text: "Sin categoría" }));
    const sigue = actual === "sin" || visibles.some((c) => String(c.id) === actual);
    filtros.categoriaId = sigue ? actual : "";
    selCategoria.value = filtros.categoriaId;
  }

  // --- Eventos ---
  buscador.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => buscar(), 250);
  });
  selAnio.addEventListener("change", () => {
    filtros.anio = selAnio.value;
    if (!filtros.anio) filtros.mes = "";
    cambio();
  });
  selMes.addEventListener("change", () => {
    filtros.mes = selMes.value;
    cambio();
  });
  inDesde.addEventListener("change", () => {
    filtros.desde = inDesde.value;
    cambio();
  });
  inHasta.addEventListener("change", () => {
    filtros.hasta = inHasta.value;
    cambio();
  });
  selCategoria.addEventListener("change", () => {
    filtros.categoriaId = selCategoria.value;
    cambio();
  });
  selOrden.addEventListener("change", () => {
    filtros.orden = selOrden.value;
    cambio();
  });
  for (const [input, clave] of [
    [inMin, "montoMin"],
    [inMax, "montoMax"],
  ]) {
    input.addEventListener("input", () => {
      const n = parseCLP(input.value);
      input.value = Number.isFinite(n) ? formatoCLP(n) : "";
      filtros[clave] = Number.isFinite(n) ? String(n) : "";
      clearTimeout(debounce);
      debounce = setTimeout(() => cambio(), 400);
    });
  }

  function setPanel(abierto) {
    panel.hidden = !abierto;
    btnFiltros.setAttribute("aria-expanded", String(abierto));
    btnFiltros.classList.toggle("activo", abierto);
  }

  function limpiarFiltros() {
    Object.assign(filtros, {
      categoriaId: "",
      anio: "",
      mes: "",
      desde: "",
      hasta: "",
      montoMin: "",
      montoMax: "",
      orden: "recientes",
    });
    cambio();
  }

  function cambio() {
    sincronizarControles();
    buscar();
  }

  function sincronizarControles() {
    botonesTipo.forEach((b, i) => {
      const activo = ["", "gasto", "ingreso"][i] === filtros.tipo;
      b.classList.toggle("activo", activo);
      b.setAttribute("aria-pressed", String(activo));
    });
    const hayRango = Boolean(filtros.desde || filtros.hasta);
    selAnio.value = filtros.anio;
    selMes.value = filtros.mes;
    selAnio.disabled = hayRango;
    selMes.disabled = hayRango || !filtros.anio;
    inDesde.value = filtros.desde;
    inHasta.value = filtros.hasta;
    selCategoria.value = filtros.categoriaId;
    selOrden.value = filtros.orden;
    inMin.value = filtros.montoMin ? formatoCLP(Number(filtros.montoMin)) : "";
    inMax.value = filtros.montoMax ? formatoCLP(Number(filtros.montoMax)) : "";
    pintarChips();
  }

  // Chips de los filtros activos (además del tipo), cada uno con su "x".
  function pintarChips() {
    limpiar(chips);
    const activos = [];
    if (filtros.desde || filtros.hasta) {
      const a = filtros.desde ? fechaLegible(filtros.desde) : "el inicio";
      const b = filtros.hasta ? fechaLegible(filtros.hasta) : "hoy";
      activos.push([`${a} – ${b}`, () => Object.assign(filtros, { desde: "", hasta: "" })]);
    } else if (filtros.anio) {
      const txt = filtros.mes ? `${MESES[Number(filtros.mes) - 1]} ${filtros.anio}` : `Año ${filtros.anio}`;
      activos.push([txt, () => Object.assign(filtros, { anio: "", mes: "" })]);
    }
    if (filtros.categoriaId) {
      const c = categorias.find((x) => String(x.id) === filtros.categoriaId);
      activos.push([c ? c.nombre : "Sin categoría", () => (filtros.categoriaId = "")]);
    }
    if (filtros.montoMin) activos.push([`Desde ${formatoCLP(Number(filtros.montoMin))}`, () => (filtros.montoMin = "")]);
    if (filtros.montoMax) activos.push([`Hasta ${formatoCLP(Number(filtros.montoMax))}`, () => (filtros.montoMax = "")]);
    if (filtros.orden !== "recientes") {
      const t = ORDENES.find(([v]) => v === filtros.orden)[1];
      activos.push([t, () => (filtros.orden = "recientes")]);
    }

    contadorFiltros.textContent = String(activos.length);
    contadorFiltros.hidden = activos.length === 0;
    chips.hidden = activos.length === 0;
    for (const [texto, quitar] of activos) {
      chips.append(
        el(
          "button",
          {
            type: "button",
            class: "buscar-chip",
            "aria-label": `Quitar filtro ${texto}`,
            onClick: () => {
              quitar();
              cambio();
            },
          },
          [el("span", { text: texto }), cerrarIcono()]
        )
      );
    }
  }

  function hayFiltro() {
    return (
      Boolean(textoBusqueda(buscador.value)) ||
      Boolean(filtros.tipo || filtros.categoriaId || filtros.anio || filtros.desde || filtros.hasta) ||
      Boolean(filtros.montoMin || filtros.montoMax)
    );
  }

  // Estado inicial: atajos para empezar sin escribir.
  function pintarVacio() {
    limpiar(lista);
    btnCargarMas.hidden = true;
    resumen.textContent = "";
    const hoy = new Date();
    const atajos = [
      [
        `${MESES[hoy.getMonth()]} ${hoy.getFullYear()}`,
        () => Object.assign(filtros, { anio: String(hoy.getFullYear()), mes: String(hoy.getMonth() + 1) }),
      ],
      [`Año ${hoy.getFullYear()}`, () => Object.assign(filtros, { anio: String(hoy.getFullYear()), mes: "" })],
      ["Gastos sobre $50.000", () => Object.assign(filtros, { tipo: "gasto", montoMin: "50000", orden: "mayor" })],
      ["Sin categoría", () => (filtros.categoriaId = "sin")],
    ];
    lista.append(
      el("div", { class: "buscar-vacio" }, [
        el("span", { class: "buscar-vacio-icono" }, [lupaIcono()]),
        el("p", { class: "buscar-vacio-titulo", text: "Escribe un comercio o una palabra del detalle" }),
        el("p", { class: "buscar-vacio-sub", text: "O empieza con un atajo:" }),
        el(
          "div",
          { class: "buscar-atajos" },
          atajos.map(([texto, aplicar]) =>
            el("button", {
              type: "button",
              class: "buscar-atajo",
              text: texto,
              onClick: () => {
                aplicar();
                pintarCategorias();
                cambio();
              },
            })
          )
        ),
      ])
    );
  }

  async function buscar({ continuar = false } = {}) {
    if (!hayFiltro()) {
      paginaDesde = 0;
      cargados = 0;
      pintarVacio();
      return;
    }
    const token = ++secuencia;
    error.textContent = "";
    if (!continuar) {
      paginaDesde = 0;
      cargados = 0;
    }
    btnCargarMas.disabled = true;
    const consulta = buscador.value;
    const rango = rangoBusqueda({
      anio: filtros.anio || null,
      mes: filtros.mes || null,
      desde: filtros.desde || null,
      hasta: filtros.hasta || null,
    });
    try {
      const resultados = await buscarMovimientos({
        modo,
        query: consulta,
        tipo: filtros.tipo || null,
        categoriaId: filtros.categoriaId || null,
        fechaDesde: rango.desde,
        fechaHasta: rango.hasta,
        montoMin: filtros.montoMin ? Number(filtros.montoMin) : null,
        montoMax: filtros.montoMax ? Number(filtros.montoMax) : null,
        orden: filtros.orden,
        desde: paginaDesde,
        limite: LIMITE,
      });
      if (token !== secuencia) return; // llegó una búsqueda más nueva
      const hayMas = resultados.length > LIMITE;
      const pagina = hayMas ? resultados.slice(0, LIMITE) : resultados;

      if (!continuar) limpiar(lista);
      if (!continuar && pagina.length === 0) {
        lista.append(
          el("div", { class: "buscar-vacio" }, [
            el("p", { class: "buscar-vacio-titulo", text: "Ningún movimiento coincide" }),
            el("p", { class: "buscar-vacio-sub", text: "Prueba con otra palabra o quita algún filtro." }),
          ])
        );
      } else {
        for (const m of pagina) lista.append(fila(m, consulta));
      }
      paginaDesde += pagina.length;
      cargados += pagina.length;
      btnCargarMas.hidden = !hayMas;
      resumen.textContent = cargados
        ? `${cargados}${hayMas ? "+" : ""} ${cargados === 1 && !hayMas ? "resultado" : "resultados"}`
        : "";
    } catch (e) {
      if (token !== secuencia) return;
      if (!continuar) limpiar(lista);
      error.textContent = "No se pudo buscar. ";
      error.append(el("button", { text: "Reintentar", onClick: () => buscar({ continuar }) }));
    } finally {
      btnCargarMas.disabled = false;
    }
  }

  function fila(m, consulta) {
    const esIngreso = m.tipo === "ingreso";
    const cat = m.categoria ? m.categoria.nombre : "Sin categoría";
    const color = colorMovimiento(m);
    const inactivo = m.activo === false;
    const oculto = prefs.get("ocultarTotal");

    const icono = el("span", { class: "fila-icono" }, [nodoIconoCategoria(m.categoria, m.nombre)]);
    icono.style.background = `color-mix(in srgb, ${color} 16%, transparent)`;
    icono.style.color = color;

    const abrir = () =>
      abrirMovimientoForm({
        modo,
        categorias,
        movimiento: m,
        onGuardado: () => buscar({ continuar: false }),
      });

    return el(
      "div",
      {
        class: `buscar-fila${inactivo ? " buscar-fila--inactiva" : ""}`,
        role: "button",
        tabindex: "0",
        "aria-label": `Editar ${m.nombre}`,
        onClick: abrir,
        onKeydown: (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            abrir();
          }
        },
      },
      [
        icono,
        el("div", { class: "buscar-fila-texto" }, [
          el("span", { class: "buscar-fila-nombre-linea" }, [
            resaltado(nombreVisible(m.nombre), consulta, "buscar-fila-nombre"),
            inactivo ? el("span", { class: "badge-inactivo", text: "Inactivo" }) : null,
          ]),
          el("span", { class: "buscar-fila-meta", text: `${cat} · ${fechaLegible(m.fecha_local || m.fecha)}` }),
          m.detalle ? resaltado(m.detalle, consulta, "buscar-fila-detalle") : null,
        ]),
        el("span", {
          class: `buscar-fila-monto${esIngreso ? " valor-ingreso" : ""}`,
          text: oculto ? "*****" : `${esIngreso ? "+" : "−"} ${formatoCLP(m.monto)}`,
        }),
      ]
    );
  }

  sincronizarControles();
  pintarVacio();
  buscador.focus();
}
