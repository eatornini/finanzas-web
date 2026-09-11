// Panel lateral de la vista Movimientos: resumen del período, gastos por
// categoría (lista con barras horizontales) y actividad reciente.
import { el, limpiar } from "./dom.js";
import { calcularTotales } from "../logic/totales.js";
import { formatoCLP } from "../logic/dinero.js";
import { prefs } from "../prefs.js";
import {
  flechaArribaCirculo,
  flechaAbajoCirculo,
  billeteraIcono,
  ojoIcono,
  ojoTachadoIcono,
  graficoTortaIcono,
  reloj3Icono,
} from "./iconos.js";
import { iconoSemanticoCategoria } from "./iconosCategoria.js";
import { iconoTitulo } from "./tituloVista.js";
import { etiquetaPeriodo } from "../logic/periodos.js";

const PALETA_DONA = [
  "#c0392b", "#2563a8", "#a56a12", "#6b46c1", "#1b7f4d", "#c2185b", "#00796b",
];

function valorOculto(valor) {
  return prefs.get("ocultarTotal") ? "*****" : formatoCLP(valor);
}

// Tarjeta mini de Ingresos / Gastos (fondo tintado del color, icono, valor).
function miniSaldo(fabricaIcono, clase, etiqueta, valor, claseValor) {
  return el("div", { class: `saldo-mini saldo-mini--${clase}` }, [
    el("span", { class: `saldo-mini-icono saldo-mini-icono--${clase}` }, [fabricaIcono()]),
    el("span", { class: "saldo-mini-etiqueta", text: etiqueta }),
    el("span", { class: `saldo-mini-valor ${claseValor}`, text: valorOculto(valor) }),
  ]);
}

function tarjetaResumen(periodoTexto, movimientos, onToggleOcultar) {
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

  return el("section", { class: "panel-tarjeta tarjeta-saldo" }, [
    el("div", { class: "saldo-cabecera" }, [
      el("span", { class: "saldo-cabecera-icono" }, [billeteraIcono()]),
      el("span", { class: "saldo-cabecera-titulo", text: "Saldo disponible" }),
      el("span", { class: "saldo-cabecera-periodo", text: periodoTexto }),
      btnOjo,
    ]),
    el("div", { class: "saldo-hero" }, [
      el("span", { class: "saldo-hero-icono" }, [billeteraIcono()]),
      el("div", { class: "saldo-hero-txt" }, [
        el("span", { class: "saldo-hero-etiqueta", text: "Saldo disponible" }),
        el("span", {
          class: `saldo-hero-valor ${balance >= 0 ? "valor-balance" : "valor-gasto"}`,
          text: valorOculto(balance),
        }),
        el("span", { class: "saldo-hero-desc", text: "Ingresos – Gastos del período" }),
      ]),
    ]),
    el("div", { class: "saldo-mini-fila" }, [
      miniSaldo(flechaArribaCirculo, "ingreso", "Ingresos", ingresos, "valor-ingreso"),
      miniSaldo(flechaAbajoCirculo, "gasto", "Gastos", gastos, "valor-gasto"),
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

function tarjetaCategorias(movimientos, onCategoria, irA) {
  const grupos = agruparPorCategoria(movimientos);
  const total = grupos.reduce((s, g) => s + g.total, 0);

  const verTodas =
    typeof irA === "function"
      ? el("button", {
          class: "enlace-ver",
          type: "button",
          text: "Ver todas →",
          onClick: () => irA("categorias"),
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

function tarjetaActividad(movimientos) {
  const recientes = movimientos.slice(0, 5);
  const lista = el(
    "ul",
    { class: "actividad-lista" },
    recientes.map((m) => {
      const esIngreso = m.tipo === "ingreso";
      const icono = el(
        "span",
        { class: `actividad-icono actividad-icono--${esIngreso ? "ingreso" : "gasto"}` },
        [esIngreso ? flechaArribaCirculo() : flechaAbajoCirculo()]
      );
      const signo = m.tipo === "ingreso" ? "+" : "−";
      return el("li", {}, [
        icono,
        el("div", { class: "actividad-info" }, [
          el("span", { class: "actividad-nombre", text: m.nombre }),
          el("span", { class: "actividad-categoria", text: m.categoria ? m.categoria.nombre : "Sin categoría" }),
        ]),
        el("span", {
          class: `actividad-monto ${m.tipo === "ingreso" ? "valor-ingreso" : "valor-gasto"}`,
          text: `${signo}${formatoCLP(m.monto)}`,
        }),
      ]);
    })
  );

  return el("section", { class: "panel-tarjeta panel-tarjeta--actividad" }, [
    el("h3", {}, [iconoTitulo(reloj3Icono), "Actividad reciente"]),
    recientes.length
      ? lista
      : el("p", { class: "vacio", text: "Sin movimientos recientes." }),
  ]);
}

export function montarPanelResumen(
  contenedor,
  movimientosTodos,
  movimientosParaTotales,
  { tipo, fechaRef, onCategoria, irA }
) {
  limpiar(contenedor);
  function toggleOcultar() {
    prefs.set("ocultarTotal", !prefs.get("ocultarTotal"));
    montarPanelResumen(contenedor, movimientosTodos, movimientosParaTotales, {
      tipo,
      fechaRef,
      onCategoria,
      irA,
    });
  }
  const periodoTexto = fechaRef ? etiquetaPeriodo(fechaRef, tipo) : "";
  contenedor.append(
    tarjetaResumen(periodoTexto, movimientosParaTotales, toggleOcultar),
    tarjetaCategorias(movimientosParaTotales, onCategoria, irA),
    tarjetaActividad(movimientosTodos)
  );
}
