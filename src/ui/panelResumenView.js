// Vista Movimientos: franja de KPIs arriba (saldo, ingresos, gastos y
// pagos o gasto diario según el modo) y panel lateral con los gastos por
// categoría (lista con barras horizontales).
import { el, limpiar } from "./dom.js";
import { calcularTotales, desglosarPorPago } from "../logic/totales.js";
import { formatoCLP } from "../logic/dinero.js";
import { diasTranscurridos } from "../logic/presentacion.js";
import { prefs } from "../prefs.js";
import { flechaArribaCirculo, flechaAbajoCirculo, graficoTortaIcono, relojIcono, check } from "./iconos.js";
import { iconoSemanticoCategoria } from "./iconosCategoria.js";
import { iconoTitulo } from "./tituloVista.js";

const PALETA_DONA = [
  "#c0392b", "#2563a8", "#a56a12", "#6b46c1", "#1b7f4d", "#c2185b", "#00796b",
];

function valorOculto(valor) {
  return prefs.get("ocultarTotal") ? "*****" : formatoCLP(valor);
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

function kpi({ clase = "", icono = null, etiqueta, extraEtiqueta = null, valor, claseValor = "", hijos = [], desc }) {
  return el("div", { class: `kpi ${clase}`.trim() }, [
    el("span", { class: "kpi-etiqueta" }, [
      icono ? el("span", { class: "kpi-etiqueta-icono" }, [icono()]) : null,
      el("span", { text: etiqueta }),
      extraEtiqueta,
    ]),
    el("span", { class: `kpi-valor ${claseValor}`.trim() }, [].concat(valor)),
    ...hijos,
    desc ? el("span", { class: "kpi-desc", text: desc }) : null,
  ]);
}

function barra(pct, etiquetaAria) {
  const relleno = el("span", { class: "kpi-barra-relleno" });
  relleno.style.width = `${pct}%`;
  return el(
    "span",
    {
      class: "kpi-barra",
      role: "progressbar",
      "aria-valuemin": "0",
      "aria-valuemax": "100",
      "aria-valuenow": String(pct),
      "aria-label": etiquetaAria,
    },
    [relleno]
  );
}

// Cuarta tarjeta del modo Estimado: avance de pagos de los gastos.
function kpiPagos(movimientos) {
  const gastos = movimientos.filter((m) => m.tipo === "gasto");
  const { total, pagado, pendiente } = desglosarPorPago(gastos);
  const nPagados = gastos.filter((m) => m.pagado === true).length;
  const pct = total.gastos > 0 ? Math.round((pagado.gastos / total.gastos) * 100) : 0;
  return kpi({
    clase: "kpi--pagos",
    icono: check,
    etiqueta: "Pagado",
    extraEtiqueta: el("span", { class: "kpi-pct valor-ingreso", text: `${pct}%` }),
    valor: [
      String(nPagados),
      el("span", { class: "kpi-valor-sufijo", text: ` de ${plural(gastos.length, "pago", "pagos")}` }),
    ],
    hijos: [barra(pct, "Porcentaje de gastos pagados")],
    desc: gastos.length
      ? `${valorOculto(pagado.gastos)} pagado · ${valorOculto(pendiente.gastos)} por pagar`
      : "Sin gastos en este período.",
  });
}

// Cuarta tarjeta del modo Real: gasto diario promedio con lo ya registrado.
function kpiGastoDiario(gastos, rango) {
  const dias = rango ? diasTranscurridos(rango) : 0;
  return kpi({
    icono: relojIcono,
    etiqueta: "Gasto diario promedio",
    valor: dias > 0 ? valorOculto(gastos / dias) : "—",
    desc: dias > 0 ? `En ${plural(dias, "día", "días")} del período` : "El período aún no comienza",
  });
}

export function montarKpis(contenedor, movimientos, { modo, rango }) {
  limpiar(contenedor);
  const { ingresos, gastos, balance } = calcularTotales(movimientos);
  const nIng = movimientos.filter((m) => m.tipo === "ingreso").length;
  const nGas = movimientos.filter((m) => m.tipo === "gasto").length;
  contenedor.append(
    kpi({
      clase: "kpi--destacado",
      etiqueta: "Saldo disponible",
      valor: valorOculto(balance),
      claseValor: balance < 0 ? "kpi-valor--negativo" : "",
      desc: "Ingresos − gastos del período",
    }),
    kpi({
      icono: flechaArribaCirculo,
      clase: "kpi--ingreso",
      etiqueta: "Ingresos",
      valor: valorOculto(ingresos),
      desc: plural(nIng, "ingreso", "ingresos"),
    }),
    kpi({
      icono: flechaAbajoCirculo,
      clase: "kpi--gasto",
      etiqueta: "Gastos",
      valor: valorOculto(gastos),
      desc: plural(nGas, "gasto", "gastos"),
    }),
    modo === "estimado" ? kpiPagos(movimientos) : kpiGastoDiario(gastos, rango)
  );
}

function agruparPorCategoria(movimientos) {
  const grupos = new Map();
  for (const m of movimientos) {
    if (m.tipo !== "gasto") continue;
    const clave = m.categoria_id || "sin";
    const nombre = m.categoria ? m.categoria.nombre : "Sin categoría";
    const color = m.categoria && m.categoria.color ? m.categoria.color : null;
    const actual = grupos.get(clave) || { categoriaId: m.categoria_id || null, nombre, color, total: 0 };
    actual.total += Number(m.monto) || 0;
    if (!actual.color && color) actual.color = color;
    grupos.set(clave, actual);
  }
  return [...grupos.values()].sort((a, b) => b.total - a.total);
}

function tarjetaCategorias(movimientos, onCategoria, irA) {
  const grupos = agruparPorCategoria(movimientos);
  const total = grupos.reduce((s, g) => s + g.total, 0);

  const verTodas =
    typeof irA === "function"
      ? el("button", {
          class: "enlace-ver",
          type: "button",
          text: "Ver todas",
          onClick: () => irA("resumen"),
        })
      : null;

  const cabecera = el("div", { class: "resumen-card-head" }, [
    el("div", { class: "resumen-card-head-txt" }, [
      el("h3", {}, [iconoTitulo(graficoTortaIcono), "Gastos por categoría"]),
    ]),
    verTodas,
  ]);

  if (total <= 0) {
    return el("section", { class: "panel-tarjeta" }, [
      cabecera,
      el("p", { class: "vacio", text: "Sin gastos en este período." }),
    ]);
  }

  const colorDe = (i, g) => g.color || PALETA_DONA[i % PALETA_DONA.length];

  const lista = el(
    "ul",
    { class: "cat-barras-lista" },
    grupos.slice(0, 5).map((g, i) => {
      const pct = Math.round((g.total / total) * 100);
      const color = colorDe(i, g);
      // Icono semántico en el color pleno de la categoría (complementa el
      // color, no lo reemplaza); si la categoría no matchea ninguna regla,
      // se muestra un punto de color en su lugar.
      const fabricaIcono = iconoSemanticoCategoria(g.nombre);
      const marcador = el("span", { class: "cat-barras-icono" }, fabricaIcono ? [fabricaIcono()] : []);
      marcador.style.color = color;
      marcador.style.background = fabricaIcono
        ? `color-mix(in srgb, ${color} 16%, transparent)`
        : color;

      const relleno = el("span", { class: "cat-barras-relleno" });
      relleno.style.width = `${pct}%`;
      relleno.style.background = color;

      const boton = el(
        "button",
        { class: "cat-barras-item", type: "button", onClick: () => onCategoria && onCategoria(g.categoriaId) },
        [
          el("div", { class: "cat-barras-fila" }, [
            marcador,
            el("span", { class: "cat-barras-nombre", text: g.nombre }),
            el("span", { class: "cat-barras-monto", text: valorOculto(g.total) }),
            el("span", { class: "cat-barras-pct", text: `${pct}%` }),
          ]),
          el("span", { class: "cat-barras-pista" }, [relleno]),
        ]
      );
      return el("li", {}, [boton]);
    })
  );

  return el("section", { class: "panel-tarjeta" }, [cabecera, lista]);
}

// Panel lateral: solo los gastos por categoría. (Saldo y pagos viven en la
// franja de KPIs; "Actividad reciente" se quitó porque repetía la lista.)
export function montarPanelResumen(contenedor, movimientosParaTotales, { onCategoria, irA }) {
  limpiar(contenedor);
  contenedor.append(tarjetaCategorias(movimientosParaTotales, onCategoria, irA));
}
