import { el, elSvg, limpiar } from "./dom.js";
import { listarMovimientos } from "../data/movimientos.js";
import {
  calcularTotales,
  desglosarPorPago,
  filtrarParaCalculos,
} from "../logic/totales.js";
import { formatoCLP } from "../logic/dinero.js";
import { prefs } from "../prefs.js";
import {
  tendenciaCombinadaIcono,
  graficoIcono,
  graficoTortaIcono,
  reloj3Icono,
  bombillaIcono,
  calendarioIcono,
  flechaArribaCirculo,
  flechaAbajoCirculo,
  billeteraIcono,
} from "./iconos.js";
import { tituloVista, iconoTitulo } from "./tituloVista.js";
import { nodoIconoCategoria } from "./iconoCategoria.js";
import { colorMovimiento } from "./iconosCategoria.js";
import { rangoPeriodo, etiquetaPeriodo } from "../logic/periodos.js";

const MESES_ABBR = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];
// Paleta de respaldo para el donut cuando una categoría no define color.
const PALETA_DONA = [
  "#1b7f4d", "#0966DF", "#e0a44a", "#c0392b", "#6b46c1", "#c2185b", "#00796b", "#8a8f98",
];

function valorOculto(valor) {
  return prefs.get("ocultarTotal") ? "*****" : formatoCLP(valor);
}

// "esta semana" / "este mes" / "este año" (para el subtítulo del encabezado).
function sufijoPeriodo(tipo) {
  if (tipo === "semana") return "esta semana";
  if (tipo === "año") return "este año";
  return "este mes";
}

// "de la semana" / "del mes" / "del año" (para descripciones y el consejo).
function delPeriodo(tipo) {
  if (tipo === "semana") return "de la semana";
  if (tipo === "año") return "del año";
  return "del mes";
}

// "8 sep 2026" a partir de "YYYY-MM-DD" (o timestamp, se recorta).
function fechaCorta(valor) {
  const s = String(valor || "").slice(0, 10);
  const d = new Date(`${s}T12:00:00`);
  if (Number.isNaN(d.getTime())) return s;
  return `${d.getDate()} ${MESES_ABBR[d.getMonth()]} ${d.getFullYear()}`;
}

// Porcentaje con un decimal y coma: "20,5%".
function formatoPct(n) {
  return `${n.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

// --- Piezas de UI -----------------------------------------------------------

function bloqueEncabezado(tipo, acciones) {
  return el("header", { class: "resumen-header" }, [
    tituloVista(
      tendenciaCombinadaIcono,
      "Resumen",
      `Una visión general de tus finanzas ${sufijoPeriodo(tipo)}.`
    ),
    el("div", { class: "resumen-header-lado" }, [acciones]),
  ]);
}

function metricaTarjeta(fabricaIcono, claseIcono, nombre, valor, claseValor, desc) {
  return el("div", { class: "metrica-tarjeta" }, [
    el("span", { class: `metrica-icono metrica-icono--${claseIcono}` }, [fabricaIcono()]),
    el("div", { class: "metrica-cuerpo" }, [
      el("span", { class: "metrica-nombre", text: nombre }),
      el("span", { class: `metrica-valor ${claseValor}`, text: valorOculto(valor) }),
      el("span", { class: "metrica-desc", text: desc }),
    ]),
  ]);
}

function desgloseItem(nombre, t) {
  return el("div", { class: "resumen-desglose-item" }, [
    el("span", { class: "resumen-desglose-nombre", text: nombre }),
    el("span", { class: "resumen-desglose-val", text: valorOculto(t.balance) }),
    el("span", {
      class: "resumen-desglose-detalle",
      text: `${valorOculto(t.ingresos)} ingresos · ${valorOculto(t.gastos)} gastos`,
    }),
  ]);
}

export function tarjetaHead(fabricaIcono, titulo, sub, extra) {
  return el("div", { class: "resumen-card-head" }, [
    el("div", { class: "resumen-card-head-txt" }, [
      el("h3", {}, [iconoTitulo(fabricaIcono), titulo]),
      sub ? el("p", { class: "resumen-card-sub", text: sub }) : null,
    ]),
    extra || null,
  ]);
}

const MESES_LARGO = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const GRANULARIDADES_VS = [
  { clave: "dia", etiqueta: "Día" },
  { clave: "semana", etiqueta: "Semana" },
  { clave: "mes", etiqueta: "Mes" },
];

const COMPACTO_CLP = new Intl.NumberFormat("es-CL", { notation: "compact", maximumFractionDigits: 1 });

function valorEjeOculto(valor) {
  return prefs.get("ocultarTotal") ? "•••" : `$${COMPACTO_CLP.format(valor)}`;
}

// Todos los días (YYYY-MM-DD, zona local) entre desde y hasta, inclusive.
function diasDelRango(desde, hasta) {
  const fin = new Date(`${hasta}T12:00:00`);
  const dias = [];
  let cursor = new Date(`${desde}T12:00:00`);
  while (cursor <= fin) {
    dias.push(ymdLocal(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
  }
  return dias;
}

// Tramos de mes calendario dentro de un rango arbitrario (análogo a
// semanasDelMes pero por mes — sirve tanto para un rango de un mes, como
// para un año completo al agrupar por "Mes").
function mesesDelRango(desde, hasta) {
  const inicio = new Date(`${desde}T12:00:00`);
  const fin = new Date(`${hasta}T12:00:00`);
  const meses = [];
  let cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  while (cursor <= fin) {
    const finMes = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const desdeTramo = cursor < inicio ? ymdLocal(inicio) : ymdLocal(cursor);
    const hastaTramo = finMes > fin ? ymdLocal(fin) : ymdLocal(finMes);
    meses.push({ desde: desdeTramo, hasta: hastaTramo });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return meses;
}

function tituloDia(fecha) {
  const d = new Date(`${fecha}T12:00:00`);
  return `${d.getDate()} de ${MESES_LARGO[d.getMonth()]} de ${d.getFullYear()}`;
}

function tituloSemana(desde, hasta) {
  const a = new Date(`${desde}T12:00:00`);
  const b = new Date(`${hasta}T12:00:00`);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `${a.getDate()} al ${b.getDate()} de ${MESES_LARGO[b.getMonth()]} de ${b.getFullYear()}`;
  }
  return `${a.getDate()} ${MESES_ABBR[a.getMonth()]} – ${b.getDate()} ${MESES_ABBR[b.getMonth()]} ${b.getFullYear()}`;
}

function tituloMes(desde) {
  const d = new Date(`${desde}T12:00:00`);
  const nombre = MESES_LARGO[d.getMonth()];
  return `${nombre[0].toUpperCase()}${nombre.slice(1)} de ${d.getFullYear()}`;
}

// Serie diaria real: un punto por cada día del rango (incluidos los días sin
// movimientos, en 0) a partir de los montos reales agrupados por fecha_local.
function serieVsPorDia(movimientos, rango) {
  const porFecha = new Map();
  for (const m of movimientos) {
    const clave = String(m.fecha_local || m.fecha || "").slice(0, 10);
    const g = porFecha.get(clave) || { ingresos: 0, gastos: 0, cantidad: 0 };
    if (m.tipo === "ingreso") g.ingresos += Number(m.monto) || 0;
    else if (m.tipo === "gasto") g.gastos += Number(m.monto) || 0;
    g.cantidad += 1;
    porFecha.set(clave, g);
  }
  return diasDelRango(rango.desde, rango.hasta).map((fecha) => {
    const g = porFecha.get(fecha) || { ingresos: 0, gastos: 0, cantidad: 0 };
    const d = new Date(`${fecha}T12:00:00`);
    return {
      clave: fecha,
      etiquetaEje: `${d.getDate()} ${MESES_ABBR[d.getMonth()]}`,
      titulo: tituloDia(fecha),
      ...g,
    };
  });
}

// Serie agrupada en tramos (semanas o meses) — suma los movimientos reales
// que caen dentro de cada tramo [desde, hasta].
function serieVsPorTramos(movimientos, tramos, etiquetaFn, tituloFn) {
  const filas = tramos.map((t) => ({ ...t, ingresos: 0, gastos: 0, cantidad: 0 }));
  for (const m of movimientos) {
    const fecha = String(m.fecha_local || m.fecha || "").slice(0, 10);
    const fila = filas.find((f) => fecha >= f.desde && fecha <= f.hasta);
    if (!fila) continue;
    if (m.tipo === "ingreso") fila.ingresos += Number(m.monto) || 0;
    else if (m.tipo === "gasto") fila.gastos += Number(m.monto) || 0;
    fila.cantidad += 1;
  }
  return filas.map((f) => ({
    clave: f.desde,
    etiquetaEje: etiquetaFn(f),
    titulo: tituloFn(f),
    ingresos: f.ingresos,
    gastos: f.gastos,
    cantidad: f.cantidad,
  }));
}

// Construye la serie real de ingresos/gastos según la granularidad elegida
// — nunca inventa puntos: cada valor sale de sumar movimientos reales del
// período dentro del tramo correspondiente.
function serieVs(movimientos, rango, granularidad) {
  if (granularidad === "semana") {
    return serieVsPorTramos(movimientos, semanasDelMes(rango.desde, rango.hasta), etiquetaSemana, (f) =>
      tituloSemana(f.desde, f.hasta)
    );
  }
  if (granularidad === "mes") {
    return serieVsPorTramos(
      movimientos,
      mesesDelRango(rango.desde, rango.hasta),
      (f) => tituloMes(f.desde),
      (f) => tituloMes(f.desde)
    );
  }
  return serieVsPorDia(movimientos, rango);
}

function puntoLeyendaVs(clase, texto) {
  return el("li", { class: "vsgrafico-leyenda-item" }, [
    el("span", { class: `vsgrafico-punto vsgrafico-punto--${clase}` }),
    texto,
  ]);
}

function indicadorVs(clase, nombre, valor, desc, claseValor) {
  return el("div", { class: "vsgrafico-resumen-item" }, [
    el("span", { class: `vsgrafico-punto vsgrafico-punto--${clase}` }),
    el("div", { class: "vsgrafico-resumen-txt" }, [
      el("span", { class: "vsgrafico-resumen-nombre", text: nombre }),
      el("span", { class: `vsgrafico-resumen-valor ${claseValor || ""}`.trim(), text: valorOculto(valor) }),
      el("span", { class: "vsgrafico-resumen-desc", text: desc }),
    ]),
  ]);
}

// SVG de líneas (sin librerías externas, mismo enfoque que el resto de
// gráficos de la app): dos polylines (ingresos/gastos) sobre una grilla
// sutil, con zonas invisibles por punto para el tooltip al pasar el mouse.
function graficoVsLineas(puntos) {
  // En escritorio el viewBox es ancho y bajo (ANCHO grande): el gráfico se
  // ve compacto porque todo (fuente, grosor de línea, radio de puntos) se
  // escala según el ancho real del contenedor / ANCHO. En un celular esa
  // misma relación deja el ancho real MUY chico (~300-360px), así que ese
  // mismo factor de escala achica el texto y las líneas hasta ser
  // ilegibles — no alcanza con hacer el viewBox "más alto" nada más. Por
  // eso en móvil se usa un ANCHO de viewBox más chico (sube el factor de
  // escala = todo se ve más grande en píxeles reales) Y un ALTO
  // proporcionalmente mucho mayor (más alto que ancho = más espacio
  // vertical para las variaciones).
  const movil = window.matchMedia("(max-width: 720px)").matches;
  const ANCHO = movil ? 300 : 600;
  const ALTO = movil ? 220 : 160;
  const M_IZQ = movil ? 40 : 46;
  const M_DER = movil ? 8 : 10;
  const M_TOP = movil ? 10 : 14;
  const M_INF = movil ? 22 : 26;
  const radioMarca = movil ? 3.2 : 2.6;
  const anchoTrazo = ANCHO - M_IZQ - M_DER;
  const altoTrazo = ALTO - M_TOP - M_INF;
  const n = puntos.length;
  // El balance acumulado puede ser negativo (gastos > ingresos), a
  // diferencia de ingresos/gastos que nunca bajan de 0 — por eso el
  // dominio del eje Y arranca en el mínimo real (puede ser < 0) en vez de
  // asumir siempre 0 como piso.
  const valores = puntos.flatMap((p) => [p.ingresos, p.gastos, p.balanceAcumulado]);
  const maxValor = Math.max(1, ...valores);
  const minValor = Math.min(0, ...valores);
  const rangoValores = maxValor - minValor || 1;
  const hayNegativos = minValor < 0;

  const x = (i) => (n > 1 ? M_IZQ + (i / (n - 1)) * anchoTrazo : M_IZQ + anchoTrazo / 2);
  const y = (v) => M_TOP + altoTrazo - ((v - minValor) / rangoValores) * altoTrazo;

  // Grilla horizontal muy sutil: piso, mitad y techo del dominio real
  // (no siempre 0-máximo: si hay balance negativo el piso baja de 0).
  const nodosGrilla = [0, 0.5, 1].flatMap((frac) => {
    const valor = minValor + rangoValores * frac;
    const cy = M_TOP + altoTrazo * (1 - frac);
    return [
      elSvg("line", { x1: M_IZQ, y1: cy, x2: ANCHO - M_DER, y2: cy, class: "vsgrafico-grid" }),
      elSvg("text", { x: M_IZQ - 6, y: cy + 3, class: "vsgrafico-eje-valor" }, [valorEjeOculto(valor)]),
    ];
  });

  // Referencia visual explícita en $0: solo hace falta dibujarla aparte
  // cuando cae DENTRO del gráfico y no coincide ya con la grilla (piso o
  // techo) — o sea, cuando hay tramo negativo y otro positivo.
  const nodoCero =
    hayNegativos && maxValor > 0
      ? elSvg("line", {
          x1: M_IZQ,
          y1: y(0),
          x2: ANCHO - M_DER,
          y2: y(0),
          class: "vsgrafico-cero",
        })
      : null;

  // Etiquetas del eje X: un subconjunto para no recargar el gráfico.
  const maxEtiquetas = movil ? 4 : 7;
  const indicesEtiquetas = new Set();
  if (n <= maxEtiquetas) {
    for (let i = 0; i < n; i++) indicesEtiquetas.add(i);
  } else {
    const paso = (n - 1) / (maxEtiquetas - 1);
    for (let k = 0; k < maxEtiquetas; k++) indicesEtiquetas.add(Math.round(k * paso));
  }
  const nodosEjeX = [...indicesEtiquetas].map((i) =>
    elSvg("text", { x: x(i), y: ALTO - 8, class: "vsgrafico-eje-etiqueta" }, [puntos[i].etiquetaEje])
  );

  const puntosIngreso = puntos.map((p, i) => `${x(i).toFixed(1)},${y(p.ingresos).toFixed(1)}`).join(" ");
  const puntosGasto = puntos.map((p, i) => `${x(i).toFixed(1)},${y(p.gastos).toFixed(1)}`).join(" ");
  const puntosBalance = puntos
    .map((p, i) => `${x(i).toFixed(1)},${y(p.balanceAcumulado).toFixed(1)}`)
    .join(" ");

  const nodosMarcas = puntos.flatMap((p, i) => [
    p.ingresos > 0
      ? elSvg("circle", {
          cx: x(i),
          cy: y(p.ingresos),
          r: radioMarca,
          class: "vsgrafico-marca vsgrafico-marca--ingreso",
        })
      : null,
    p.gastos > 0
      ? elSvg("circle", {
          cx: x(i),
          cy: y(p.gastos),
          r: radioMarca,
          class: "vsgrafico-marca vsgrafico-marca--gasto",
        })
      : null,
    // El balance sí se marca en 0: a diferencia de ingresos/gastos, un
    // balance en cero es información real (ingresos == gastos), no
    // ausencia de dato.
    elSvg("circle", {
      cx: x(i),
      cy: y(p.balanceAcumulado),
      r: radioMarca,
      class: "vsgrafico-marca vsgrafico-marca--balance",
    }),
  ]);

  const guia = elSvg("line", { x1: 0, y1: M_TOP, x2: 0, y2: M_TOP + altoTrazo, class: "vsgrafico-guia" });

  const tooltip = el("div", { class: "vsgrafico-tooltip", role: "tooltip" });

  function mostrarTooltip(i) {
    const p = puntos[i];
    const cx = x(i);
    guia.setAttribute("x1", cx);
    guia.setAttribute("x2", cx);
    guia.classList.add("vsgrafico-guia--activa");

    limpiar(tooltip);
    tooltip.append(
      el("p", { class: "vsgrafico-tooltip-titulo", text: p.titulo }),
      el("div", { class: "vsgrafico-tooltip-fila" }, [
        el("span", { class: "vsgrafico-punto vsgrafico-punto--ingreso" }),
        el("span", { text: "Ingresos" }),
        el("span", { class: "vsgrafico-tooltip-valor", text: valorOculto(p.ingresos) }),
      ]),
      el("div", { class: "vsgrafico-tooltip-fila" }, [
        el("span", { class: "vsgrafico-punto vsgrafico-punto--gasto" }),
        el("span", { text: "Gastos" }),
        el("span", { class: "vsgrafico-tooltip-valor", text: valorOculto(p.gastos) }),
      ]),
      el("div", { class: "vsgrafico-tooltip-fila" }, [
        el("span", { class: "vsgrafico-punto vsgrafico-punto--balance" }),
        el("span", { text: "Balance" }),
        el("span", { class: "vsgrafico-tooltip-valor", text: valorOculto(p.balanceAcumulado) }),
      ])
    );

    const pct = (cx / ANCHO) * 100;
    tooltip.style.left = `${pct}%`;
    tooltip.style.transform = pct < 15 ? "translateX(0)" : pct > 85 ? "translateX(-100%)" : "translateX(-50%)";
    tooltip.classList.add("vsgrafico-tooltip--visible");
  }

  function ocultarTooltip() {
    guia.classList.remove("vsgrafico-guia--activa");
    tooltip.classList.remove("vsgrafico-tooltip--visible");
  }

  const nodosZonas = puntos.map((p, i) => {
    const paso = n > 1 ? anchoTrazo / (n - 1) : anchoTrazo;
    return elSvg("rect", {
      x: x(i) - paso / 2,
      y: M_TOP,
      width: paso,
      height: altoTrazo,
      class: "vsgrafico-zona",
      onMouseenter: () => mostrarTooltip(i),
      onMouseleave: ocultarTooltip,
      onClick: () => mostrarTooltip(i),
    });
  });

  const svg = elSvg("svg", { viewBox: `0 0 ${ANCHO} ${ALTO}`, class: "vsgrafico-svg" }, [
    ...nodosGrilla,
    nodoCero,
    elSvg("polyline", { points: puntosIngreso, class: "vsgrafico-linea vsgrafico-linea--ingreso" }),
    elSvg("polyline", { points: puntosGasto, class: "vsgrafico-linea vsgrafico-linea--gasto" }),
    elSvg("polyline", { points: puntosBalance, class: "vsgrafico-linea vsgrafico-linea--balance" }),
    ...nodosMarcas,
    guia,
    ...nodosEjeX,
    ...nodosZonas,
  ]);

  return el("div", { class: "vsgrafico-lienzo", onMouseleave: ocultarTooltip }, [svg, tooltip]);
}

function seccionIngresoGasto(movimientos, rango, granularidad, totales, enPeriodo, tipo, titulo, onCambiarGranularidad) {
  const { ingresos, gastos, balance } = totales;

  const selector = el(
    "div",
    { class: "selector-tipo vsgrafico-selector" },
    GRANULARIDADES_VS.map((g) =>
      el("button", {
        class: g.clave === granularidad ? "activo" : "",
        text: g.etiqueta,
        onClick: () => onCambiarGranularidad(g.clave),
      })
    )
  );

  const resumen = el("div", { class: "vsgrafico-resumen" }, [
    indicadorVs("ingreso", "Ingresos", ingresos, `Total ${delPeriodo(tipo)}`, "valor-ingreso"),
    indicadorVs("gasto", "Gastos", gastos, `Total ${delPeriodo(tipo)}`, "valor-gasto"),
    // A diferencia de la tarjeta superior (que pinta el balance en rojo si
    // es negativo), aquí se mantiene siempre azul: la negatividad ya se
    // comunica con el signo del número y la posición bajo la línea $0.
    indicadorVs("balance", "Balance", balance, "Ingresos - Gastos", "valor-balance"),
  ]);

  // El balance de cada punto es ACUMULADO (ingresos y gastos sumados desde
  // el inicio del período hasta ese punto) — no el balance del tramo
  // individual. Así el último punto siempre coincide con `balance`, que
  // viene de calcularTotales() sobre el mismo conjunto de movimientos: una
  // sola fuente de verdad para el gráfico y para la tarjeta superior.
  const puntos = serieVs(movimientos, rango, granularidad);
  let acumIngresos = 0;
  let acumGastos = 0;
  for (const p of puntos) {
    acumIngresos += p.ingresos;
    acumGastos += p.gastos;
    p.balanceAcumulado = acumIngresos - acumGastos;
  }
  const hayDatos = puntos.some((p) => p.ingresos > 0 || p.gastos > 0);

  const cuerpo = el("div", { class: "vsgrafico-cuerpo" }, [
    resumen,
    hayDatos
      ? graficoVsLineas(puntos)
      : el("p", { class: "vacio", text: "Sin movimientos en este período." }),
    hayDatos
      ? el("ul", { class: "vsgrafico-leyenda" }, [
          puntoLeyendaVs("ingreso", "Ingresos"),
          puntoLeyendaVs("gasto", "Gastos"),
          puntoLeyendaVs("balance", "Balance"),
        ])
      : null,
  ]);

  return el("section", { class: "panel-tarjeta resumen-vs" }, [
    tarjetaHead(graficoIcono, titulo, `Evolución de tus ingresos y gastos en ${enPeriodo}.`, selector),
    cuerpo,
  ]);
}

function ymdLocal(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Semanas de calendario (lunes a domingo) dentro del rango del mes, tal
// como se ven las filas de un calendario mensual: la primera y la última
// quedan recortadas si el mes no empieza en lunes ni termina en domingo.
export function semanasDelMes(desde, hasta) {
  const fin = new Date(`${hasta}T12:00:00`);
  const semanas = [];
  let cursor = new Date(`${desde}T12:00:00`);
  while (cursor <= fin) {
    const dow = (cursor.getDay() + 6) % 7; // 0 = lunes
    const finSemana = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + (6 - dow));
    const finTramo = finSemana < fin ? finSemana : fin;
    semanas.push({ desde: ymdLocal(cursor), hasta: ymdLocal(finTramo), total: 0 });
    cursor = new Date(finTramo.getFullYear(), finTramo.getMonth(), finTramo.getDate() + 1);
  }
  return semanas;
}

export function etiquetaSemana(semana) {
  const a = new Date(`${semana.desde}T12:00:00`);
  const b = new Date(`${semana.hasta}T12:00:00`);
  const mes = MESES_ABBR[b.getMonth()];
  return a.getDate() === b.getDate() ? `${a.getDate()} ${mes}` : `${a.getDate()}–${b.getDate()} ${mes}`;
}

// Agrupa los gastos del mes por semana de calendario (lunes a domingo).
export function agruparGastosPorSemana(movimientos, rango) {
  const semanas = semanasDelMes(rango.desde, rango.hasta);
  for (const m of movimientos) {
    if (m.tipo !== "gasto") continue;
    const fecha = String(m.fecha_local || m.fecha).slice(0, 10);
    const semana = semanas.find((s) => fecha >= s.desde && fecha <= s.hasta);
    if (semana) semana.total += Number(m.monto) || 0;
  }
  return semanas;
}

// "futura": todavía no empieza (sin datos, no cuenta para mayor/menor).
// "en_curso": hoy cae dentro de la semana (gasto acumulado a la fecha).
// "pasada": semana ya terminada, con datos definitivos.
export function estadoSemana(semana, hoy) {
  if (hoy < semana.desde) return "futura";
  if (hoy <= semana.hasta) return "en_curso";
  return "pasada";
}

// Solo tiene sentido cuando el período mostrado es un mes calendario
// completo (varias semanas) — en vista semana o año no hay nada que agrupar.
function seccionGastosSemana(movimientos, rango, enPeriodo) {
  const hoy = ymdLocal(new Date());
  const semanas = agruparGastosPorSemana(movimientos, rango).map((s) => ({
    ...s,
    estado: estadoSemana(s, hoy),
  }));
  const sub = `Distribución de tus gastos durante ${enPeriodo}.`;
  const cabecera = tarjetaHead(calendarioIcono, "Gastos por semana", sub);

  // Solo semanas ya empezadas (en curso o pasadas) cuentan como "con datos":
  // una semana futura no tiene gasto real que mostrar, solo ausencia de dato.
  const conDatos = semanas.filter((s) => s.estado !== "futura");
  const totalMes = conDatos.reduce((sum, s) => sum + s.total, 0);

  if (conDatos.length === 0 || totalMes <= 0) {
    return el("section", { class: "panel-tarjeta resumen-semanas" }, [
      cabecera,
      el("p", { class: "vacio", text: "Sin gastos en este período." }),
    ]);
  }

  // Solo semanas YA TERMINADAS compiten por "Mayor gasto": una semana en
  // curso todavía puede sumar más antes de terminar, así que su total no es
  // definitivo. Pasa a ser candidata recién en el render donde ya cruzó su
  // domingo (estadoSemana la reclasifica sola, sin nada hardcodeado).
  const pasadas = conDatos.filter((s) => s.estado === "pasada");
  const maxTotalPasadas = pasadas.length ? Math.max(...pasadas.map((s) => s.total)) : null;
  const mayor = maxTotalPasadas !== null ? pasadas.find((s) => s.total === maxTotalPasadas) : null;
  const enCurso = semanas.find((s) => s.estado === "en_curso") || null;

  // El ancho de las barras sigue escalando contra la semana con más gasto
  // entre TODAS las que tienen datos (incluida la en curso) — es solo
  // proporción visual entre filas, no decide el título "Mayor gasto".
  const maxTotal = Math.max(...conDatos.map((s) => s.total));

  // Semanas sin ningún gasto (futuras siempre, o pasadas/en curso donde
  // simplemente no se gastó nada) no aportan información — se omiten de la
  // lista en vez de mostrar una fila vacía o "Aún no disponible".
  const filas = semanas
    .filter((s) => s.total > 0)
    .map((s) => {
      const etiquetaNodo = el("span", { class: "resumen-semanas-rango", text: etiquetaSemana(s) });
      const esPico = s === mayor;
      const anchoBarra = Math.max((s.total / maxTotal) * 100, 4);
      const relleno = el("span", {
        class: `resumen-semanas-barra-relleno${esPico ? " resumen-semanas-barra-relleno--pico" : ""}`,
      });
      relleno.style.width = `${anchoBarra}%`;
      const pct = totalMes > 0 ? Math.round((s.total / totalMes) * 100) : 0;

      return el(
        "div",
        { class: `resumen-semanas-fila${esPico ? " resumen-semanas-fila--pico" : ""}` },
        [
          etiquetaNodo,
          el("div", { class: "resumen-semanas-barra-pista" }, [relleno]),
          el("span", { class: "resumen-semanas-monto", text: valorOculto(s.total) }),
          s.estado === "en_curso"
            ? el("span", { class: "resumen-semanas-pct resumen-semanas-pct--curso", text: "En curso" })
            : el("span", { class: "resumen-semanas-pct", text: `${pct}%` }),
        ]
      );
    });

  const destacadas = el(
    "div",
    { class: "resumen-semanas-destacadas" },
    [
      mayor
        ? el("span", { class: "resumen-semanas-destacada" }, [
            el("span", { class: "resumen-semanas-destacada-etq", text: "Mayor gasto" }),
            `: ${etiquetaSemana(mayor)} · ${valorOculto(mayor.total)}`,
          ])
        : null,
      enCurso
        ? el("span", { class: "resumen-semanas-destacada" }, [
            el("span", { class: "resumen-semanas-destacada-etq", text: "Semana en curso" }),
            `: ${etiquetaSemana(enCurso)} · ${valorOculto(enCurso.total)}`,
          ])
        : null,
    ]
  );

  return el("section", { class: "panel-tarjeta resumen-semanas" }, [
    cabecera,
    el("div", { class: "resumen-semanas-lista" }, filas),
    mayor || enCurso ? destacadas : null,
  ]);
}

// Agrupa los gastos del período por categoría, mayor a menor.
function agruparGastos(movimientos) {
  const idx = new Map();
  for (const m of movimientos) {
    if (m.tipo !== "gasto") continue;
    const clave = m.categoria_id || "sin";
    const g =
      idx.get(clave) ||
      {
        clave,
        nombre: m.categoria ? m.categoria.nombre : "Sin categoría",
        categoria: m.categoria || null,
        color: (m.categoria && m.categoria.color) || null,
        total: 0,
        cantidad: 0,
      };
    g.total += Number(m.monto) || 0;
    g.cantidad += 1;
    if (!g.color && m.categoria && m.categoria.color) g.color = m.categoria.color;
    idx.set(clave, g);
  }
  return [...idx.values()].sort((a, b) => b.total - a.total);
}

// `referencias`: Map clave -> { li, grupo } (ya poblado por la lista) — acá
// se completa con el segmento SVG de cada categoría. `activar`/`desactivar`
// sincronizan lista y dona: se llaman desde el hover de CUALQUIERA de los
// dos lados.
function donutGastos(filas, total, referencias, activar, desactivar, centro) {
  const wrap = el("div", { class: "dona dona--grande" });
  const grupoSvg = elSvg("g", { transform: "rotate(-90 50 50)" });
  let acumulado = 0;
  filas.forEach((f, i) => {
    const pct = (f.total / total) * 100;
    const color = f.color || PALETA_DONA[i % PALETA_DONA.length];
    const seg = elSvg("circle", {
      cx: "50",
      cy: "50",
      r: "40",
      "stroke-width": "20",
      fill: "none",
      pathLength: "100",
      "stroke-dasharray": `${pct} ${100 - pct}`,
      "stroke-dashoffset": String(-acumulado),
      stroke: color,
      class: "dona-segmento",
    });
    seg.append(
      elSvg("title", {}, [`${f.nombre}: ${formatoCLP(f.total)} (${Math.round(pct)}%)`])
    );
    seg.addEventListener("mouseenter", () => activar(f.clave));
    seg.addEventListener("mouseleave", () => desactivar());
    grupoSvg.append(seg);
    acumulado += pct;

    const ref = referencias.get(f.clave);
    if (ref) ref.segmento = seg;
  });

  wrap.append(elSvg("svg", { viewBox: "0 0 100 100", class: "dona-svg" }, [grupoSvg]), centro);
  return wrap;
}

function seccionGastosCategoria(movimientos, enPeriodo, verCategoria) {
  const grupos = agruparGastos(movimientos);
  const total = grupos.reduce((s, g) => s + g.total, 0);
  const card = el("section", { class: "panel-tarjeta resumen-gastos-cat" });
  const sub = `Principales categorías de gasto en ${enPeriodo}.`;

  if (total <= 0) {
    card.append(
      tarjetaHead(graficoTortaIcono, "Gastos por categoría", sub),
      el("p", { class: "vacio", text: "Sin gastos en este período." })
    );
    return card;
  }

  const cuerpo = el("div", { class: "resumen-gastos-cat-fila" });
  card.append(tarjetaHead(graficoTortaIcono, "Gastos por categoría", sub), cuerpo);

  function pintar() {
    limpiar(cuerpo);

    // clave -> { li, grupo, segmento } — se completa con el segmento al
    // construir la dona. Al pasar el mouse por una fila o por su porción de
    // la dona, se resalta la otra mitad y el centro muestra el total de esa
    // categoría; al sacar el mouse, todo vuelve a "Total gastos".
    const referencias = new Map();
    const centroTotal = el("span", { class: "dona-total", text: valorOculto(total) });
    const centroEtiqueta = el("span", { class: "dona-etiqueta", text: "Total gastos" });
    const centro = el("div", { class: "dona-centro" }, [centroTotal, centroEtiqueta]);

    function activar(clave) {
      const ref = referencias.get(clave);
      if (!ref) return;
      for (const [k, r] of referencias) {
        const esEsta = k === clave;
        r.li.classList.toggle("resumen-gastos-cat-item--activo", esEsta);
        if (r.segmento) r.segmento.classList.toggle("dona-segmento--atenuado", !esEsta);
      }
      centroTotal.textContent = valorOculto(ref.grupo.total);
      centroEtiqueta.textContent = ref.grupo.nombre;
    }

    function desactivar() {
      for (const [, r] of referencias) {
        r.li.classList.remove("resumen-gastos-cat-item--activo");
        if (r.segmento) r.segmento.classList.remove("dona-segmento--atenuado");
      }
      centroTotal.textContent = valorOculto(total);
      centroEtiqueta.textContent = "Total gastos";
    }

    const lista = el(
      "ul",
      { class: "resumen-gastos-cat-lista" },
      grupos.map((g, i) => {
        const pct = Math.round((g.total / total) * 100);
        const color = g.color || PALETA_DONA[i % PALETA_DONA.length];
        const icono = el("span", { class: "resumen-gastos-cat-icono" }, [
          nodoIconoCategoria(g.categoria, g.nombre),
        ]);
        icono.style.background = `color-mix(in srgb, ${color} 16%, transparent)`;
        icono.style.color = color;
        const clickeable = g.clave !== "sin" && typeof verCategoria === "function";
        const li = el(
          "li",
          {
            class: `resumen-gastos-cat-item${clickeable ? " resumen-gastos-cat-item--clickable" : ""}`,
            ...(clickeable
              ? {
                  role: "button",
                  tabindex: "0",
                  "aria-label": `Ver detalle de ${g.nombre}`,
                  onClick: () => verCategoria(g.clave),
                  onKeydown: (ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      verCategoria(g.clave);
                    }
                  },
                }
              : {}),
            onMouseenter: () => activar(g.clave),
            onMouseleave: () => desactivar(),
          },
          [
            icono,
            el("span", { class: "resumen-gastos-cat-nombre-grupo" }, [
              el("span", { class: "resumen-gastos-cat-nombre", text: g.nombre }),
              el("span", { class: "resumen-gastos-cat-cantidad", text: String(g.cantidad) }),
            ]),
            el("span", { class: "resumen-gastos-cat-monto", text: valorOculto(g.total) }),
            el("span", { class: "resumen-gastos-cat-pct" }, [
              el("span", { class: "resumen-gastos-cat-pct-valor", text: `${pct}%` }),
            ]),
          ]
        );
        referencias.set(g.clave, { li, grupo: g });
        return li;
      })
    );

    cuerpo.append(lista, donutGastos(grupos, total, referencias, activar, desactivar, centro));
  }

  pintar();
  return card;
}

function seccionActividad(movimientos, enPeriodo, irA) {
  const card = el("section", { class: "panel-tarjeta resumen-actividad" });
  const recientes = movimientos.slice(0, 5); // ya ordenados por fecha desc
  const sub = `Últimos movimientos de ${enPeriodo}.`;
  const verTodos =
    typeof irA === "function"
      ? el("button", {
          class: "enlace-ver",
          type: "button",
          text: "Ver todos →",
          onClick: () => irA("movimientos"),
        })
      : null;

  if (!recientes.length) {
    card.append(
      tarjetaHead(reloj3Icono, "Actividad reciente", sub, verTodos),
      el("p", { class: "vacio", text: "Sin movimientos en este período." })
    );
    return card;
  }

  const oculto = prefs.get("ocultarTotal");
  const lista = el(
    "ul",
    { class: "resumen-act-lista" },
    recientes.map((m) => {
      const color = colorMovimiento(m);
      const icono = el("span", { class: "resumen-act-icono" }, [
        nodoIconoCategoria(m.categoria, m.nombre),
      ]);
      icono.style.background = `color-mix(in srgb, ${color} 16%, transparent)`;
      icono.style.color = color;
      const esIngreso = m.tipo === "ingreso";
      const signo = esIngreso ? "+" : "−";
      return el("li", { class: "resumen-act-item" }, [
        icono,
        el("div", { class: "resumen-act-info" }, [
          el("span", { class: "resumen-act-nombre", text: m.nombre }),
          el("span", {
            class: "resumen-act-cat",
            text: m.categoria ? m.categoria.nombre : "Sin categoría",
          }),
        ]),
        el("span", {
          class: "resumen-act-fecha",
          text: fechaCorta(m.fecha_local || m.fecha),
        }),
        el("span", {
          class: `resumen-act-monto ${esIngreso ? "valor-ingreso" : "valor-gasto"}`,
          text: oculto ? "*****" : `${signo} ${formatoCLP(m.monto)}`,
        }),
      ]);
    })
  );

  card.append(tarjetaHead(reloj3Icono, "Actividad reciente", sub, verTodos), lista);
  return card;
}

// Consejo del período: solo a partir de datos del período actual. Si no hay
// movimientos, no se muestra.
function seccionConsejo(ingresos, gastos, tipo, numMovimientos) {
  if (numMovimientos === 0 || (ingresos <= 0 && gastos <= 0)) return null;
  const balance = ingresos - gastos;
  let texto;

  if (balance > 0 && ingresos > 0) {
    const pct = (balance / ingresos) * 100;
    texto =
      pct >= 20
        ? `Vas muy bien ${sufijoPeriodo(tipo)}: tu balance es positivo y estás reteniendo el ${formatoPct(pct)} de tus ingresos.`
        : `Tu balance ${sufijoPeriodo(tipo)} es positivo, aunque el margen es ajustado (${formatoPct(pct)} de tus ingresos).`;
  } else if (balance > 0) {
    texto = `Tu balance ${sufijoPeriodo(tipo)} es positivo, pero no registraste ingresos en este período.`;
  } else if (balance < 0) {
    texto = `Este período gastaste más de lo que ingresaste. Revisa tus categorías con mayor gasto para equilibrarlo.`;
  } else {
    texto = `Ingresos y gastos quedaron parejos ${sufijoPeriodo(tipo)}: tu balance es cero.`;
  }

  return el("section", { class: "panel-tarjeta resumen-consejo" }, [
    el("span", { class: "resumen-consejo-icono" }, [bombillaIcono()]),
    el("div", { class: "resumen-consejo-txt" }, [
      el("span", { class: "resumen-consejo-titulo", text: `Consejo ${delPeriodo(tipo)}` }),
      el("span", { class: "resumen-consejo-cuerpo", text: texto }),
    ]),
  ]);
}

// --- Vista -----------------------------------------------------------------

export async function montarResumen(contenedor, { rango, tipo, fechaRef, modo, irA, verCategoria }) {
  limpiar(contenedor);

  const error = el("p", { class: "error", role: "alert" });
  const aviso = el("p", { class: "aviso" });
  const raiz = el("div", { class: "resumen-vista" });
  contenedor.append(raiz);

  let movimientos = [];
  // Vista mensual: "Día" por defecto, para detectar en qué días concretos
  // se gastó o ingresó más dentro del mes.
  let granularidadVs = "dia";

  await recargar();

  // El toggle de ocultar montos (shell.js) llama a esto en vez de volver a
  // montar la vista entera: repinta con los datos ya cargados, sin pedirlos
  // de nuevo a la red (evitaba un parpadeo de "pantalla se vacía y recarga").
  const repintar = pintar;

  async function recargar() {
    error.textContent = "";
    aviso.textContent = "";
    try {
      movimientos = await listarMovimientos({ ...rango, modo });
      pintar();
    } catch (e) {
      limpiar(raiz);
      raiz.append(error);
      error.textContent = "No se pudo cargar el resumen. ";
      error.append(el("button", { text: "Reintentar", onClick: recargar }));
    }
  }

  function pintar() {
    limpiar(raiz);

    const paraTotales = filtrarParaCalculos(movimientos, {
      modo,
      incluirInactivos: prefs.get("incluirInactivos"),
    });
    const { ingresos, gastos, balance } = calcularTotales(paraTotales);
    const enPeriodo = etiquetaPeriodo(fechaRef, tipo);

    raiz.append(bloqueEncabezado(tipo, null), aviso, error);

    const descIngreso =
      modo === "estimado"
        ? `Ingresos estimados ${delPeriodo(tipo)}`
        : `Total de ingresos ${delPeriodo(tipo)}`;
    const descGasto =
      modo === "estimado"
        ? `Gastos estimados ${delPeriodo(tipo)}`
        : `Total de gastos ${delPeriodo(tipo)}`;

    raiz.append(
      el("div", { class: "resumen-metricas" }, [
        metricaTarjeta(flechaArribaCirculo, "ingreso", "Ingresos", ingresos, "valor-ingreso", descIngreso),
        metricaTarjeta(flechaAbajoCirculo, "gasto", "Gastos", gastos, "valor-gasto", descGasto),
        metricaTarjeta(
          billeteraIcono,
          "balance",
          "Balance",
          balance,
          balance >= 0 ? "valor-balance" : "valor-gasto",
          "Ingresos - Gastos"
        ),
      ])
    );

    // Modo estimado: se conserva el desglose pagado / pendiente.
    if (modo === "estimado") {
      const d = desglosarPorPago(paraTotales);
      raiz.append(
        el("div", { class: "resumen-desglose" }, [
          desgloseItem("Pagado", d.pagado),
          desgloseItem("Pendiente", d.pendiente),
        ])
      );
    }

    raiz.append(
      seccionIngresoGasto(
        paraTotales,
        rango,
        granularidadVs,
        { ingresos, gastos, balance },
        enPeriodo,
        tipo,
        modo === "estimado" ? "Estimado: ingresos vs. gastos" : "Ingresos vs. Gastos",
        (nueva) => {
          granularidadVs = nueva;
          pintar();
        }
      )
    );

    // La distribución semanal solo aplica al ver el mes completo — en las
    // vistas por semana o por año no hay semanas de un mes que comparar.
    if (tipo === "mes") {
      raiz.append(seccionGastosSemana(paraTotales, rango, enPeriodo));
    }

    raiz.append(
      el("div", { class: "resumen-inferior" }, [
        seccionGastosCategoria(paraTotales, enPeriodo, verCategoria),
        seccionActividad(movimientos, enPeriodo, irA),
      ])
    );

    const consejo = seccionConsejo(ingresos, gastos, tipo, movimientos.length);
    if (consejo) raiz.append(consejo);
  }

  return { repintar };
}
