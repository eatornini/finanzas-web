import { el, elSvg, limpiar } from "./dom.js";
import { listarMovimientos } from "../data/movimientos.js";
import { filtrarParaCalculos, calcularTotales } from "../logic/totales.js";
import { formatoCLP } from "../logic/dinero.js";
import { prefs } from "../prefs.js";
import { periodoAnterior, rangoPeriodo, etiquetaPeriodo, etiquetaCorta } from "../logic/periodos.js";
import { fechasTendencia, calcularVariacion } from "../logic/reportes.js";
import { reporteIcono, graficoIcono, tendenciaCombinadaIcono } from "./iconos.js";
import { tituloVista, iconoTitulo } from "./tituloVista.js";

function valorOculto(valor) {
  return prefs.get("ocultarTotal") ? "*****" : formatoCLP(valor);
}

// invertir: true para métricas donde subir es malo (Gastos).
function tarjetaComparativa(titulo, actual, anterior, claseBase, invertir = false) {
  const { porcentaje } = calcularVariacion(actual, anterior);
  let textoDelta = "— vs. período anterior";
  let claseDelta = "";
  if (porcentaje !== null) {
    const signo = porcentaje > 0 ? "▲" : porcentaje < 0 ? "▼" : "•";
    textoDelta = `${signo} ${Math.abs(Math.round(porcentaje))}% vs. período anterior`;
    if (porcentaje !== 0) {
      const positivo = invertir ? porcentaje < 0 : porcentaje > 0;
      claseDelta = positivo ? "tarjeta-delta--positivo" : "tarjeta-delta--negativo";
    }
  }
  return el("div", { class: `tarjeta ${claseBase}` }, [
    el("span", { class: "titulo", text: titulo }),
    el("span", { class: "valor", text: valorOculto(actual) }),
    el("span", { class: `tarjeta-delta ${claseDelta}`.trim(), text: textoDelta }),
  ]);
}

function itemLeyendaTendencia(clasePunto, texto) {
  return el("li", {}, [el("span", { class: `tendencia-leyenda-punto ${clasePunto}` }), texto]);
}

function construirGraficoTendencia(serie) {
  const maxValor = Math.max(0, ...serie.flatMap((s) => [s.ingresos, s.gastos]));
  if (maxValor <= 0) {
    return el("p", { class: "vacio", text: "Sin movimientos en este rango." });
  }

  const ancho = 200;
  const alto = 60;
  const base = 42;
  const altoMax = 32;
  const anchoGrupo = ancho / serie.length;
  const anchoBarra = anchoGrupo * 0.32;

  const nodosBarras = [];
  const puntosBalance = [];
  const nodosBalance = [];
  serie.forEach((s, i) => {
    const cx = i * anchoGrupo + anchoGrupo / 2;
    const altoIngreso = Math.max((s.ingresos / maxValor) * altoMax, s.ingresos > 0 ? 1 : 0);
    const altoGasto = Math.max((s.gastos / maxValor) * altoMax, s.gastos > 0 ? 1 : 0);
    nodosBarras.push(
      elSvg("rect", {
        x: cx - anchoBarra - 1,
        y: base - altoIngreso,
        width: anchoBarra,
        height: altoIngreso,
        class: "tendencia-barra tendencia-barra--ingreso",
      }),
      elSvg("rect", {
        x: cx + 1,
        y: base - altoGasto,
        width: anchoBarra,
        height: altoGasto,
        class: "tendencia-barra tendencia-barra--gasto",
      }),
      elSvg("text", { x: cx, y: base + 9, class: "tendencia-eje-etiqueta" }, [s.etiqueta])
    );
    // Balance neto (ingresos - gastos) en la misma escala que las barras;
    // el cero cae en `base`: el punto sube si el período cerró en positivo
    // y baja si cerró en rojo. Se acota para no pisar las etiquetas del eje.
    const cy = Math.min(Math.max(base - (s.balance / maxValor) * altoMax, 3), base + 5);
    puntosBalance.push(`${cx.toFixed(1)},${cy.toFixed(1)}`);
    nodosBalance.push(elSvg("circle", { cx, cy, r: 1.1, class: "tendencia-punto-balance" }));
  });

  const nodos = [
    elSvg("line", { x1: 0, y1: base, x2: ancho, y2: base, class: "tendencia-cero" }),
    ...nodosBarras,
    elSvg("polyline", { points: puntosBalance.join(" "), class: "tendencia-linea-balance" }),
    ...nodosBalance,
  ];

  return el("div", { class: "tendencia-grafico" }, [
    el("ul", { class: "tendencia-leyenda" }, [
      itemLeyendaTendencia("tendencia-leyenda-punto--ingreso", "Ingresos"),
      itemLeyendaTendencia("tendencia-leyenda-punto--gasto", "Gastos"),
      itemLeyendaTendencia("tendencia-leyenda-punto--balance", "Balance neto"),
    ]),
    elSvg("svg", { viewBox: `0 0 ${ancho} ${alto}` }, nodos),
  ]);
}

export async function montarReportes(contenedor, { rango, tipo, fechaRef, modo }) {
  limpiar(contenedor);

  const error = el("p", { class: "error", role: "alert" });
  const comparativa = el("section", { class: "panel-tarjeta" });
  const tendencia = el("section", { class: "panel-tarjeta" });
  contenedor.append(
    tituloVista(reporteIcono, "Reportes", "Analiza y compara la evolución de tus finanzas."),
    el("div", { class: "reportes-vista" }, [comparativa, tendencia]),
    error
  );

  await cargar();

  async function cargar() {
    error.textContent = "";
    try {
      await Promise.all([cargarComparativa(), cargarTendencia()]);
    } catch (e) {
      limpiar(comparativa);
      limpiar(tendencia);
      error.textContent = "No se pudieron cargar los reportes. ";
      error.append(el("button", { text: "Reintentar", onClick: cargar }));
    }
  }

  async function cargarComparativa() {
    const fechaAnterior = periodoAnterior(fechaRef, tipo);
    const rangoAnterior = rangoPeriodo(fechaAnterior, tipo);
    const incluirInactivos = prefs.get("incluirInactivos");

    const [actualMovs, anteriorMovs] = await Promise.all([
      listarMovimientos({ ...rango, modo }),
      listarMovimientos({ ...rangoAnterior, modo }),
    ]);
    const actual = calcularTotales(filtrarParaCalculos(actualMovs, { modo, incluirInactivos }));
    const anterior = calcularTotales(filtrarParaCalculos(anteriorMovs, { modo, incluirInactivos }));

    limpiar(comparativa);
    comparativa.append(
      el("h3", {}, [
        iconoTitulo(graficoIcono),
        `${etiquetaPeriodo(fechaRef, tipo)} vs. ${etiquetaPeriodo(fechaAnterior, tipo)}`,
      ]),
      el("div", { class: "comparativa-tarjetas" }, [
        tarjetaComparativa("Ingresos", actual.ingresos, anterior.ingresos, "ingreso"),
        tarjetaComparativa("Gastos", actual.gastos, anterior.gastos, "gasto", true),
        tarjetaComparativa(
          "Balance",
          actual.balance,
          anterior.balance,
          actual.balance >= 0 ? "ingreso" : "gasto"
        ),
      ])
    );
  }

  async function cargarTendencia() {
    const fechas = fechasTendencia(fechaRef, tipo, 6);
    const incluirInactivos = prefs.get("incluirInactivos");
    const listas = await Promise.all(
      fechas.map((f) => listarMovimientos({ ...rangoPeriodo(f, tipo), modo }))
    );
    const serie = fechas.map((f, i) => {
      const t = calcularTotales(filtrarParaCalculos(listas[i], { modo, incluirInactivos }));
      return {
        etiqueta: etiquetaCorta(f, tipo),
        ingresos: t.ingresos,
        gastos: t.gastos,
        balance: t.balance,
      };
    });

    limpiar(tendencia);
    tendencia.append(
      el("h3", {}, [iconoTitulo(tendenciaCombinadaIcono), "Tendencia"]),
      construirGraficoTendencia(serie)
    );
  }
}
