// Panel lateral de la vista Movimientos: resumen del mes, gastos por
// categoría (gráfico de dona con CSS) y actividad reciente.
import { el, limpiar } from "./dom.js";
import { calcularTotales } from "../logic/totales.js";
import { flechaArribaCirculo, flechaAbajoCirculo, billeteraIcono } from "./iconos.js";
import { iconoMovimiento, colorMovimiento } from "./iconosCategoria.js";

const PALETA_DONA = [
  "#c0392b", "#2563a8", "#a56a12", "#6b46c1", "#1b7f4d", "#c2185b", "#00796b",
];

function fmt(n) {
  return Number(n).toLocaleString("es", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function fmtCompacto(n) {
  return "$" + Math.round(Number(n)).toLocaleString("es");
}

function tituloPeriodo(tipo) {
  if (tipo === "semana") return "Resumen de la semana";
  if (tipo === "año") return "Resumen del año";
  return "Resumen del mes";
}

function filaResumen(icono, claseIcono, etiqueta, valor, claseValor, destacar) {
  return el("div", { class: `resumen-fila${destacar ? " resumen-fila--destacada" : ""}` }, [
    el("span", { class: `resumen-icono ${claseIcono}` }, [icono()]),
    el("span", { class: "resumen-etiqueta", text: etiqueta }),
    el("span", { class: `resumen-valor ${claseValor}`, text: `$${fmt(valor)}` }),
  ]);
}

function tarjetaResumen(titulo, movimientos) {
  const { ingresos, gastos, balance } = calcularTotales(movimientos);
  return el("section", { class: "panel-tarjeta" }, [
    el("h3", { text: titulo }),
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
    const nombre = m.categoria ? m.categoria.nombre : "Sin categoría";
    const color = m.categoria && m.categoria.color ? m.categoria.color : null;
    const actual = grupos.get(nombre) || { nombre, color, total: 0 };
    actual.total += Number(m.monto) || 0;
    if (!actual.color && color) actual.color = color;
    grupos.set(nombre, actual);
  }
  return [...grupos.values()].sort((a, b) => b.total - a.total);
}

function tarjetaDona(movimientos) {
  const grupos = agruparPorCategoria(movimientos);
  const total = grupos.reduce((s, g) => s + g.total, 0);

  const dona = el("div", { class: "dona" });
  const centro = el("div", { class: "dona-centro" }, [
    el("span", { class: "dona-total", text: total ? fmtCompacto(total) : "$0" }),
    el("span", { class: "dona-etiqueta", text: "Total" }),
  ]);

  if (total > 0) {
    let acc = 0;
    const partes = grupos.map((g, i) => {
      const color = g.color || PALETA_DONA[i % PALETA_DONA.length];
      const desde = (acc / total) * 360;
      acc += g.total;
      const hasta = (acc / total) * 360;
      return `${color} ${desde}deg ${hasta}deg`;
    });
    dona.style.background = `conic-gradient(${partes.join(", ")})`;
  } else {
    dona.style.background = "var(--bg-sutil)";
  }
  dona.append(centro);

  const leyenda = el(
    "ul",
    { class: "dona-leyenda" },
    grupos.slice(0, 5).map((g, i) => {
      const color = g.color || PALETA_DONA[i % PALETA_DONA.length];
      const pct = total ? Math.round((g.total / total) * 100) : 0;
      const punto = el("span", { class: "dona-punto" });
      punto.style.background = color;
      return el("li", {}, [
        punto,
        el("span", { class: "dona-nombre", text: g.nombre }),
        el("span", { class: "dona-pct", text: `$${fmtCompacto(g.total).slice(1)} (${pct}%)` }),
      ]);
    })
  );

  return el("section", { class: "panel-tarjeta" }, [
    el("h3", { text: "Gastos por categoría" }),
    total > 0
      ? el("div", { class: "dona-fila" }, [dona, leyenda])
      : el("p", { class: "vacio", text: "Sin gastos en este período." }),
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
          el("span", { class: "actividad-fecha", text: m.fecha }),
        ]),
        el("span", {
          class: `actividad-monto ${m.tipo === "ingreso" ? "valor-ingreso" : "valor-gasto"}`,
          text: `${signo}$${fmt(m.monto)}`,
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

export function montarPanelResumen(contenedor, movimientos, { tipo }) {
  limpiar(contenedor);
  contenedor.append(
    tarjetaResumen(tituloPeriodo(tipo), movimientos),
    tarjetaDona(movimientos),
    tarjetaActividad(movimientos)
  );
}
