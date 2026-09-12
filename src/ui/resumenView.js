import { el, elSvg, limpiar } from "./dom.js";
import { listarMovimientos } from "../data/movimientos.js";
import {
  calcularTotales,
  desglosarPorPago,
  filtrarParaCalculos,
  todosActivos,
} from "../logic/totales.js";
import { formatoCLP } from "../logic/dinero.js";
import { prefs } from "../prefs.js";
import {
  ojoIcono,
  ojoTachadoIcono,
  puntosIcono,
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
import { periodoSiguiente, rangoPeriodo, etiquetaPeriodo } from "../logic/periodos.js";
import {
  contarMovimientosEstimado,
  copiarMesEstimado,
  borrarMesEstimado,
  cambiarEstadoMesEstimado,
} from "../data/herramientasMes.js";

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

function tarjetaHead(fabricaIcono, titulo, sub, extra) {
  return el("div", { class: "resumen-card-head" }, [
    el("div", { class: "resumen-card-head-txt" }, [
      el("h3", {}, [iconoTitulo(fabricaIcono), titulo]),
      sub ? el("p", { class: "resumen-card-sub", text: sub }) : null,
    ]),
    extra || null,
  ]);
}

// Barra proporcional Ingresos / Gastos (misma escala: la mayor = 100%).
function barraComparativa(etiqueta, valor, maxValor, claseRelleno) {
  const pct = maxValor > 0 ? Math.max((valor / maxValor) * 100, valor > 0 ? 3 : 0) : 0;
  const relleno = el("span", { class: `barra-comparativa-relleno ${claseRelleno}` });
  relleno.style.width = `${pct}%`;
  return el("div", { class: "barra-comparativa-fila" }, [
    el("span", { class: "barra-comparativa-etiqueta", text: etiqueta }),
    el("span", { class: "barra-comparativa-pista" }, [relleno]),
    el("span", { class: "barra-comparativa-valor", text: valorOculto(valor) }),
  ]);
}

function seccionIngresoGasto(ingresos, gastos, enPeriodo, titulo) {
  const max = Math.max(ingresos, gastos, 0);
  const main =
    max > 0
      ? el("div", { class: "barra-comparativa" }, [
          barraComparativa("Ingresos", ingresos, max, "barra-comparativa-relleno--ingreso"),
          barraComparativa("Gastos", gastos, max, "barra-comparativa-relleno--gasto"),
        ])
      : el("p", { class: "vacio", text: "Sin movimientos en este período." });

  const cuerpo = el("div", { class: "resumen-vs-cuerpo" }, [
    el("div", { class: "resumen-vs-main" }, [main]),
  ]);

  return el("section", { class: "panel-tarjeta resumen-vs" }, [
    tarjetaHead(graficoIcono, titulo, `Comparación de tus ingresos y gastos en ${enPeriodo}.`),
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
function semanasDelMes(desde, hasta) {
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

function etiquetaSemana(semana) {
  const a = new Date(`${semana.desde}T12:00:00`);
  const b = new Date(`${semana.hasta}T12:00:00`);
  const mes = MESES_ABBR[b.getMonth()];
  return a.getDate() === b.getDate() ? `${a.getDate()} ${mes}` : `${a.getDate()}–${b.getDate()} ${mes}`;
}

// Agrupa los gastos del mes por semana de calendario (lunes a domingo).
function agruparGastosPorSemana(movimientos, rango) {
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
function estadoSemana(semana, hoy) {
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

  const maxTotal = Math.max(...conDatos.map((s) => s.total));
  const minTotal = Math.min(...conDatos.map((s) => s.total));
  const mayor = conDatos.find((s) => s.total === maxTotal);
  // "Menor gasto" solo aporta cuando hay más de una semana con datos y
  // realmente existe variación — si no, sería igual (y redundante) al mayor.
  const menor = conDatos.length >= 2 && minTotal < maxTotal
    ? conDatos.find((s) => s.total === minTotal)
    : null;

  const filas = semanas.map((s) => {
    const etiquetaNodo = el("span", { class: "resumen-semanas-rango", text: etiquetaSemana(s) });

    if (s.estado === "futura") {
      return el("div", { class: "resumen-semanas-fila resumen-semanas-fila--futura" }, [
        etiquetaNodo,
        el("span", { class: "resumen-semanas-estado", text: "Aún no disponible" }),
      ]);
    }

    const esPico = s.total === maxTotal;
    const anchoBarra = maxTotal > 0 ? Math.max((s.total / maxTotal) * 100, s.total > 0 ? 4 : 1) : 1;
    const relleno = el("span", {
      class: `resumen-semanas-barra-relleno${esPico ? " resumen-semanas-barra-relleno--pico" : ""}`,
    });
    relleno.style.width = `${anchoBarra}%`;
    const pct = totalMes > 0 ? Math.round((s.total / totalMes) * 100) : 0;

    return el("div", { class: `resumen-semanas-fila${esPico ? " resumen-semanas-fila--pico" : ""}` }, [
      etiquetaNodo,
      el("div", { class: "resumen-semanas-barra-pista" }, [relleno]),
      el("span", { class: "resumen-semanas-monto", text: valorOculto(s.total) }),
      s.estado === "en_curso"
        ? el("span", { class: "resumen-semanas-pct resumen-semanas-pct--curso", text: "En curso" })
        : el("span", { class: "resumen-semanas-pct", text: `${pct}%` }),
    ]);
  });

  const destacadas = el(
    "div",
    { class: "resumen-semanas-destacadas" },
    [
      el("span", { class: "resumen-semanas-destacada" }, [
        el("span", { class: "resumen-semanas-destacada-etq", text: "Mayor gasto" }),
        `: ${etiquetaSemana(mayor)} · ${valorOculto(mayor.total)}`,
      ]),
      menor
        ? el("span", { class: "resumen-semanas-destacada" }, [
            el("span", { class: "resumen-semanas-destacada-etq", text: "Menor gasto" }),
            `: ${etiquetaSemana(menor)} · ${valorOculto(menor.total)}`,
          ])
        : null,
    ].filter(Boolean)
  );

  return el("section", { class: "panel-tarjeta resumen-semanas" }, [
    cabecera,
    el("div", { class: "resumen-semanas-lista" }, filas),
    destacadas,
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
      };
    g.total += Number(m.monto) || 0;
    if (!g.color && m.categoria && m.categoria.color) g.color = m.categoria.color;
    idx.set(clave, g);
  }
  return [...idx.values()].sort((a, b) => b.total - a.total);
}

function donutGastos(filas, total) {
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
    grupoSvg.append(seg);
    acumulado += pct;
  });

  const centro = el("div", { class: "dona-centro" }, [
    el("span", { class: "dona-total", text: valorOculto(total) }),
    el("span", { class: "dona-etiqueta", text: "Total gastos" }),
  ]);
  wrap.append(elSvg("svg", { viewBox: "0 0 100 100", class: "dona-svg" }, [grupoSvg]), centro);
  return wrap;
}

function seccionGastosCategoria(movimientos, enPeriodo) {
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
        return el("li", { class: "resumen-gastos-cat-item" }, [
          icono,
          el("span", { class: "resumen-gastos-cat-nombre", text: g.nombre }),
          el("span", { class: "resumen-gastos-cat-monto", text: valorOculto(g.total) }),
          el("span", { class: "resumen-gastos-cat-pct", text: `${pct}%` }),
        ]);
      })
    );

    cuerpo.append(lista, donutGastos(grupos, total));
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

export async function montarResumen(contenedor, { rango, tipo, fechaRef, modo, irA }) {
  limpiar(contenedor);

  const error = el("p", { class: "error", role: "alert" });
  const aviso = el("p", { class: "aviso" });
  const raiz = el("div", { class: "resumen-vista" });
  contenedor.append(raiz);

  let movimientos = [];

  await recargar();

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

    const oculto = prefs.get("ocultarTotal");
    const btnOjo = el(
      "button",
      {
        class: "boton--icono boton-ojo",
        "aria-label": oculto ? "Mostrar montos" : "Ocultar montos",
        title: oculto ? "Mostrar montos" : "Ocultar montos",
        "aria-pressed": String(oculto),
        onClick: () => {
          prefs.set("ocultarTotal", !oculto);
          pintar();
        },
      },
      [oculto ? ojoTachadoIcono() : ojoIcono()]
    );
    const acciones = el("div", { class: "resumen-header-acciones" }, [btnOjo]);
    if (modo === "estimado" && tipo === "mes") acciones.append(construirMenuMes());

    const paraTotales = filtrarParaCalculos(movimientos, {
      modo,
      incluirInactivos: prefs.get("incluirInactivos"),
    });
    const { ingresos, gastos, balance } = calcularTotales(paraTotales);
    const enPeriodo = etiquetaPeriodo(fechaRef, tipo);

    raiz.append(bloqueEncabezado(tipo, acciones), aviso, error);

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
        ingresos,
        gastos,
        enPeriodo,
        modo === "estimado" ? "Estimado: ingresos vs. gastos" : "Ingresos vs. Gastos"
      )
    );

    // La distribución semanal solo aplica al ver el mes completo — en las
    // vistas por semana o por año no hay semanas de un mes que comparar.
    if (tipo === "mes") {
      raiz.append(seccionGastosSemana(paraTotales, rango, enPeriodo));
    }

    raiz.append(
      el("div", { class: "resumen-inferior" }, [
        seccionGastosCategoria(paraTotales, enPeriodo),
        seccionActividad(movimientos, enPeriodo, irA),
      ])
    );

    const consejo = seccionConsejo(ingresos, gastos, tipo, movimientos.length);
    if (consejo) raiz.append(consejo);
  }

  function construirMenuMes() {
    const popover = el("div", { class: "menu-mes", hidden: "true" });
    const btnMenu = el(
      "button",
      {
        class: "boton--icono",
        "aria-label": "Más acciones del mes",
        title: "Más acciones del mes",
        onClick: () => {
          popover.hidden = !popover.hidden;
        },
      },
      [puntosIcono()]
    );

    const etiquetaActual = etiquetaPeriodo(fechaRef, tipo);
    const desdeSiguiente = periodoSiguiente(fechaRef, "mes");
    const etiquetaSiguiente = etiquetaPeriodo(desdeSiguiente, "mes");

    function cerrarMenu() {
      popover.hidden = true;
    }

    async function conBloqueo(fn) {
      for (const b of popover.querySelectorAll("button")) b.disabled = true;
      error.textContent = "";
      aviso.textContent = "";
      try {
        await fn();
      } catch (e) {
        error.textContent = "No se pudo completar la acción.";
      } finally {
        for (const b of popover.querySelectorAll("button")) b.disabled = false;
      }
    }

    const btnCopiar = el(
      "button",
      {
        class: "menu-mes-item",
        type: "button",
        onClick: () =>
          conBloqueo(async () => {
            cerrarMenu();
            const rangoDestino = rangoPeriodo(desdeSiguiente, "mes");
            const n = await contarMovimientosEstimado(rangoDestino.desde, rangoDestino.hasta);
            const mensajeConfirm =
              n > 0
                ? `${etiquetaSiguiente} ya tiene ${n} movimientos estimados. Se reemplazarán por la copia de ${etiquetaActual}. ¿Continuar?`
                : `¿Copiar los movimientos estimados de ${etiquetaActual} a ${etiquetaSiguiente}?`;
            if (!confirm(mensajeConfirm)) return;
            const total = await copiarMesEstimado(rango.desde);
            aviso.textContent = `Se copiaron ${total} movimientos a ${etiquetaSiguiente}.`;
          }),
      },
      [`Copiar a ${etiquetaSiguiente}`]
    );

    const btnEstado = el(
      "button",
      {
        class: "menu-mes-item",
        type: "button",
        onClick: () =>
          conBloqueo(async () => {
            cerrarMenu();
            const nuevoEstado = !todosActivos(movimientos);
            const verbo = nuevoEstado ? "Activar" : "Desactivar";
            if (!confirm(`¿${verbo} los ${movimientos.length} movimientos de ${etiquetaActual}?`)) return;
            await cambiarEstadoMesEstimado(rango.desde, rango.hasta, nuevoEstado);
            await recargar();
            aviso.textContent = `Se ${nuevoEstado ? "activaron" : "desactivaron"} los movimientos de ${etiquetaActual}.`;
          }),
      },
      [todosActivos(movimientos) ? "Desactivar todos" : "Activar todos"]
    );

    const btnBorrar = el(
      "button",
      {
        class: "menu-mes-item menu-mes-item--peligro",
        type: "button",
        onClick: () =>
          conBloqueo(async () => {
            cerrarMenu();
            if (
              !confirm(
                `¿Borrar los ${movimientos.length} movimientos estimados de ${etiquetaActual}? Esta acción no se puede deshacer.`
              )
            )
              return;
            await borrarMesEstimado(rango.desde, rango.hasta);
            await recargar();
            aviso.textContent = `Se borraron los movimientos estimados de ${etiquetaActual}.`;
          }),
      },
      ["Borrar datos del mes"]
    );

    popover.append(btnCopiar, btnEstado, btnBorrar);
    return el("div", { class: "menu-mes-wrap" }, [btnMenu, popover]);
  }
}
