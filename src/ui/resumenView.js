import { el, elSvg, limpiar } from "./dom.js";
import { listarMovimientos } from "../data/movimientos.js";
import { calcularTotales, filtrarParaCalculos } from "../logic/totales.js";
import { formatoCLP, formatoCLPCompacto } from "../logic/dinero.js";
import { ticksAgradables, indicesEtiquetas } from "../logic/escalas.js";
import { nombreVisible } from "../logic/presentacion.js";
import { prefs } from "../prefs.js";
import {
  tendenciaCombinadaIcono,
  graficoIcono,
  graficoTortaIcono,
  reloj3Icono,
  bombillaIcono,
  alertaIcono,
  check,
  etiquetaIcono,
  puntosIcono,
} from "./iconos.js";
import { tituloVista, iconoTitulo } from "./tituloVista.js";
import { nodoIconoCategoria } from "./iconoCategoria.js";
import { colorMovimiento } from "./iconosCategoria.js";
import { etiquetaPeriodo } from "../logic/periodos.js";
import { montarKpis } from "./panelResumenView.js";
import { medidasGrafico, crearTooltip } from "./graficos.js";

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
//
// El rango del período (rango.hasta) puede llegar hasta el final del mes/
// semana/año aunque hoy sea un día anterior (p. ej. "septiembre 2026"
// completo estando a mitad de mes) — mostrar esos tramos futuros dibujaría
// días/semanas/meses que todavía no ocurrieron como si fueran $0, lo que se
// lee como "sin movimientos" en vez de "sin datos todavía". Por eso se
// recorta el tramo visible a la fecha real de hoy: los tramos ya
// arrancados quedan (con su tope acotado a hoy), los que ni empezaron no se
// generan. Si el período consultado ya terminó (hasta <= hoy), no cambia
// nada — se muestra completo.
function serieVs(movimientos, rango, granularidad) {
  const hoy = ymdLocal(new Date());
  const hastaVisible = rango.hasta > hoy ? hoy : rango.hasta;
  const rangoVisible = { desde: rango.desde, hasta: hastaVisible };

  if (granularidad === "semana") {
    return serieVsPorTramos(
      movimientos,
      semanasDelMes(rangoVisible.desde, rangoVisible.hasta),
      etiquetaSemana,
      (f) => tituloSemana(f.desde, f.hasta)
    );
  }
  if (granularidad === "mes") {
    return serieVsPorTramos(
      movimientos,
      mesesDelRango(rangoVisible.desde, rangoVisible.hasta),
      (f) => {
        const d = new Date(`${f.desde}T12:00:00`);
        const abbr = MESES_ABBR[d.getMonth()];
        return `${abbr[0].toUpperCase()}${abbr.slice(1)}`;
      },
      (f) => tituloMes(f.desde)
    );
  }
  return serieVsPorDia(movimientos, rangoVisible);
}

// --- Evolución del período --------------------------------------------------
//
// Un solo gráfico: barras con el gasto de cada día/semana/mes y una línea
// con el balance ACUMULADO. Los ingresos no van como serie aparte (un sueldo
// del día 1 aplastaba la escala del resto): se marcan como puntos verdes
// sobre la línea de balance, con su monto. La zona bajo $0 se sombrea para
// que se note en qué momento el período pasó a negativo.

const GRANULARIDADES_POR_TIPO = {
  semana: ["dia"],
  mes: ["dia", "semana"],
  año: ["mes", "semana", "dia"],
};
const ETIQUETA_GRANULARIDAD = { dia: "Día", semana: "Semana", mes: "Mes" };

function valorEje(valor) {
  return prefs.get("ocultarTotal") ? "•••" : formatoCLPCompacto(valor);
}

function graficoEvolucion(puntos, granularidad, onAbrir) {
  const M = medidasGrafico();
  const anchoTrazo = M.ancho - M.izq - M.der;
  const altoTrazo = M.alto - M.top - M.inf;
  const n = puntos.length;
  const oculto = prefs.get("ocultarTotal");

  const escala = ticksAgradables(
    Math.min(0, ...puntos.map((p) => p.balanceAcumulado)),
    Math.max(1, ...puntos.map((p) => Math.max(p.gastos, p.balanceAcumulado))),
    M.movil ? 4 : 5
  );
  const y = (v) => M.top + altoTrazo - ((v - escala.min) / (escala.max - escala.min)) * altoTrazo;
  const slot = anchoTrazo / n;
  const cx = (i) => M.izq + slot * (i + 0.5);
  const anchoBarra = Math.max(2, Math.min(slot * 0.62, M.movil ? 18 : 44));
  const y0 = y(0);

  const nodos = [];
  if (escala.min < 0) {
    nodos.push(
      elSvg("rect", { x: M.izq, y: y0, width: anchoTrazo, height: M.top + altoTrazo - y0, class: "evo-zona-negativa" })
    );
  }
  for (const v of escala.ticks) {
    nodos.push(
      elSvg("line", { x1: M.izq, y1: y(v), x2: M.ancho - M.der, y2: y(v), class: v === 0 ? "evo-cero" : "evo-grid" }),
      elSvg("text", { x: M.izq - 8, y: y(v) + 4, class: "evo-eje-valor" }, [valorEje(v)])
    );
  }

  const barras = puntos.map((p, i) => {
    const alto = p.gastos > 0 ? Math.max(y0 - y(p.gastos), 1.5) : 0;
    return elSvg("rect", {
      x: cx(i) - anchoBarra / 2,
      y: y0 - alto,
      width: anchoBarra,
      height: alto,
      rx: Math.min(4, anchoBarra / 3),
      class: "evo-barra",
    });
  });
  nodos.push(...barras);

  for (const i of indicesEtiquetas(n, M.movil ? 4 : 8)) {
    nodos.push(elSvg("text", { x: cx(i), y: M.alto - 8, class: "evo-eje-etiqueta" }, [puntos[i].etiquetaEje]));
  }

  const linea = puntos.map((p, i) => `${cx(i).toFixed(1)},${y(p.balanceAcumulado).toFixed(1)}`).join(" ");
  nodos.push(elSvg("polyline", { points: linea, class: "evo-linea-balance" }));

  const conIngreso = puntos.map((p, i) => ({ p, i })).filter(({ p }) => p.ingresos > 0);
  for (const { p, i } of puntos.map((p, i) => ({ p, i }))) {
    nodos.push(
      elSvg("circle", {
        cx: cx(i),
        cy: y(p.balanceAcumulado),
        r: p.ingresos > 0 ? (M.movil ? 5 : 6) : M.movil ? 2.4 : 3,
        class: p.ingresos > 0 ? "evo-marca evo-marca--ingreso" : "evo-marca evo-marca--balance",
      })
    );
  }
  // Monto de cada ingreso junto a su marca (solo si son pocos, para no
  // llenar el gráfico de rótulos).
  // Si dos ingresos quedan muy cerca, solo se rotula el primero (el resto
  // se ve en el tooltip) para que los montos no se encimen.
  if (!oculto && conIngreso.length <= 6) {
    const separacion = M.movil ? 70 : 150;
    let ultimoX = -Infinity;
    for (const { p, i } of conIngreso) {
      if (cx(i) - ultimoX < separacion) continue;
      ultimoX = cx(i);
      const derecha = cx(i) < M.izq + anchoTrazo * 0.75;
      nodos.push(
        elSvg(
          "text",
          {
            x: cx(i) + (derecha ? 10 : -10),
            y: Math.max(M.top + 10, y(p.balanceAcumulado) - 10),
            class: "evo-etiqueta-ingreso",
            "text-anchor": derecha ? "start" : "end",
          },
          [`+${formatoCLP(p.ingresos)}`]
        )
      );
    }
  }

  const tooltip = crearTooltip();
  let activo = null;
  const pista =
    typeof onAbrir === "function"
      ? window.matchMedia("(hover: hover)").matches
        ? "Clic para ver sus movimientos"
        : "Toca de nuevo para ver sus movimientos"
      : null;

  function mostrar(i) {
    activo = i;
    barras.forEach((b, k) => b.classList.toggle("evo-barra--activa", k === i));
    const p = puntos[i];
    const filas = [{ clase: "gasto", nombre: "Gasto", valor: valorOculto(p.gastos) }];
    if (p.ingresos > 0) filas.push({ clase: "ingreso", nombre: "Ingreso", valor: valorOculto(p.ingresos) });
    filas.push({ clase: "balance", nombre: "Balance acumulado", valor: valorOculto(p.balanceAcumulado) });
    tooltip.mostrar(cx(i), M.ancho, p.titulo, filas, pista);
  }
  function ocultar() {
    activo = null;
    barras.forEach((b) => b.classList.remove("evo-barra--activa"));
    tooltip.ocultar();
  }

  // Zonas invisibles por punto: hover muestra el detalle; en Semana/Mes un
  // clic (o un segundo toque en móvil) abre Movimientos en ese tramo.
  const zonas = puntos.map((p, i) =>
    elSvg("rect", {
      x: M.izq + slot * i,
      y: M.top,
      width: slot,
      height: altoTrazo,
      class: "vsgrafico-zona",
      onMouseenter: () => mostrar(i),
      onClick: () => {
        if (typeof onAbrir === "function" && (activo === i || window.matchMedia("(hover: hover)").matches)) {
          onAbrir(p);
        } else {
          mostrar(i);
        }
      },
    })
  );

  const svg = elSvg(
    "svg",
    {
      viewBox: `0 0 ${M.ancho} ${M.alto}`,
      class: "evo-svg",
      role: "img",
      "aria-label": `Gasto por ${ETIQUETA_GRANULARIDAD[granularidad].toLowerCase()} y balance acumulado`,
    },
    [...nodos, ...zonas]
  );
  return el("div", { class: "vsgrafico-lienzo evo-lienzo", onMouseleave: ocultar }, [svg, tooltip.nodo]);
}

function seccionEvolucion(movimientos, rango, tipo, granularidad, enPeriodo, onCambiarGranularidad, irA) {
  const opciones = GRANULARIDADES_POR_TIPO[tipo] || ["dia"];
  const gran = opciones.includes(granularidad) ? granularidad : opciones[0];

  const selector =
    opciones.length > 1
      ? el(
          "div",
          { class: "selector-tipo evo-selector", role: "group", "aria-label": "Agrupar por" },
          opciones.map((g) =>
            el("button", {
              type: "button",
              class: g === gran ? "activo" : "",
              "aria-pressed": String(g === gran),
              text: ETIQUETA_GRANULARIDAD[g],
              onClick: () => onCambiarGranularidad(g),
            })
          )
        )
      : null;

  const leyenda = el("ul", { class: "evo-leyenda" }, [
    el("li", {}, [el("span", { class: "evo-leyenda-barra" }), "Gasto"]),
    el("li", {}, [el("span", { class: "evo-leyenda-linea" }), "Balance acumulado"]),
    el("li", {}, [el("span", { class: "evo-leyenda-punto" }), "Ingreso"]),
  ]);

  // El balance de cada punto es ACUMULADO desde el inicio del período, así
  // el último coincide con el balance de la franja de KPIs.
  const puntos = serieVs(movimientos, rango, gran);
  let acumIngresos = 0;
  let acumGastos = 0;
  for (const p of puntos) {
    acumIngresos += p.ingresos;
    acumGastos += p.gastos;
    p.balanceAcumulado = acumIngresos - acumGastos;
  }
  const hayDatos = puntos.some((p) => p.ingresos > 0 || p.gastos > 0);

  // Semana y Mes: tocar un tramo abre Movimientos en ese período (antes lo
  // hacía la tarjeta "Gastos por semana", que quedó integrada aquí).
  const onAbrir =
    typeof irA === "function" && (gran === "semana" || gran === "mes")
      ? (p) => irA("movimientos", { tipo: gran, fecha: p.clave })
      : null;

  return el("section", { class: "panel-tarjeta resumen-evo" }, [
    el("div", { class: "evo-cabecera" }, [
      el("div", { class: "resumen-card-head-txt" }, [
        el("h3", {}, [iconoTitulo(graficoIcono), `Evolución ${delPeriodo(tipo)}`]),
        el("p", {
          class: "resumen-card-sub",
          text: `Gasto por ${ETIQUETA_GRANULARIDAD[gran].toLowerCase()} y balance acumulado en ${enPeriodo}.`,
        }),
      ]),
      hayDatos ? leyenda : null,
      selector,
    ]),
    hayDatos
      ? graficoEvolucion(puntos, gran, onAbrir)
      : el("p", { class: "vacio", text: "Sin movimientos en este período." }),
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

// "Otras": todo lo que queda fuera de las 5 categorías con más gasto.
const TOPE_CATEGORIAS = 5;

function textoCantidad(n) {
  return `${n} ${n === 1 ? "movimiento" : "movimientos"}`;
}

function pctCategoria(parte, total) {
  if (total <= 0 || parte <= 0) return "0%";
  const pct = (parte / total) * 100;
  return pct < 1 ? "<1%" : `${Math.round(pct)}%`;
}

// Top 5 + "Otras" (con los nombres de lo que agrupa). Con pocas categorías
// se muestran todas tal cual.
function categoriasVisibles(grupos) {
  if (grupos.length <= TOPE_CATEGORIAS + 1) return grupos;
  const top = grupos.slice(0, TOPE_CATEGORIAS);
  const resto = grupos.slice(TOPE_CATEGORIAS);
  const nombres = resto.map((g) => g.nombre);
  const detalle =
    nombres.length <= 3 ? nombres.join(", ") : `${nombres.slice(0, 3).join(", ")} y ${nombres.length - 3} más`;
  return [
    ...top,
    {
      clave: "otras",
      nombre: "Otras",
      detalle,
      categoria: null,
      color: "#8a8f98",
      total: resto.reduce((s, g) => s + g.total, 0),
      cantidad: resto.reduce((s, g) => s + g.cantidad, 0),
      esOtras: true,
    },
  ];
}

function seccionGastosCategoria(movimientos, enPeriodo, verCategoria, irA) {
  const todos = agruparGastos(movimientos);
  const total = todos.reduce((s, g) => s + g.total, 0);
  const card = el("section", { class: "panel-tarjeta resumen-gastos-cat" });
  const verTodas =
    typeof irA === "function"
      ? el("button", { class: "enlace-ver", type: "button", text: "Ver todas", onClick: () => irA("categorias") })
      : null;
  const cabecera = tarjetaHead(graficoTortaIcono, "Gastos por categoría", `Dónde se fue tu dinero en ${enPeriodo}.`, verTodas);

  if (total <= 0) {
    card.append(cabecera, el("p", { class: "vacio", text: "Sin gastos en este período." }));
    return card;
  }

  const grupos = categoriasVisibles(todos);
  const sinCategoria = todos.find((g) => g.clave === "sin") || null;
  const cuerpo = el("div", { class: "resumen-gastos-cat-fila" });
  card.append(cabecera, cuerpo);

  // clave -> { li, grupo, segmento }: al pasar el mouse por una fila o por
  // su porción de la dona se resalta la otra mitad y el centro muestra el
  // total de esa categoría; al salir vuelve a "Total gastos".
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
      const color = g.color || PALETA_DONA[i % PALETA_DONA.length];
      const icono = el("span", { class: "resumen-gastos-cat-icono" }, [
        g.esOtras ? puntosIcono() : nodoIconoCategoria(g.categoria, g.nombre),
      ]);
      icono.style.background = `color-mix(in srgb, ${color} 16%, transparent)`;
      icono.style.color = color;
      const clickeable = !g.esOtras && g.clave !== "sin" && typeof verCategoria === "function";
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
            el("span", {
              class: "resumen-gastos-cat-detalle",
              text: g.esOtras ? g.detalle : textoCantidad(g.cantidad),
            }),
          ]),
          el("span", { class: "resumen-gastos-cat-monto", text: valorOculto(g.total) }),
          el("span", { class: "resumen-gastos-cat-pct" }, [
            el("span", { class: "resumen-gastos-cat-pct-valor", text: pctCategoria(g.total, total) }),
          ]),
        ]
      );
      referencias.set(g.clave, { li, grupo: g });
      return li;
    })
  );

  cuerpo.append(donutGastos(grupos, total, referencias, activar, desactivar, centro), lista);

  // Acceso a lo que falta categorizar: abre Movimientos para corregirlo.
  if (sinCategoria) {
    card.append(
      el(
        "button",
        {
          type: "button",
          class: "resumen-sin-categoria",
          onClick: () => (typeof irA === "function" ? irA("movimientos") : null),
        },
        [
          etiquetaIcono(),
          el("span", {
            class: "resumen-sin-categoria-txt",
            text: `${textoCantidad(sinCategoria.cantidad)} sin categoría (${valorOculto(sinCategoria.total)})`,
          }),
          el("span", { class: "resumen-sin-categoria-accion", text: "Revisar" }),
        ]
      )
    );
  }
  return card;
}

// Reemplaza a "Actividad reciente" (que repetía la lista de Movimientos):
// los 5 gastos más altos del período, que es lo que sirve para analizar.
function seccionMayoresGastos(movimientos, enPeriodo, irA) {
  const card = el("section", { class: "panel-tarjeta resumen-mayores" });
  const verTodos =
    typeof irA === "function"
      ? el("button", { class: "enlace-ver", type: "button", text: "Ver todos", onClick: () => irA("movimientos") })
      : null;
  const cabecera = tarjetaHead(reloj3Icono, "Mayores gastos", `Los gastos más altos de ${enPeriodo}.`, verTodos);
  const top = movimientos
    .filter((m) => m.tipo === "gasto" && Number(m.monto) > 0)
    .sort((a, b) => Number(b.monto) - Number(a.monto))
    .slice(0, 5);

  if (!top.length) {
    card.append(cabecera, el("p", { class: "vacio", text: "Sin gastos en este período." }));
    return card;
  }

  const lista = el(
    "ol",
    { class: "resumen-act-lista resumen-mayores-lista" },
    top.map((m) => {
      const color = colorMovimiento(m);
      const icono = el("span", { class: "resumen-act-icono" }, [nodoIconoCategoria(m.categoria, m.nombre)]);
      icono.style.background = `color-mix(in srgb, ${color} 16%, transparent)`;
      icono.style.color = color;
      return el("li", { class: "resumen-act-item" }, [
        icono,
        el("div", { class: "resumen-act-info" }, [
          el("span", { class: "resumen-act-nombre", text: nombreVisible(m.nombre) }),
          el("span", {
            class: "resumen-act-cat",
            text: `${m.categoria ? m.categoria.nombre : "Sin categoría"} · ${fechaCorta(m.fecha_local || m.fecha)}`,
          }),
        ]),
        el("span", { class: "resumen-act-monto resumen-mayores-monto", text: valorOculto(m.monto) }),
      ]);
    })
  );
  card.append(cabecera, lista);
  return card;
}

// Primer día desde el que el balance acumulado quedó bajo cero (y no volvió
// a subir). null si el período no termina en negativo.
function diaDesdeNegativo(movimientos, rango) {
  const dias = serieVs(movimientos, rango, "dia");
  let acum = 0;
  let desde = null;
  for (const d of dias) {
    acum += d.ingresos - d.gastos;
    if (acum < 0 && desde === null) desde = d.clave;
    else if (acum >= 0) desde = null;
  }
  return desde;
}

// Aviso del período, arriba de todo: un mensaje concreto con datos (no un
// consejo genérico) y un acceso directo a la categoría con más gasto.
function seccionAviso(movimientos, totales, tipo, rango, modo, verCategoria) {
  const { ingresos, gastos, balance } = totales;
  if (!movimientos.length || (ingresos <= 0 && gastos <= 0)) return null;
  const estimado = modo === "estimado";
  const periodo = sufijoPeriodo(tipo); // "este mes"
  const Periodo = `${periodo[0].toUpperCase()}${periodo.slice(1)}`;

  let tono;
  let titulo;
  if (balance < 0) {
    tono = "negativo";
    titulo = estimado
      ? `${Periodo} tienes estimado gastar ${valorOculto(-balance)} más de lo que ingresas`
      : `${Periodo} gastaste ${valorOculto(-balance)} más de lo que ingresaste`;
  } else if (balance > 0 && ingresos > 0) {
    const pct = (balance / ingresos) * 100;
    tono = pct >= 20 ? "positivo" : "neutro";
    titulo =
      pct >= 20
        ? `Vas muy bien ${periodo}: estás reteniendo el ${formatoPct(pct)} de tus ingresos`
        : `Tu balance ${periodo} es positivo, aunque el margen es ajustado (${formatoPct(pct)})`;
  } else if (balance > 0) {
    tono = "neutro";
    titulo = `Tu balance ${periodo} es positivo, pero no hay ingresos registrados`;
  } else {
    tono = "neutro";
    titulo = `Ingresos y gastos quedaron parejos ${periodo}`;
  }

  const detalles = [];
  const mayor = agruparGastos(movimientos)[0] || null;
  if (mayor && gastos > 0) {
    detalles.push(
      `Tu mayor gasto es ${mayor.nombre}: ${valorOculto(mayor.total)} (${pctCategoria(mayor.total, gastos)}) en ${textoCantidad(
        mayor.cantidad
      )}.`
    );
  }
  if (balance < 0 && tipo !== "semana") {
    const desde = diaDesdeNegativo(movimientos, rango);
    if (desde && desde !== rango.desde) {
      const d = new Date(`${desde}T12:00:00`);
      detalles.push(`El balance está en negativo desde el ${d.getDate()} de ${MESES_LARGO[d.getMonth()]}.`);
    }
  }

  const accion =
    mayor && mayor.clave !== "sin" && typeof verCategoria === "function"
      ? el("button", {
          type: "button",
          class: "enlace-ver resumen-aviso-accion",
          text: `Ver ${mayor.nombre}`,
          onClick: () => verCategoria(mayor.clave),
        })
      : null;

  const icono = tono === "negativo" ? alertaIcono : tono === "positivo" ? check : bombillaIcono;
  return el("section", { class: `resumen-aviso resumen-aviso--${tono}`, "aria-label": "Aviso del período" }, [
    el("span", { class: "resumen-aviso-icono" }, [icono()]),
    el("div", { class: "resumen-aviso-txt" }, [
      el("span", { class: "resumen-aviso-titulo", text: titulo }),
      detalles.length ? el("span", { class: "resumen-aviso-detalle", text: detalles.join(" ") }) : null,
    ]),
    accion,
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
  // Mes/semana: "Día" por defecto, para ver en qué días se gastó más. Año:
  // "Mes" (365 barras diarias no se leen).
  let granularidadVs = tipo === "año" ? "mes" : "dia";

  await recargar();

  // El toggle de ocultar montos (shell.js) llama a esto en vez de volver a
  // montar la vista entera: repinta con los datos ya cargados.
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
    const totales = calcularTotales(paraTotales);
    const enPeriodo = etiquetaPeriodo(fechaRef, tipo);

    raiz.append(bloqueEncabezado(tipo, null), aviso, error);

    const alerta = seccionAviso(paraTotales, totales, tipo, rango, modo, verCategoria);
    if (alerta) raiz.append(alerta);

    // Misma franja de KPIs que Movimientos (saldo, ingresos, gastos y
    // pagos en Estimado / gasto diario promedio en Real).
    const kpis = el("section", { class: "kpis", "aria-label": "Totales del período" });
    montarKpis(kpis, paraTotales, { modo, rango });
    raiz.append(kpis);

    raiz.append(
      seccionEvolucion(
        paraTotales,
        rango,
        tipo,
        granularidadVs,
        enPeriodo,
        (nueva) => {
          granularidadVs = nueva;
          pintar();
        },
        irA
      ),
      el("div", { class: "resumen-inferior" }, [
        seccionGastosCategoria(paraTotales, enPeriodo, verCategoria, irA),
        seccionMayoresGastos(paraTotales, enPeriodo, irA),
      ])
    );
  }

  return { repintar };
}
