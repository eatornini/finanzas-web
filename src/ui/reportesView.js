import { el, elSvg, limpiar } from "./dom.js";
import { listarMovimientos } from "../data/movimientos.js";
import { filtrarParaCalculos } from "../logic/totales.js";
import { formatoCLP } from "../logic/dinero.js";
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
  calendarioIcono,
  bombillaIcono,
  subidaIcono,
} from "./iconos.js";
import { tituloVista } from "./tituloVista.js";
import { tarjetaHead } from "./resumenView.js";

function valorOculto(valor) {
  return prefs.get("ocultarTotal") ? "*****" : formatoCLP(valor);
}

function ymdLocal(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function delPeriodo(tipo) {
  if (tipo === "semana") return "de la semana";
  if (tipo === "año") return "del año";
  return "del mes";
}

function capitaliza(s) {
  return s ? `${s.charAt(0).toUpperCase()}${s.slice(1)}` : s;
}

function itemLeyendaTendencia(clasePunto, texto) {
  return el("li", {}, [el("span", { class: `tendencia-leyenda-punto ${clasePunto}` }), texto]);
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

function fraseMismoPunto(cmp) {
  if (!cmp.disponible) return null;
  const { direccion, pctGastos, diffGastos, diffBalance, anterior, diaCorte } = cmp;
  if (direccion === "igual") {
    return `Al día ${diaCorte}, tu gasto es igual al de ${anterior.etiquetaCorta} en el mismo período.`;
  }
  const verbo = direccion === "mas" ? "más" : "menos";
  const monto = valorOculto(Math.abs(diffGastos));
  const pctTxt = pctGastos !== null ? ` (${pctGastos}%)` : "";
  const calif = diffBalance < 0 ? "peor" : diffBalance > 0 ? "mejor" : "igual";
  const fraseBalance = diffBalance !== 0 ? ` Tu balance es ${valorOculto(Math.abs(diffBalance))} ${calif} que en ${anterior.etiquetaCorta}.` : "";
  return `Al día ${diaCorte}, has gastado ${monto}${pctTxt} ${verbo} que en ${anterior.etiquetaCorta} en el mismo período.${fraseBalance}`;
}

function fraseRitmo(cmp) {
  if (!cmp.disponible) return null;
  if (cmp.direccion === "mas") return `⚠️ Estás gastando más rápido que en ${cmp.anterior.etiquetaCorta}.`;
  if (cmp.direccion === "menos") return `🟢 Estás gastando más lento que en ${cmp.anterior.etiquetaCorta}.`;
  return `🔵 Tu ritmo de gasto es igual al de ${cmp.anterior.etiquetaCorta}.`;
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

// --- 2. Estado del período actual -------------------------------------------

function barraProgreso(pct) {
  const relleno = el("div", { class: "reportes-progreso-relleno" });
  relleno.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  return el("div", { class: "reportes-progreso" }, [
    el("div", { class: "reportes-progreso-pista" }, [relleno]),
  ]);
}

function metricaFila(nombre, valor, claseValor, nota) {
  return el("div", { class: "reportes-hero-metrica" }, [
    el("span", { class: "reportes-hero-metrica-nombre", text: nombre }),
    el("span", { class: `reportes-hero-metrica-valor ${claseValor}`, text: valorOculto(valor) }),
    nota ? el("span", { class: "reportes-hero-metrica-nota", text: nota }) : null,
  ]);
}

function bloqueEstadoActual(periodo) {
  const { etiqueta, diasTotales, diaCorte, pct, enCurso, totales, tipo, sinDatos } = periodo;
  const sub = enCurso
    ? `Día ${diaCorte} de ${diasTotales} · ${pct}% transcurrido ${delPeriodo(tipo)}`
    : "Período cerrado · valores finales";

  if (sinDatos) {
    return el("section", { class: "panel-tarjeta reportes-hero" }, [
      tarjetaHead(relojIcono, capitaliza(etiqueta), sub),
      enCurso ? barraProgreso(pct) : null,
      el("p", { class: "vacio", text: "Sin datos registrados en este período." }),
    ]);
  }

  const filas = [
    metricaFila("Ingresos", totales.ingresos, "valor-ingreso"),
    metricaFila("Gastos", totales.gastos, "valor-gasto"),
    metricaFila(
      enCurso ? "Balance actual" : "Balance final",
      totales.balance,
      totales.balance >= 0 ? "valor-balance" : "valor-gasto"
    ),
  ];

  if (enCurso) {
    const proy = proyeccionCierre(periodo);
    if (proy) {
      const { proyBalance, balanceDiario } = proy;
      const etiquetaRitmo = balanceDiario >= 0 ? "Ahorro neto promedio diario" : "Gasto neto promedio diario";
      filas.push(
        metricaFila(
          "Proyección al cierre",
          proyBalance,
          proyBalance >= 0 ? "valor-balance" : "valor-gasto",
          `Estimación según tu ritmo actual · ${etiquetaRitmo}: ${valorOculto(Math.abs(balanceDiario))} — no es un valor real.`
        )
      );
    }
  }

  return el("section", { class: "panel-tarjeta reportes-hero" }, [
    tarjetaHead(relojIcono, capitaliza(etiqueta), sub),
    enCurso ? barraProgreso(pct) : null,
    el("div", { class: "reportes-hero-metricas" }, filas),
  ]);
}

// --- 3. Comparación mensual --------------------------------------------------

function celdaValor(periodo, campo, claseFn) {
  if (periodo.sinDatos) {
    return el("td", { class: "reportes-tabla-sin-datos", text: "Sin datos" });
  }
  const valor = periodo.totales[campo];
  return el("td", { class: claseFn ? claseFn(valor) : "", text: valorOculto(valor) });
}

function filaTabla(nombre, periodos, campo, claseFn) {
  return el("tr", {}, [
    el("th", { text: nombre }),
    ...periodos.map((p) => celdaValor(p, campo, claseFn)),
  ]);
}

function seccionComparacionMensual(periodos) {
  const referencia = periodos[periodos.length - 1];
  const encabezados = periodos.map((p) =>
    el("th", {}, [
      p.etiquetaCorta,
      p.esReferencia && p.enCurso ? el("span", { class: "reportes-tag-actual", text: "actual" }) : null,
    ])
  );

  const tabla = el("table", { class: "reportes-tabla" }, [
    el("thead", {}, [el("tr", {}, [el("th", { text: "" }), ...encabezados])]),
    el("tbody", {}, [
      filaTabla("Ingresos", periodos, "ingresos", () => "valor-ingreso"),
      filaTabla("Gastos", periodos, "gastos", () => "valor-gasto"),
      filaTabla("Balance", periodos, "balance", (v) => (v >= 0 ? "valor-balance" : "valor-gasto")),
    ]),
  ]);

  return el("section", { class: "panel-tarjeta" }, [
    tarjetaHead(graficoIcono, "Comparación mensual", "Ingresos, gastos y balance de cada período."),
    el("div", { class: "reportes-tabla-wrap" }, [tabla]),
    referencia.enCurso
      ? el("p", {
          class: "reportes-nota",
          text: `* ${referencia.etiqueta} al día ${referencia.diaCorte} de ${referencia.diasTotales}.`,
        })
      : null,
  ]);
}

// --- 4. Comparación en el mismo punto del período ---------------------------

function tarjetaPunto(etiqueta, punto, destacado) {
  return el("div", { class: `tarjeta ${punto.balance >= 0 ? "ingreso" : "gasto"}${destacado ? " tarjeta--actual" : ""}` }, [
    el("span", { class: "titulo", text: etiqueta }),
    el("span", { class: "valor", text: valorOculto(punto.balance) }),
    el("span", {
      class: "tarjeta-delta",
      text: `${valorOculto(punto.ingresos)} ingresos · ${valorOculto(punto.gastos)} gastos`,
    }),
  ]);
}

function tarjetaPuntoSinDatos(etiqueta) {
  return el("div", { class: "tarjeta" }, [
    el("span", { class: "titulo", text: etiqueta }),
    el("span", { class: "valor valor-sin-datos", text: "Sin datos" }),
  ]);
}

// Solo compara contra períodos realmente relevantes: el inmediatamente
// anterior (aunque no tenga datos — ahí se marca "Sin datos" en vez de
// omitirlo) y, si es distinto, el más reciente que sí tenga datos. Como
// mucho 2 tarjetas de comparación + la actual, para no llenar la pantalla
// con meses de hace medio año.
function seccionMismoPunto(referencia, inmediato, anteriorConDatos) {
  if (!referencia.enCurso) return null;

  const mostrar = [];
  if (inmediato) mostrar.push(inmediato);
  if (anteriorConDatos && anteriorConDatos !== inmediato) mostrar.push(anteriorConDatos);
  if (!mostrar.length) return null;

  const diaCorte = referencia.diaCorte;
  const tarjetas = mostrar.map((p) => {
    if (p.sinDatos) return tarjetaPuntoSinDatos(p.etiquetaCorta);
    const idx = Math.min(diaCorte, p.diasTotales) - 1;
    return tarjetaPunto(p.etiquetaCorta, p.serie[idx]);
  });
  tarjetas.push(tarjetaPunto(`${referencia.etiquetaCorta} (actual)`, referencia.serie[diaCorte - 1], true));

  const cmp = compararAlMismoPunto(referencia, anteriorConDatos);
  const conclusion = fraseMismoPunto(cmp);

  return el("section", { class: "panel-tarjeta" }, [
    tarjetaHead(
      calendarioIcono,
      "Comparación al mismo punto",
      `Cómo venían los meses anteriores al llegar al día ${diaCorte}.`
    ),
    el("div", { class: "comparativa-tarjetas" }, tarjetas),
    el("p", {
      class: conclusion ? "reportes-conclusion" : "reportes-nota",
      text: conclusion || "Todavía no hay un mes anterior con datos suficientes para comparar.",
    }),
  ]);
}

// --- 5. Gráfico de balance mensual -------------------------------------------

function construirGraficoBalanceMensual(periodos) {
  const conDatos = periodos.filter((p) => !p.sinDatos);
  const maxAbs = Math.max(1, ...conDatos.map((p) => Math.abs(p.totales.balance)));
  const ancho = 220;
  const alto = 100;
  const base = 40;
  const altoMax = 26;
  const yEtiqueta = base + altoMax + 10;
  const yTag = base + altoMax + 18;
  const anchoGrupo = ancho / periodos.length;
  const anchoBarra = anchoGrupo * 0.5;

  const nodos = [elSvg("line", { x1: 0, y1: base, x2: ancho, y2: base, class: "tendencia-cero" })];
  periodos.forEach((p, i) => {
    const cx = i * anchoGrupo + anchoGrupo / 2;

    if (p.sinDatos) {
      nodos.push(
        elSvg("line", {
          x1: cx - anchoBarra / 2,
          y1: base,
          x2: cx + anchoBarra / 2,
          y2: base,
          class: "balance-barra--vacia",
        }),
        elSvg("text", { x: cx, y: yEtiqueta, class: "tendencia-eje-etiqueta" }, [p.etiquetaCorta]),
        elSvg("text", { x: cx, y: yTag, class: "balance-barra-tag" }, ["Sin datos"])
      );
      return;
    }

    const balance = p.totales.balance;
    const h = Math.max((Math.abs(balance) / maxAbs) * altoMax, balance !== 0 ? 1 : 0);
    const y = balance >= 0 ? base - h : base;
    const clase = balance >= 0 ? "balance-barra--positivo" : "balance-barra--negativo";
    const enCursoAhora = p.esReferencia && p.enCurso;
    const actual = enCursoAhora ? " balance-barra--actual" : "";
    const etiquetaValor = `${balance > 0 ? "+" : ""}${valorOculto(balance)}`;
    const yValor = balance >= 0 ? y - 3 : base + h + 7;

    nodos.push(
      elSvg("rect", {
        x: cx - anchoBarra / 2,
        y,
        width: anchoBarra,
        height: h,
        class: `balance-barra ${clase}${actual}`,
      }),
      elSvg("text", { x: cx, y: yValor, class: "balance-barra-valor" }, [etiquetaValor]),
      elSvg("text", { x: cx, y: yEtiqueta, class: "tendencia-eje-etiqueta" }, [p.etiquetaCorta]),
      elSvg("text", { x: cx, y: yTag, class: "balance-barra-tag" }, [enCursoAhora ? "En curso" : "Mes cerrado"])
    );
  });

  return el("div", { class: "tendencia-grafico" }, [elSvg("svg", { viewBox: `0 0 ${ancho} ${alto}` }, nodos)]);
}

// --- 6. Gráfico de ritmo de gastos ------------------------------------------

function construirGraficoRitmo(referencia, anteriorConDatos) {
  if (!anteriorConDatos) {
    return el("p", { class: "vacio", text: "No hay un mes anterior con datos para comparar el ritmo." });
  }

  const serieRefVisible = referencia.serie.slice(0, referencia.enCurso ? referencia.diaCorte : referencia.diasTotales);
  if (!serieRefVisible.length) {
    return el("p", { class: "vacio", text: "Todavía no hay datos de este período." });
  }

  const diasEje = Math.max(referencia.diasTotales, anteriorConDatos.diasTotales);
  const ancho = 300;
  const alto = 150;
  const mIzq = 10;
  const mDer = 10;
  const mTop = 14;
  const mInf = 26;
  const anchoTrazo = ancho - mIzq - mDer;
  const altoTrazo = alto - mTop - mInf;

  const maxValor = Math.max(1, ...anteriorConDatos.serie.map((p) => p.gastos), ...serieRefVisible.map((p) => p.gastos));
  const x = (dia) => mIzq + ((dia - 1) / (diasEje - 1 || 1)) * anchoTrazo;
  const y = (v) => mTop + altoTrazo - (v / maxValor) * altoTrazo;

  const lineaAnterior = anteriorConDatos.serie.map((p) => `${x(p.dia).toFixed(1)},${y(p.gastos).toFixed(1)}`).join(" ");
  const lineaActual = serieRefVisible.map((p) => `${x(p.dia).toFixed(1)},${y(p.gastos).toFixed(1)}`).join(" ");

  const nodos = [
    elSvg("line", { x1: mIzq, y1: mTop + altoTrazo, x2: ancho - mDer, y2: mTop + altoTrazo, class: "tendencia-cero" }),
    elSvg("polyline", { points: lineaAnterior, class: "ritmo-linea ritmo-linea--anterior" }),
    elSvg("polyline", { points: lineaActual, class: "ritmo-linea ritmo-linea--actual" }),
  ];

  if (referencia.enCurso) {
    const cxHoy = x(referencia.diaCorte);
    nodos.push(
      elSvg("line", { x1: cxHoy, y1: mTop, x2: cxHoy, y2: mTop + altoTrazo, class: "ritmo-linea-hoy" }),
      elSvg("text", { x: cxHoy, y: mTop - 3, class: "ritmo-etiqueta-hoy", "text-anchor": "middle" }, [
        `Hoy · día ${referencia.diaCorte}`,
      ])
    );
  }

  [1, Math.round(diasEje / 2), diasEje].forEach((d) => {
    nodos.push(elSvg("text", { x: x(d), y: alto - 8, class: "tendencia-eje-etiqueta" }, [`día ${d}`]));
  });

  const cmp = compararAlMismoPunto(referencia, anteriorConDatos);
  const caption = fraseRitmo(cmp);

  return el("div", { class: "tendencia-grafico" }, [
    el("ul", { class: "tendencia-leyenda" }, [
      itemLeyendaTendencia("ritmo-leyenda-punto--anterior", `${anteriorConDatos.etiquetaCorta} · gasto acumulado`),
      itemLeyendaTendencia("ritmo-leyenda-punto--actual", `${referencia.etiquetaCorta} · gasto acumulado`),
    ]),
    elSvg("svg", { viewBox: `0 0 ${ancho} ${alto}` }, nodos),
    caption ? el("p", { class: "reportes-conclusion", text: caption }) : null,
  ]);
}

// --- 7. Interpretación automática --------------------------------------------

// Cascada de candidatas en orden de relevancia: la primera que aplique es
// la conclusión principal, las siguientes (hasta 2) son el apoyo. Así la
// jerarquía siempre refleja lo más importante primero, en vez de una lista
// plana, y nunca se inventa una conclusión si falta información real.
function generarInterpretaciones(referencia, anteriorConDatos) {
  if (!referencia.enCurso) {
    if (referencia.sinDatos) {
      return { principal: { icono: "ℹ️", texto: `No hay movimientos registrados en ${referencia.etiqueta}.` }, secundarias: [] };
    }
    if (referencia.totales.balance < 0) {
      return {
        principal: {
          icono: "🔴",
          texto: `${capitaliza(referencia.etiqueta)} cerró con un balance negativo de ${valorOculto(referencia.totales.balance)}.`,
        },
        secundarias: [],
      };
    }
    if (referencia.totales.balance > 0) {
      return {
        principal: {
          icono: "🟢",
          texto: `${capitaliza(referencia.etiqueta)} cerró con un balance positivo de ${valorOculto(referencia.totales.balance)}.`,
        },
        secundarias: [],
      };
    }
    return { principal: null, secundarias: [] };
  }

  const candidatas = [];

  if (referencia.totales.gastos > 0) {
    const gastoDiario = referencia.totales.gastos / referencia.diaCorte;
    const ingresoDiario = referencia.totales.ingresos / referencia.diaCorte;
    if (gastoDiario > ingresoDiario) {
      candidatas.push({
        icono: "⚠️",
        texto: `Tus gastos están creciendo más rápido que tus ingresos en lo que va ${delPeriodo(referencia.tipo)}.`,
      });
    }
  }

  const cmp = compararAlMismoPunto(referencia, anteriorConDatos);
  const frasePunto = fraseMismoPunto(cmp);
  if (frasePunto) {
    candidatas.push({ icono: cmp.direccion === "mas" ? "🔴" : cmp.direccion === "menos" ? "🟢" : "🔵", texto: frasePunto });
  } else {
    candidatas.push({ icono: "ℹ️", texto: "Todavía no hay un mes anterior con datos suficientes para comparar tu ritmo." });
  }

  const proy = proyeccionCierre(referencia);
  if (proy) {
    const { proyBalance } = proy;
    if (proyBalance < 0) {
      candidatas.push({
        icono: "⚠️",
        texto: `Si mantienes este ritmo, podrías cerrar ${delPeriodo(referencia.tipo)} con un balance negativo cercano a ${valorOculto(proyBalance)}.`,
      });
    } else {
      candidatas.push({
        icono: "🟢",
        texto: `Si mantienes este ritmo, podrías cerrar ${delPeriodo(referencia.tipo)} con un balance positivo cercano a ${valorOculto(proyBalance)}.`,
      });
    }
  }

  if (!candidatas.length) {
    candidatas.push({ icono: "ℹ️", texto: "Todavía no hay suficiente información para interpretar este período." });
  }

  return { principal: candidatas[0], secundarias: candidatas.slice(1, 3) };
}

function seccionInterpretacion({ principal, secundarias }) {
  if (!principal) return null;
  return el("section", { class: "panel-tarjeta" }, [
    tarjetaHead(bombillaIcono, "Interpretación", null),
    el("p", { class: "reportes-interpretacion-principal" }, [
      el("span", { class: "reportes-interpretacion-icono", text: principal.icono }),
      el("span", { text: principal.texto }),
    ]),
    secundarias.length
      ? el(
          "ul",
          { class: "reportes-interpretacion-secundarias" },
          secundarias.map((n) =>
            el("li", { class: "reportes-interpretacion-item" }, [
              el("span", { class: "reportes-interpretacion-icono", text: n.icono }),
              el("span", { text: n.texto }),
            ])
          )
        )
      : null,
  ]);
}

// --- Vista -------------------------------------------------------------------

export async function montarReportes(contenedor, { tipo, fechaRef, modo }) {
  limpiar(contenedor);

  const error = el("p", { class: "error", role: "alert" });
  const raiz = el("div", { class: "reportes-vista" });
  contenedor.append(
    tituloVista(reporteIcono, "Reportes", "Compara tu evolución financiera entre meses."),
    raiz,
    error
  );

  let datos = null;

  await cargar();

  function repintar() {
    pintar();
  }

  // Igual que Resumen: un reintento silencioso antes de mostrar el error,
  // porque esta vista dispara 6 consultas simultáneas y una falla aislada
  // de red al entrar en frío a la app es más común que un error real.
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

    const referencia = datos[datos.length - 1];
    const anteriores = datos.slice(0, -1);
    const inmediato = anteriores.length ? anteriores[anteriores.length - 1] : null;
    const anteriorConDatos = [...anteriores].reverse().find((p) => !p.sinDatos) || null;

    raiz.append(bloqueEstadoActual(referencia), seccionComparacionMensual(datos));

    const mismoPunto = seccionMismoPunto(referencia, inmediato, anteriorConDatos);
    if (mismoPunto) raiz.append(mismoPunto);

    raiz.append(
      el("section", { class: "panel-tarjeta" }, [
        tarjetaHead(graficoIcono, "Balance mensual", "Balance de cada período: positivo o negativo."),
        construirGraficoBalanceMensual(datos),
      ]),
      el("section", { class: "panel-tarjeta" }, [
        tarjetaHead(subidaIcono, "Ritmo de gastos", "¿Estás gastando más rápido o más lento que antes?"),
        construirGraficoRitmo(referencia, anteriorConDatos),
      ])
    );

    const bloqueNotas = seccionInterpretacion(generarInterpretaciones(referencia, anteriorConDatos));
    if (bloqueNotas) raiz.append(bloqueNotas);
  }

  return { repintar };
}
