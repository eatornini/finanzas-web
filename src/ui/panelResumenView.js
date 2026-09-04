// Panel lateral de la vista Movimientos: resumen del período, gastos por
// categoría (gráfico de dona con CSS) y actividad reciente.
import { el, elSvg, limpiar } from "./dom.js";
import { calcularTotales } from "../logic/totales.js";
import { formatoCLP } from "../logic/dinero.js";
import { prefs } from "../prefs.js";
import { flechaArribaCirculo, flechaAbajoCirculo, billeteraIcono, ojoIcono, ojoTachadoIcono } from "./iconos.js";
import { iconoMovimiento, colorMovimiento } from "./iconosCategoria.js";

const PALETA_DONA = [
  "#c0392b", "#2563a8", "#a56a12", "#6b46c1", "#1b7f4d", "#c2185b", "#00796b",
];

function tituloPeriodo(tipo) {
  if (tipo === "semana") return "Resumen de la semana";
  if (tipo === "año") return "Resumen del año";
  return "Resumen del mes";
}

function valorOculto(valor) {
  return prefs.get("ocultarTotal") ? "*****" : formatoCLP(valor);
}

function filaResumen(icono, claseIcono, etiqueta, valor, claseValor, destacar) {
  return el("div", { class: `resumen-fila${destacar ? " resumen-fila--destacada" : ""}` }, [
    el("span", { class: `resumen-icono ${claseIcono}` }, [icono()]),
    el("span", { class: "resumen-etiqueta", text: etiqueta }),
    el("span", { class: `resumen-valor ${claseValor}`, text: valorOculto(valor) }),
  ]);
}

function tarjetaResumen(titulo, movimientos, onToggleOcultar) {
  const { ingresos, gastos, balance } = calcularTotales(movimientos);
  const oculto = prefs.get("ocultarTotal");
  const btnOjo = el(
    "button",
    {
      class: "boton--icono boton-ojo",
      "aria-label": oculto ? "Mostrar totales" : "Ocultar totales",
      title: oculto ? "Mostrar totales" : "Ocultar totales",
      "aria-pressed": String(oculto),
      onClick: onToggleOcultar,
    },
    [oculto ? ojoTachadoIcono() : ojoIcono()]
  );
  return el("section", { class: "panel-tarjeta" }, [
    el("div", { class: "panel-tarjeta-cabecera" }, [el("h3", { text: titulo }), btnOjo]),
    el("div", { class: "resumen-lista" }, [
      filaResumen(flechaArribaCirculo, "resumen-icono--ingreso", "Ingresos", ingresos, "valor-ingreso"),
      filaResumen(flechaAbajoCirculo, "resumen-icono--gasto", "Gastos", gastos, "valor-gasto"),
      filaResumen(billeteraIcono, "resumen-icono--balance", "Balance", balance, "valor-balance", true),
    ]),
  ]);
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

function tarjetaDona(movimientos, onCategoria) {
  const grupos = agruparPorCategoria(movimientos);
  const total = grupos.reduce((s, g) => s + g.total, 0);
  const oculto = prefs.get("ocultarTotal");

  if (total <= 0) {
    return el("section", { class: "panel-tarjeta" }, [
      el("h3", { text: "Gastos por categoría" }),
      el("p", { class: "vacio", text: "Sin gastos en este período." }),
    ]);
  }

  // Sector resaltado al click/tap (índice en `grupos`, o null = ninguno).
  // Solo cambia el resaltado y el centro de la dona; no navega (a diferencia
  // del click en un ítem de la leyenda, que sigue haciendo drill-down).
  let segmentoActivo = null;
  const colorDe = (i, g) => g.color || PALETA_DONA[i % PALETA_DONA.length];

  const dona = el("div", { class: "dona" });
  const centro = el("div", { class: "dona-centro" });
  const leyenda = el("ul", { class: "dona-leyenda" });

  function alternar(i) {
    segmentoActivo = segmentoActivo === i ? null : i;
    pintar();
  }

  function pintar() {
    limpiar(centro);
    if (segmentoActivo !== null && grupos[segmentoActivo]) {
      const g = grupos[segmentoActivo];
      const pct = Math.round((g.total / total) * 100);
      centro.append(
        el("span", { class: "dona-total", text: oculto ? "*****" : formatoCLP(g.total) }),
        el("span", { class: "dona-etiqueta", text: `${g.nombre} · ${pct}%` })
      );
    } else {
      centro.append(
        el("span", { class: "dona-total", text: oculto ? "*****" : formatoCLP(total) }),
        el("span", { class: "dona-etiqueta", text: "Total" })
      );
    }

    limpiar(dona);
    const grupoSvg = elSvg("g", { transform: "rotate(-90 50 50)" });
    let acumulado = 0;
    grupos.forEach((g, i) => {
      const pct = (g.total / total) * 100;
      const clases = ["dona-segmento"];
      if (segmentoActivo === i) clases.push("dona-segmento--activo");
      else if (segmentoActivo !== null) clases.push("dona-segmento--atenuado");
      grupoSvg.append(
        elSvg("circle", {
          cx: "50",
          cy: "50",
          r: "40",
          "stroke-width": "20",
          fill: "none",
          pathLength: "100",
          "stroke-dasharray": `${pct} ${100 - pct}`,
          "stroke-dashoffset": String(-acumulado),
          stroke: colorDe(i, g),
          class: clases.join(" "),
          tabindex: "0",
          role: "button",
          "aria-label": `${g.nombre}: ${formatoCLP(g.total)} (${Math.round(pct)}%)`,
          onClick: () => alternar(i),
          onKeydown: (ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              alternar(i);
            }
          },
        })
      );
      acumulado += pct;
    });
    dona.append(elSvg("svg", { viewBox: "0 0 100 100", class: "dona-svg" }, [grupoSvg]), centro);

    limpiar(leyenda);
    grupos.slice(0, 5).forEach((g, i) => {
      const pct = Math.round((g.total / total) * 100);
      const punto = el("span", { class: "dona-punto" });
      punto.style.background = colorDe(i, g);
      const boton = el(
        "button",
        {
          class: "dona-item" + (segmentoActivo === i ? " dona-item--activo" : ""),
          type: "button",
          onClick: () => onCategoria && onCategoria(g.categoriaId),
        },
        [
          punto,
          el("span", { class: "dona-nombre", text: g.nombre }),
          el("span", {
            class: "dona-pct",
            text: oculto ? `(${pct}%)` : `${formatoCLP(g.total)} (${pct}%)`,
          }),
        ]
      );
      leyenda.append(el("li", {}, [boton]));
    });
  }

  pintar();

  return el("section", { class: "panel-tarjeta" }, [
    el("h3", { text: "Gastos por categoría" }),
    el("div", { class: "dona-fila" }, [dona, leyenda]),
  ]);
}

function tarjetaActividad(movimientos) {
  const recientes = movimientos.slice(0, 5);
  const lista = el(
    "ul",
    { class: "actividad-lista" },
    recientes.map((m) => {
      const color = colorMovimiento(m);
      const icono = el("span", { class: "actividad-icono" }, [iconoMovimiento(m)]);
      icono.style.color = color;
      icono.style.background = `color-mix(in srgb, ${color} 16%, transparent)`;
      const signo = m.tipo === "ingreso" ? "+" : "−";
      return el("li", {}, [
        icono,
        el("div", { class: "actividad-info" }, [
          el("span", { class: "actividad-nombre", text: m.nombre }),
          el("span", { class: "actividad-fecha", text: (m.fecha || "").slice(0, 10) }),
        ]),
        el("span", {
          class: `actividad-monto ${m.tipo === "ingreso" ? "valor-ingreso" : "valor-gasto"}`,
          text: `${signo}${formatoCLP(m.monto)}`,
        }),
      ]);
    })
  );

  return el("section", { class: "panel-tarjeta" }, [
    el("h3", { text: "Actividad reciente" }),
    recientes.length
      ? lista
      : el("p", { class: "vacio", text: "Sin movimientos recientes." }),
  ]);
}

export function montarPanelResumen(contenedor, movimientosTodos, movimientosParaTotales, { tipo, onCategoria }) {
  limpiar(contenedor);
  function toggleOcultar() {
    prefs.set("ocultarTotal", !prefs.get("ocultarTotal"));
    montarPanelResumen(contenedor, movimientosTodos, movimientosParaTotales, { tipo, onCategoria });
  }
  contenedor.append(
    tarjetaResumen(tituloPeriodo(tipo), movimientosParaTotales, toggleOcultar),
    tarjetaDona(movimientosParaTotales, onCategoria),
    tarjetaActividad(movimientosTodos)
  );
}
