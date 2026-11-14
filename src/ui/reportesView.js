import { el, elSvg, limpiar } from "./dom.js";
import { listarMovimientos } from "../data/movimientos.js";
import { filtrarParaCalculos } from "../logic/totales.js";
import { formatoCLP, formatoCLPCompacto } from "../logic/dinero.js";
import { ticksAgradables, indicesEtiquetas } from "../logic/escalas.js";
import { prefs } from "../prefs.js";
import { rangoPeriodo, etiquetaPeriodo, etiquetaCorta } from "../logic/periodos.js";
import {
  fechasTendencia,
  diasEnRango,
  progresoPeriodo,
  serieAcumulada,
  proyectarCierre,
} from "../logic/reportes.js";
import {
  reporteIcono,
  graficoIcono,
  relojIcono,
  bombillaIcono,
  subidaIcono,
  alertaIcono,
  check,
  flechaArribaCirculo,
  flechaAbajoCirculo,
} from "./iconos.js";
import { tituloVista, iconoTitulo } from "./tituloVista.js";
import { tarjetaHead } from "./resumenView.js";
import { medidasGrafico, crearTooltip } from "./graficos.js";

function valorOculto(valor) {
  return prefs.get("ocultarTotal") ? "*****" : formatoCLP(valor);
}

function ymdLocal(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}


function capitaliza(s) {
  return s ? `${s.charAt(0).toUpperCase()}${s.slice(1)}` : s;
}

// --- 1. Carga de datos ------------------------------------------------------

// Un período por fecha de fechasTendencia, en orden ascendente — el último
// es siempre el período de referencia (el seleccionado con el selector
// Sem/Mes/Año + flechas de navegación), que puede estar en curso o cerrado.
// `sinDatos` marca un período sin un solo movimiento registrado (p. ej.
// meses anteriores a que el usuario empezara a usar la app): ese caso no
// es "balance $0", es ausencia de información, y la UI lo distingue.
async function cargarPeriodos(fechaRef, tipo, modo) {
  const hoyYmd = ymdLocal(new Date());
  const fechas = fechasTendencia(fechaRef, tipo, 6);
  const incluirInactivos = prefs.get("incluirInactivos");
  const rangos = fechas.map((f) => rangoPeriodo(f, tipo));
  const listas = await Promise.all(rangos.map((r) => listarMovimientos({ ...r, modo })));

  return fechas.map((f, i) => {
    const rango = rangos[i];
    const esReferencia = i === fechas.length - 1;
    const movs = filtrarParaCalculos(listas[i], { modo, incluirInactivos });
    // Solo el período de referencia puede estar "en curso": los anteriores
    // son siempre estrictamente previos a él, así que ya cerraron.
    const prog = esReferencia
      ? progresoPeriodo(rango, hoyYmd)
      : (() => {
          const diasTotales = diasEnRango(rango.desde, rango.hasta);
          return { diasTotales, diaCorte: diasTotales, pct: 100, enCurso: false };
        })();
    const serie = serieAcumulada(movs, rango, prog.diasTotales);
    const punto = serie[Math.max(prog.diaCorte, 1) - 1] || { ingresos: 0, gastos: 0, balance: 0 };

    return {
      fecha: f,
      tipo,
      rango,
      etiqueta: etiquetaPeriodo(f, tipo),
      etiquetaCorta: etiquetaCorta(f, tipo),
      diasTotales: prog.diasTotales,
      diaCorte: prog.diaCorte,
      pct: prog.pct,
      enCurso: prog.enCurso,
      esReferencia,
      sinDatos: movs.length === 0,
      serie,
      totales: { ingresos: punto.ingresos, gastos: punto.gastos, balance: punto.balance },
    };
  });
}

// --- Comparaciones compartidas -----------------------------------------------

// Compara el período de referencia contra `anterior` (un período cerrado,
// con datos) en el mismo día relativo — única fuente de la comparación "al
// mismo punto", para que la tarjeta, el gráfico de ritmo y la interpretación
// nunca muestren números distintos para la misma pregunta.
function compararAlMismoPunto(referencia, anterior) {
  if (!anterior || anterior.sinDatos || !referencia.enCurso) return { disponible: false };
  const diaCorte = referencia.diaCorte;
  const idx = Math.min(diaCorte, anterior.diasTotales) - 1;
  const punto = anterior.serie[idx];
  const diffGastos = referencia.totales.gastos - punto.gastos;
  const diffBalance = referencia.totales.balance - punto.balance;
  const pctGastos = punto.gastos > 0 ? Math.round((Math.abs(diffGastos) / punto.gastos) * 100) : null;
  const direccion = diffGastos > 0 ? "mas" : diffGastos < 0 ? "menos" : "igual";
  return { disponible: true, anterior, diaCorte, punto, diffGastos, diffBalance, pctGastos, direccion };
}

// Proyección de cierre a partir del ritmo diario acumulado — una sola vez,
// reutilizada por la tarjeta de estado y por la interpretación.
function proyeccionCierre(referencia) {
  if (!referencia.enCurso) return null;
  const { ingresos, gastos } = referencia.totales;
  const proyIngresos = proyectarCierre(ingresos, referencia.diaCorte, referencia.diasTotales);
  const proyGastos = proyectarCierre(gastos, referencia.diaCorte, referencia.diasTotales);
  if (proyIngresos === null || proyGastos === null) return null;
  const balanceDiario = (ingresos - gastos) / referencia.diaCorte;
  return { proyIngresos, proyGastos, proyBalance: proyIngresos - proyGastos, balanceDiario };
}

// --- 2. Conclusión del período ------------------------------------------------

// Un solo mensaje principal + hasta dos datos de apoyo (antes había un
// bloque "Interpretación" con avisos que se contradecían entre sí, y la
// misma comparación repetida en tres tarjetas).
function elPeriodo(tipo) {
  if (tipo === "semana") return "la semana";
  if (tipo === "año") return "el año";
  return "el mes";
}

export function generarConclusion(referencia, anteriorConDatos) {
  const bal = referencia.totales.balance;
  if (referencia.sinDatos) {
    return { tono: "neutro", titulo: `No hay movimientos registrados en ${referencia.etiqueta}.`, puntos: [] };
  }

  if (!referencia.enCurso) {
    const titulo =
      bal < 0
        ? `${capitaliza(referencia.etiqueta)} cerró con un balance negativo de ${valorOculto(bal)}`
        : bal > 0
          ? `${capitaliza(referencia.etiqueta)} cerró con un balance positivo de ${valorOculto(bal)}`
          : `${capitaliza(referencia.etiqueta)} cerró con ingresos y gastos parejos`;
    const puntos = [];
    if (anteriorConDatos) {
      const diff = referencia.totales.gastos - anteriorConDatos.totales.gastos;
      if (diff !== 0) {
        puntos.push({
          icono: diff < 0 ? "baja" : "sube",
          texto: `Gastaste ${valorOculto(Math.abs(diff))} ${diff < 0 ? "menos" : "más"} que en ${anteriorConDatos.etiquetaCorta}.`,
        });
      }
    }
    return { tono: bal < 0 ? "negativo" : "positivo", titulo, puntos };
  }

  const cmp = compararAlMismoPunto(referencia, anteriorConDatos);
  const puntos = [];
  let titulo;
  if (cmp.disponible) {
    const ant = cmp.anterior.etiquetaCorta;
    if (cmp.direccion === "menos") {
      titulo = `Vas gastando menos que en ${ant}, ${bal < 0 ? "pero sigues en negativo" : "y tu balance es positivo"}`;
    } else if (cmp.direccion === "mas") {
      titulo = `Vas gastando más que en ${ant}${bal < 0 ? " y tu balance es negativo" : ", aunque tu balance sigue positivo"}`;
    } else {
      titulo = `Vas gastando lo mismo que en ${ant}${bal < 0 ? ", con balance negativo" : ""}`;
    }
    if (cmp.direccion !== "igual") {
      const pct = cmp.pctGastos !== null ? ` (${cmp.direccion === "menos" ? "−" : "+"}${cmp.pctGastos}%)` : "";
      puntos.push({
        icono: cmp.direccion === "menos" ? "baja" : "sube",
        texto: `Llevas ${valorOculto(Math.abs(cmp.diffGastos))} ${cmp.direccion === "menos" ? "menos" : "más"} gastado que ${ant} a esta altura${pct}.`,
      });
    }
  } else {
    titulo =
      bal < 0
        ? `Llevas un balance negativo de ${valorOculto(bal)}`
        : `Llevas un balance positivo de ${valorOculto(bal)}`;
    puntos.push({ icono: "info", texto: "Todavía no hay un período anterior con datos para comparar tu ritmo." });
  }

  const proy = proyeccionCierre(referencia);
  if (proy) {
    puntos.push({
      icono: proy.proyBalance < 0 ? "alerta" : "ok",
      texto: `A este ritmo cerrarías ${elPeriodo(referencia.tipo)} cerca de ${valorOculto(proy.proyBalance)}.`,
    });
  }
  return { tono: bal < 0 ? "negativo" : "positivo", titulo, puntos: puntos.slice(0, 2) };
}

const ICONOS_CONCLUSION = {
  baja: { fn: flechaAbajoCirculo, clase: "bien" },
  sube: { fn: flechaArribaCirculo, clase: "mal" },
  alerta: { fn: alertaIcono, clase: "alerta" },
  ok: { fn: check, clase: "bien" },
  info: { fn: bombillaIcono, clase: "info" },
};

function seccionConclusion({ tono, titulo, puntos }) {
  return el("section", { class: `reportes-conclusion-card reportes-conclusion-card--${tono}`, "aria-label": "Conclusión" }, [
    el("span", { class: "reportes-conclusion-etq", text: "Conclusión" }),
    el("h3", { class: "reportes-conclusion-titulo", text: titulo }),
    puntos.length
      ? el(
          "ul",
          { class: "reportes-conclusion-puntos" },
          puntos.map((p) => {
            const ic = ICONOS_CONCLUSION[p.icono] || ICONOS_CONCLUSION.info;
            return el("li", {}, [
              el("span", { class: `reportes-conclusion-icono reportes-conclusion-icono--${ic.clase}` }, [ic.fn()]),
              el("span", { text: p.texto }),
            ]);
          })
        )
      : null,
  ]);
}

// --- 3. KPIs ------------------------------------------------------------------

function kpi({ clase = "", etiqueta, chip = null, icono = null, valor, claseValor = "", desc = null }) {
  return el("div", { class: `kpi ${clase}`.trim() }, [
    el("span", { class: "kpi-etiqueta" }, [
      icono ? el("span", { class: "kpi-etiqueta-icono" }, [icono()]) : null,
      el("span", { text: etiqueta }),
      chip ? el("span", { class: "kpi-chip", text: chip }) : null,
    ]),
    el("span", { class: `kpi-valor ${claseValor}`.trim(), text: valor }),
    desc ? el("span", { class: "kpi-desc", text: desc }) : null,
  ]);
}

function seccionKpis(referencia, anteriorConDatos) {
  const { ingresos, gastos, balance } = referencia.totales;
  const cmp = compararAlMismoPunto(referencia, anteriorConDatos);
  // Referencia del período anterior: al mismo día si el actual está en
  // curso; total si ya cerró.
  let refAnterior = null;
  if (cmp.disponible) {
    refAnterior = { texto: `${capitaliza(cmp.anterior.etiquetaCorta)} a esta altura`, punto: cmp.punto };
  } else if (!referencia.enCurso && anteriorConDatos) {
    refAnterior = { texto: capitaliza(anteriorConDatos.etiquetaCorta), punto: anteriorConDatos.totales };
  }

  const cuarta = (() => {
    const proy = proyeccionCierre(referencia);
    if (proy) {
      return kpi({
        clase: "kpi--estimacion",
        etiqueta: "Proyección al cierre",
        chip: "Estimación",
        valor: valorOculto(proy.proyBalance),
        claseValor: proy.proyBalance < 0 ? "valor-gasto" : "valor-ingreso",
        desc: `Según tu ritmo de ${referencia.diaCorte} ${referencia.diaCorte === 1 ? "día" : "días"}`,
      });
    }
    const dias = Math.max(referencia.diaCorte, 1);
    return kpi({
      icono: relojIcono,
      etiqueta: "Gasto diario promedio",
      valor: valorOculto(gastos / dias),
      desc: `En ${dias} ${dias === 1 ? "día" : "días"}`,
    });
  })();

  return el("section", { class: "kpis", "aria-label": "Totales del período" }, [
    kpi({
      clase: "kpi--destacado",
      etiqueta: referencia.enCurso ? "Balance actual" : "Balance final",
      valor: valorOculto(balance),
      desc: referencia.enCurso ? `Al día ${referencia.diaCorte}` : "Ingresos − gastos",
    }),
    kpi({
      clase: "kpi--ingreso",
      icono: flechaArribaCirculo,
      etiqueta: "Ingresos",
      valor: valorOculto(ingresos),
      desc: refAnterior ? `${refAnterior.texto}: ${valorOculto(refAnterior.punto.ingresos)}` : null,
    }),
    kpi({
      clase: "kpi--gasto",
      icono: flechaAbajoCirculo,
      etiqueta: "Gastos",
      valor: valorOculto(gastos),
      desc: refAnterior ? `${refAnterior.texto}: ${valorOculto(refAnterior.punto.gastos)}` : null,
    }),
    cuarta,
  ]);
}

// --- 4. Período actual vs. anterior (gasto acumulado) --------------------------

function valorEje(valor) {
  return prefs.get("ocultarTotal") ? "•••" : formatoCLPCompacto(valor);
}

function graficoComparacion(referencia, anterior) {
  const M = medidasGrafico();
  const anchoTrazo = M.ancho - M.izq - M.der;
  const altoTrazo = M.alto - M.top - M.inf;
  const diasEje = Math.max(referencia.diasTotales, anterior.diasTotales);
  const visibles = referencia.enCurso ? referencia.diaCorte : referencia.diasTotales;
  const serieRef = referencia.serie.slice(0, visibles);
  const serieAnt = anterior.serie;

  const escala = ticksAgradables(0, Math.max(1, ...serieAnt.map((p) => p.gastos), ...serieRef.map((p) => p.gastos)), M.movil ? 4 : 5);
  const x = (dia) => M.izq + ((dia - 1) / (diasEje - 1 || 1)) * anchoTrazo;
  const y = (v) => M.top + altoTrazo - ((v - escala.min) / (escala.max - escala.min)) * altoTrazo;

  const nodos = [];
  for (const v of escala.ticks) {
    nodos.push(
      elSvg("line", { x1: M.izq, y1: y(v), x2: M.ancho - M.der, y2: y(v), class: v === 0 ? "evo-cero" : "evo-grid" }),
      elSvg("text", { x: M.izq - 8, y: y(v) + 4, class: "evo-eje-valor" }, [valorEje(v)])
    );
  }
  for (const i of indicesEtiquetas(diasEje, M.movil ? 4 : 7)) {
    nodos.push(elSvg("text", { x: x(i + 1), y: M.alto - 8, class: "evo-eje-etiqueta" }, [`día ${i + 1}`]));
  }

  const puntosLinea = (serie) => serie.map((p) => `${x(p.dia).toFixed(1)},${y(p.gastos).toFixed(1)}`).join(" ");
  nodos.push(
    elSvg("polyline", { points: puntosLinea(serieAnt), class: "cmp-linea cmp-linea--anterior" }),
    elSvg("polyline", { points: puntosLinea(serieRef), class: "cmp-linea cmp-linea--actual" })
  );

  // Día de corte: hoy si el período sigue en curso; si no, el último día
  // que ambos períodos tienen.
  const corte = referencia.enCurso ? referencia.diaCorte : Math.min(referencia.diasTotales, anterior.diasTotales);
  const vAnt = serieAnt[Math.min(corte, serieAnt.length) - 1]?.gastos ?? 0;
  const vRef = serieRef[Math.min(corte, serieRef.length) - 1]?.gastos ?? 0;
  const xc = x(corte);

  if (referencia.enCurso) {
    nodos.push(
      elSvg("line", { x1: xc, y1: M.top, x2: xc, y2: M.top + altoTrazo, class: "cmp-hoy" }),
      elSvg("text", { x: xc, y: M.top - 8, class: "cmp-hoy-etiqueta" }, [`Hoy · día ${corte}`])
    );
  }

  // Diferencia escrita junto al corte (una llave vertical entre ambas
  // curvas), para que la conclusión se lea sin pasar el cursor.
  const diff = vRef - vAnt;
  if (diff !== 0) {
    const derecha = xc < M.izq + anchoTrazo * 0.7;
    const xb = xc + (derecha ? 14 : -14);
    const yA = y(vAnt);
    const yR = y(vRef);
    const clase = diff < 0 ? "cmp-llave--bien" : "cmp-llave--mal";
    const anchor = derecha ? "start" : "end";
    const xt = xb + (derecha ? 10 : -10);
    const ym = (yA + yR) / 2;
    nodos.push(
      elSvg("line", { x1: xb, y1: yA, x2: xb, y2: yR, class: `cmp-llave ${clase}` }),
      elSvg("line", { x1: xb - 4, y1: yA, x2: xb + 4, y2: yA, class: `cmp-llave ${clase}` }),
      elSvg("line", { x1: xb - 4, y1: yR, x2: xb + 4, y2: yR, class: `cmp-llave ${clase}` }),
      elSvg("text", { x: xt, y: ym, class: `cmp-diff ${clase}`, "text-anchor": anchor }, [
        `${diff < 0 ? "−" : "+"}${valorOculto(Math.abs(diff))}`,
      ]),
      elSvg("text", { x: xt, y: ym + 16, class: "cmp-diff-sub", "text-anchor": anchor }, [
        `${diff < 0 ? "menos" : "más"} que ${anterior.etiquetaCorta}`,
      ])
    );
  }
  nodos.push(
    elSvg("circle", { cx: xc, cy: y(vAnt), r: 5, class: "cmp-punto cmp-punto--anterior" }),
    elSvg("circle", { cx: xc, cy: y(vRef), r: 5, class: "cmp-punto cmp-punto--actual" })
  );

  const guia = elSvg("line", { x1: 0, y1: M.top, x2: 0, y2: M.top + altoTrazo, class: "vsgrafico-guia" });
  nodos.push(guia);

  const tooltip = crearTooltip();
  const etqRef = capitaliza(referencia.etiquetaCorta);
  const etqAnt = capitaliza(anterior.etiquetaCorta);
  function mostrar(dia) {
    const cx = x(dia);
    guia.setAttribute("x1", cx);
    guia.setAttribute("x2", cx);
    guia.classList.add("vsgrafico-guia--activa");
    const a = serieAnt[dia - 1];
    const r = serieRef[dia - 1];
    const filas = [];
    if (r) filas.push({ clase: "actual", nombre: etqRef, valor: valorOculto(r.gastos) });
    if (a) filas.push({ clase: "anterior", nombre: etqAnt, valor: valorOculto(a.gastos) });
    if (a && r) filas.push({ clase: "balance", nombre: "Diferencia", valor: valorOculto(r.gastos - a.gastos) });
    tooltip.mostrar(cx, M.ancho, `Gasto acumulado al día ${dia}`, filas, r ? null : `${etqRef} aún no llega a este día`);
  }
  function ocultar() {
    guia.classList.remove("vsgrafico-guia--activa");
    tooltip.ocultar();
  }
  const ancho = anchoTrazo / Math.max(diasEje - 1, 1);
  const zonas = Array.from({ length: diasEje }, (_, i) =>
    elSvg("rect", {
      x: x(i + 1) - ancho / 2,
      y: M.top,
      width: ancho,
      height: altoTrazo,
      class: "vsgrafico-zona",
      onMouseenter: () => mostrar(i + 1),
      onClick: () => mostrar(i + 1),
    })
  );

  const svg = elSvg(
    "svg",
    {
      viewBox: `0 0 ${M.ancho} ${M.alto}`,
      class: "evo-svg",
      role: "img",
      "aria-label": `Gasto acumulado por día: ${referencia.etiqueta} comparado con ${anterior.etiqueta}`,
    },
    [...nodos, ...zonas]
  );
  return el("div", { class: "vsgrafico-lienzo evo-lienzo", onMouseleave: ocultar }, [svg, tooltip.nodo]);
}

function resumenAlCorte(etiqueta, punto, actual) {
  return el("div", { class: `cmp-resumen${actual ? " cmp-resumen--actual" : ""}` }, [
    el("span", { class: "cmp-resumen-etq", text: etiqueta }),
    el("span", { class: "cmp-resumen-txt" }, [
      `Ingresos ${valorOculto(punto.ingresos)} · Gastos ${valorOculto(punto.gastos)} · Balance `,
      el("span", { class: punto.balance < 0 ? "valor-gasto" : "valor-ingreso", text: valorOculto(punto.balance) }),
    ]),
  ]);
}

function seccionComparacion(referencia, anteriorConDatos) {
  if (!anteriorConDatos) {
    return el("section", { class: "panel-tarjeta reportes-cmp" }, [
      tarjetaHead(subidaIcono, "Comparación con el período anterior", "Gasto acumulado día a día."),
      el("p", { class: "vacio", text: "Todavía no hay un período anterior con datos para comparar." }),
    ]);
  }
  if (referencia.sinDatos) {
    return el("section", { class: "panel-tarjeta reportes-cmp" }, [
      tarjetaHead(subidaIcono, "Comparación con el período anterior", "Gasto acumulado día a día."),
      el("p", { class: "vacio", text: "Todavía no hay datos de este período." }),
    ]);
  }
  const etqRef = capitaliza(referencia.etiquetaCorta);
  const etqAnt = anteriorConDatos.etiquetaCorta;
  const corte = referencia.enCurso
    ? referencia.diaCorte
    : Math.min(referencia.diasTotales, anteriorConDatos.diasTotales);
  const leyenda = el("ul", { class: "evo-leyenda" }, [
    el("li", {}, [el("span", { class: "evo-leyenda-linea evo-leyenda-linea--actual" }), etqRef]),
    el("li", {}, [el("span", { class: "evo-leyenda-linea evo-leyenda-linea--anterior" }), capitaliza(etqAnt)]),
  ]);
  return el("section", { class: "panel-tarjeta reportes-cmp" }, [
    el("div", { class: "evo-cabecera" }, [
      el("div", { class: "resumen-card-head-txt" }, [
        el("h3", {}, [iconoTitulo(subidaIcono), `${etqRef} vs. ${etqAnt}`]),
        el("p", { class: "resumen-card-sub", text: "Gasto acumulado día a día." }),
      ]),
      leyenda,
    ]),
    graficoComparacion(referencia, anteriorConDatos),
    el("div", { class: "cmp-resumenes" }, [
      resumenAlCorte(`${capitaliza(etqAnt)} al día ${corte}`, anteriorConDatos.serie[Math.min(corte, anteriorConDatos.diasTotales) - 1], false),
      resumenAlCorte(`${etqRef} al día ${corte}`, referencia.serie[corte - 1], true),
    ]),
  ]);
}

// --- 5. Historial (gráfico o tabla) ----------------------------------------------

function graficoHistorial(periodos) {
  const M = medidasGrafico();
  const anchoTrazo = M.ancho - M.izq - M.der;
  const altoTrazo = M.alto - M.top - M.inf - 30;
  const maxV = Math.max(1, ...periodos.flatMap((p) => [p.totales.ingresos, p.totales.gastos]));
  const escala = ticksAgradables(0, maxV, M.movil ? 4 : 5);
  const y = (v) => M.top + 16 + altoTrazo - (v / escala.max) * altoTrazo;
  const slot = anchoTrazo / periodos.length;
  const barra = Math.min(slot * 0.3, M.movil ? 26 : 64);

  const nodos = [];
  for (const v of escala.ticks) {
    nodos.push(
      elSvg("line", { x1: M.izq, y1: y(v), x2: M.ancho - M.der, y2: y(v), class: v === 0 ? "evo-cero" : "evo-grid" }),
      elSvg("text", { x: M.izq - 8, y: y(v) + 4, class: "evo-eje-valor" }, [valorEje(v)])
    );
  }
  periodos.forEach((p, i) => {
    const cx = M.izq + slot * (i + 0.5);
    const { ingresos, gastos, balance } = p.totales;
    const enCurso = p.esReferencia && p.enCurso;
    nodos.push(
      elSvg("rect", { x: cx - barra - 3, y: y(ingresos), width: barra, height: y(0) - y(ingresos), rx: 4, class: "hist-barra hist-barra--ingreso" }, [
        elSvg("title", {}, [`Ingresos ${p.etiqueta}: ${valorOculto(ingresos)}`]),
      ]),
      elSvg("rect", { x: cx + 3, y: y(gastos), width: barra, height: y(0) - y(gastos), rx: 4, class: "hist-barra hist-barra--gasto" }, [
        elSvg("title", {}, [`Gastos ${p.etiqueta}: ${valorOculto(gastos)}`]),
      ]),
      elSvg("text", { x: cx, y: Math.min(y(ingresos), y(gastos)) - 10, class: `hist-balance ${balance < 0 ? "hist-balance--neg" : "hist-balance--pos"}` }, [
        valorOculto(balance),
      ]),
      elSvg("text", { x: cx, y: M.alto - 18, class: "hist-mes" }, [capitaliza(p.etiquetaCorta)]),
      elSvg("text", { x: cx, y: M.alto - 4, class: "hist-nota" }, [enCurso ? `al día ${p.diaCorte}` : "cerrado"])
    );
  });
  return el("div", { class: "evo-lienzo" }, [
    elSvg("svg", { viewBox: `0 0 ${M.ancho} ${M.alto}`, class: "evo-svg", role: "img", "aria-label": "Ingresos, gastos y balance por período" }, nodos),
  ]);
}

function tablaHistorial(periodos) {
  return el("div", { class: "reportes-tabla-wrap" }, [
    el("table", { class: "reportes-tabla hist-tabla" }, [
      el("thead", {}, [
        el("tr", {}, [
          el("th", { scope: "col", text: "Período" }),
          el("th", { scope: "col", text: "Ingresos" }),
          el("th", { scope: "col", text: "Gastos" }),
          el("th", { scope: "col", text: "Balance" }),
        ]),
      ]),
      el(
        "tbody",
        {},
        periodos.map((p) =>
          el("tr", {}, [
            el("th", { scope: "row" }, [
              capitaliza(p.etiqueta),
              p.esReferencia && p.enCurso ? el("span", { class: "reportes-tag-actual", text: `al día ${p.diaCorte}` }) : null,
            ]),
            el("td", { text: valorOculto(p.totales.ingresos) }),
            el("td", { text: valorOculto(p.totales.gastos) }),
            el("td", { class: p.totales.balance < 0 ? "valor-gasto" : "valor-ingreso", text: valorOculto(p.totales.balance) }),
          ])
        )
      ),
    ]),
  ]);
}

function seccionHistorial(periodos, vista, onCambiarVista) {
  const conDatos = periodos.filter((p) => !p.sinDatos);
  // Los períodos sin datos AL INICIO (antes de que se empezara a usar la
  // app) no se dibujan: se resume en una nota. Los huecos intermedios sí
  // quedan como "Sin datos" en la tabla para no esconder un mes vacío real.
  const primero = periodos.findIndex((p) => !p.sinDatos);
  const visibles = primero >= 0 ? periodos.slice(primero) : [];
  const nota =
    primero > 0 ? `Tus registros empiezan en ${visibles[0].etiqueta}.` : `Últimos ${periodos.length} períodos.`;

  const selector = el(
    "div",
    { class: "selector-tipo evo-selector", role: "group", "aria-label": "Ver como" },
    [
      ["grafico", "Gráfico"],
      ["tabla", "Tabla"],
    ].map(([clave, texto]) =>
      el("button", {
        type: "button",
        class: vista === clave ? "activo" : "",
        "aria-pressed": String(vista === clave),
        text: texto,
        onClick: () => onCambiarVista(clave),
      })
    )
  );

  const cabecera = el("div", { class: "evo-cabecera" }, [
    el("div", { class: "resumen-card-head-txt" }, [
      el("h3", {}, [iconoTitulo(graficoIcono), "Historial"]),
      el("p", { class: "resumen-card-sub", text: nota }),
    ]),
    vista === "grafico" && conDatos.length
      ? el("ul", { class: "evo-leyenda" }, [
          el("li", {}, [el("span", { class: "evo-leyenda-barra evo-leyenda-barra--ingreso" }), "Ingresos"]),
          el("li", {}, [el("span", { class: "evo-leyenda-barra" }), "Gastos"]),
        ])
      : null,
    conDatos.length ? selector : null,
  ]);

  if (!conDatos.length) {
    return el("section", { class: "panel-tarjeta reportes-hist" }, [
      cabecera,
      el("p", { class: "vacio", text: "Sin datos registrados en estos períodos." }),
    ]);
  }

  const cuerpo =
    vista === "tabla"
      ? tablaHistorial(visibles.map((p) => (p.sinDatos ? { ...p, totales: { ingresos: 0, gastos: 0, balance: 0 } } : p)))
      : graficoHistorial(visibles);
  return el("section", { class: "panel-tarjeta reportes-hist" }, [cabecera, cuerpo]);
}

// --- Vista -------------------------------------------------------------------

function lineaPeriodo(referencia) {
  const { etiqueta, enCurso, diaCorte, diasTotales, pct } = referencia;
  const relleno = el("span", { class: "reportes-periodo-relleno" });
  relleno.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  return el("div", { class: "reportes-periodo" }, [
    el("span", {
      text: enCurso ? `${capitaliza(etiqueta)} · día ${diaCorte} de ${diasTotales}` : `${capitaliza(etiqueta)} · período cerrado`,
    }),
    enCurso
      ? el(
          "span",
          {
            class: "reportes-periodo-barra",
            role: "progressbar",
            "aria-label": "Avance del período",
            "aria-valuemin": "0",
            "aria-valuemax": "100",
            "aria-valuenow": String(pct),
          },
          [relleno]
        )
      : null,
    enCurso ? el("span", { text: `${pct}%` }) : null,
  ]);
}

export async function montarReportes(contenedor, { tipo, fechaRef, modo }) {
  limpiar(contenedor);

  const error = el("p", { class: "error", role: "alert" });
  const periodoLinea = el("div");
  const raiz = el("div", { class: "reportes-vista" });
  contenedor.append(
    tituloVista(reporteIcono, "Reportes", "Compara tu evolución financiera entre períodos."),
    periodoLinea,
    raiz,
    error
  );

  let datos = null;
  let vistaHistorial = "grafico";

  await cargar();

  function repintar() {
    pintar();
  }

  // Un reintento silencioso antes de mostrar el error: esta vista dispara 6
  // consultas simultáneas y una falla aislada de red es más común que un
  // error real.
  async function cargar() {
    error.textContent = "";
    try {
      datos = await cargarPeriodos(fechaRef, tipo, modo);
      pintar();
    } catch (e) {
      try {
        datos = await cargarPeriodos(fechaRef, tipo, modo);
        pintar();
      } catch (e2) {
        limpiar(raiz);
        error.textContent = "No se pudieron cargar los reportes. ";
        error.append(el("button", { text: "Reintentar", onClick: cargar }));
      }
    }
  }

  function pintar() {
    if (!datos) return;
    limpiar(raiz);
    limpiar(periodoLinea);

    const referencia = datos[datos.length - 1];
    const anteriores = datos.slice(0, -1);
    const anteriorConDatos = [...anteriores].reverse().find((p) => !p.sinDatos) || null;

    periodoLinea.append(lineaPeriodo(referencia));
    raiz.append(
      seccionConclusion(generarConclusion(referencia, anteriorConDatos)),
      seccionKpis(referencia, anteriorConDatos),
      seccionComparacion(referencia, anteriorConDatos),
      seccionHistorial(datos, vistaHistorial, (v) => {
        vistaHistorial = v;
        pintar();
      })
    );
  }

  return { repintar };
}
