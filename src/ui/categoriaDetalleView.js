// Detalle de una categoría: se abre al hacer clic en una fila del bloque
// "Gastos por categoría" de Resumen (ver resumenView.js). Reutiliza al
// máximo piezas ya existentes (tarjetaHead, fila de movimientos, agrupación
// por fecha) para sentirse como una extensión natural de Resumen, no como
// una pantalla aparte.
import { el, limpiar } from "./dom.js";
import { listarMovimientos } from "../data/movimientos.js";
import { listarCategorias } from "../data/categorias.js";
import { fila } from "./movimientosView.js";
import { filtrarParaCalculos, calcularTotales } from "../logic/totales.js";
import { agruparPorFecha } from "../logic/agrupacionMovimientos.js";
import { etiquetaDia, etiquetaPeriodo } from "../logic/periodos.js";
import { formatoCLP } from "../logic/dinero.js";
import { prefs } from "../prefs.js";
import { nodoIconoCategoria } from "./iconoCategoria.js";
import {
  flechaIzq,
  lupaIcono,
  dolarCirculoIcono,
  calendarioIcono,
  flechaArribaCirculo,
  intercambioIcono,
  chevronAbajo,
} from "./iconos.js";
import {
  tarjetaHead,
  etiquetaSemana,
  agruparGastosPorSemana,
  estadoSemana,
} from "./resumenView.js";

function valorOculto(valor) {
  return prefs.get("ocultarTotal") ? "*****" : formatoCLP(valor);
}

function ymdLocal(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Misma pieza visual que las tarjetas Ingresos/Gastos/Balance de Resumen,
// pero recibe el valor ya formateado (acá "Movimientos" es un conteo, no un
// monto — no tiene sentido pasarlo por formatoCLP). `claseDesc` opcional
// para el detalle de "Mayor gasto" (nombre de comercio, más largo).
function tarjetaMetrica(fabricaIcono, claseIcono, nombre, valorTexto, desc, claseDesc = "") {
  return el("div", { class: "metrica-tarjeta" }, [
    el("span", { class: `metrica-icono metrica-icono--${claseIcono}` }, [fabricaIcono()]),
    el("div", { class: "metrica-cuerpo" }, [
      el("span", { class: "metrica-nombre", text: nombre }),
      el("span", { class: `metrica-valor valor-${claseIcono}`, text: valorTexto }),
      el("span", { class: `metrica-desc ${claseDesc}`.trim(), text: desc }),
    ]),
  ]);
}

// Gráfico de barras verticales: una columna por semana del mes, con el
// monto encima y el rango de fechas debajo. El color de cada barra es el de
// la propia categoría (fallback al acento si no tiene uno definido).
// Semanas futuras o sin gasto no muestran una barra de "$0" (ruido visual
// engañoso) — un estado discreto en su lugar. La altura de las barras reales
// escala contra la semana con más gasto entre las que sí ocurrieron.
function seccionSemanas(movimientosCategoria, rango, nombreCategoria, enPeriodo, color) {
  const hoy = ymdLocal(new Date());
  const semanas = agruparGastosPorSemana(movimientosCategoria, rango).map((s) => ({
    ...s,
    estado: estadoSemana(s, hoy),
  }));
  const conDatos = semanas.filter((s) => s.estado !== "futura");
  const maxTotal = conDatos.length ? Math.max(...conDatos.map((s) => s.total)) : 0;
  const colorBarra = color || "var(--acento)";

  const columnas = semanas.map((s) => {
    if (s.estado === "futura") {
      return el("div", { class: "catdet-semanas-col catdet-semanas-col--vacia" }, [
        el("span", { class: "catdet-semanas-estado", text: "Aún no disponible" }),
        el("div", { class: "catdet-semanas-pista" }),
        el("span", { class: "catdet-semanas-etq", text: etiquetaSemana(s) }),
      ]);
    }
    if (s.total <= 0) {
      return el("div", { class: "catdet-semanas-col catdet-semanas-col--vacia" }, [
        el("span", { class: "catdet-semanas-estado", text: "Sin actividad" }),
        el("div", { class: "catdet-semanas-pista" }),
        el("span", { class: "catdet-semanas-etq", text: etiquetaSemana(s) }),
      ]);
    }
    const alturaPct = maxTotal > 0 ? Math.max((s.total / maxTotal) * 100, 4) : 2;
    const relleno = el("span", { class: "catdet-semanas-relleno" });
    relleno.style.height = `${alturaPct}%`;
    relleno.style.background = colorBarra;
    return el(
      "div",
      { class: "catdet-semanas-col", title: `${etiquetaSemana(s)}: ${valorOculto(s.total)}` },
      [
        el("span", { class: "catdet-semanas-monto", text: valorOculto(s.total) }),
        el("div", { class: "catdet-semanas-pista" }, [relleno]),
        el("span", { class: "catdet-semanas-etq", text: etiquetaSemana(s) }),
      ]
    );
  });

  return el("section", { class: "panel-tarjeta catdet-semanas" }, [
    tarjetaHead(
      calendarioIcono,
      `Gastos de ${nombreCategoria} por semana`,
      `Distribución de tus gastos en ${enPeriodo}.`
    ),
    el("div", { class: "catdet-semanas-cols" }, columnas),
  ]);
}

export async function montarCategoriaDetalle(
  contenedor,
  { rango, tipo, fechaRef, modo, categoriaId, volver }
) {
  limpiar(contenedor);

  const error = el("p", { class: "error", role: "alert" });
  const raiz = el("div", { class: "resumen-vista" });
  contenedor.append(raiz);

  let todos = [];
  let categorias = [];
  let categoria = null; // se conserva entre renders por si un período no tiene movimientos

  // Igual que en Movimientos: cada bloque de fecha se puede acoplar/
  // desacoplar. Estado en memoria, no persistido — se reabre expandido cada
  // vez que se entra a la categoría. Declarado ANTES de `await cargar()`:
  // cargar() llama a pintar() en cuanto resuelve la carga inicial, así que
  // si esto quedara después del await, la primera vez pintar() se ejecuta
  // antes de que la línea corra (temporal dead zone) y el primer render
  // siempre fallaba con "No se pudo cargar la categoría".
  const colapsados = new Set();

  async function asegurarCategorias() {
    return categorias;
  }

  const buscador = el("input", {
    class: "buscador",
    type: "search",
    placeholder: "Buscar…",
  });
  const ORDENES = [
    ["fecha_desc", "Más recientes primero"],
    ["fecha_asc", "Más antiguos primero"],
    ["monto_desc", "Monto: mayor a menor"],
    ["monto_asc", "Monto: menor a mayor"],
  ];
  const selOrden = el(
    "select",
    { class: "catdet-orden" },
    ORDENES.map(([v, t]) => el("option", { value: v, text: t }))
  );
  buscador.addEventListener("input", pintar);
  selOrden.addEventListener("change", pintar);

  const btnVolver = el(
    "button",
    { type: "button", class: "enlace-ver catdet-volver" },
    [flechaIzq(), el("span", { text: "Volver a Resumen" })]
  );
  btnVolver.addEventListener("click", () => volver());

  await cargar();

  // El toggle de ocultar montos (shell.js) llama a esto en vez de volver a
  // montar la categoría entera: repinta con los datos ya cargados, sin
  // pedirlos de nuevo a la red.
  const repintar = pintar;

  async function cargar() {
    error.textContent = "";
    try {
      const [movs, cats] = await Promise.all([
        listarMovimientos({ ...rango, modo }),
        listarCategorias(),
      ]);
      todos = movs;
      categorias = cats;
      pintar();
    } catch (e) {
      limpiar(raiz);
      raiz.append(btnVolver, error);
      error.textContent = "No se pudo cargar la categoría. ";
      error.append(el("button", { text: "Reintentar", onClick: cargar }));
    }
  }

  function encabezado(nombreCategoria, enPeriodo) {
    const color = categoria?.color || "var(--acento)";
    const iconoWrap = el("span", { class: "vista-titulo-icono" }, [
      nodoIconoCategoria(categoria, nombreCategoria),
    ]);
    iconoWrap.style.color = color;
    iconoWrap.style.background = `color-mix(in srgb, ${color} 12%, transparent)`;

    return el("header", { class: "vista-titulo" }, [
      iconoWrap,
      el("div", { class: "vista-titulo-cuerpo" }, [
        el("h2", { class: "vista-titulo-txt", text: nombreCategoria }),
        el("p", {
          class: "vista-titulo-sub",
          text: `${enPeriodo} · Gastos de la categoría`,
        }),
      ]),
    ]);
  }

  // `filasWrap` es el contenedor de las filas de ese grupo — el toggle
  // muestra/oculta ese nodo directamente (sin volver a llamar a pintar()):
  // repintar toda la pantalla en cada clic colapsaba momentáneamente el
  // alto del documento y el navegador reseteaba el scroll a 0.
  function cabeceraGrupo(grupo, filasWrap) {
    const { balance } = calcularTotales(grupo.movimientos);
    const signo = balance >= 0 ? "+" : "−";
    const colapsado = colapsados.has(grupo.clave);
    const btn = el(
      "button",
      {
        type: "button",
        class: "lista-grupo-titulo" + (colapsado ? " colapsado" : ""),
        "aria-expanded": String(!colapsado),
      },
      [
        chevronAbajo(),
        el("span", { text: etiquetaDia(grupo.clave) }),
        el("span", {
          class: "lista-grupo-total",
          text: `${signo} ${formatoCLP(Math.abs(balance))}`,
        }),
      ]
    );
    btn.addEventListener("click", () => {
      const ahoraColapsado = !filasWrap.hidden;
      filasWrap.hidden = ahoraColapsado;
      btn.classList.toggle("colapsado", ahoraColapsado);
      btn.setAttribute("aria-expanded", String(!ahoraColapsado));
      if (ahoraColapsado) colapsados.add(grupo.clave);
      else colapsados.delete(grupo.clave);
    });
    return { btn, colapsado };
  }

  function seccionMovimientos(movimientosCategoria, nombreCategoria, enPeriodo) {
    buscador.placeholder = `Buscar en ${nombreCategoria}…`;
    const texto = buscador.value.trim().toLowerCase();
    const filtrados = movimientosCategoria.filter((m) => {
      if (!texto) return true;
      return `${m.nombre} ${m.detalle || ""}`.toLowerCase().includes(texto);
    });

    const comparadores = {
      fecha_desc: (a, b) => (b.fecha || "").localeCompare(a.fecha || ""),
      fecha_asc: (a, b) => (a.fecha || "").localeCompare(b.fecha || ""),
      monto_desc: (a, b) => Number(b.monto) - Number(a.monto),
      monto_asc: (a, b) => Number(a.monto) - Number(b.monto),
    };
    filtrados.sort(comparadores[selOrden.value] || comparadores.fecha_desc);

    const encabezadoMov = tarjetaHead(
      intercambioIcono,
      "Movimientos",
      `Movimientos de ${nombreCategoria} en ${enPeriodo}.`,
      el("div", { class: "lista-acciones catdet-mov-acciones" }, [
        el("div", { class: "campo-busqueda" }, [lupaIcono(), buscador]),
        selOrden,
      ])
    );
    encabezadoMov.classList.add("catdet-mov-head");

    const listaWrap = el("div", { class: "lista lista-grupos" });
    if (filtrados.length === 0) {
      listaWrap.append(
        el("section", { class: "panel-tarjeta" }, [
          el("p", { class: "vacio", text: "Ningún movimiento coincide con la búsqueda." }),
        ])
      );
    } else {
      // Todos los movimientos de la categoría en este período, agrupados
      // por fecha — sin límite ni "ver todos" aparte.
      for (const grupo of agruparPorFecha(filtrados)) {
        const filasWrap = el("div", { class: "lista-grupo-filas" });
        const { btn, colapsado } = cabeceraGrupo(grupo, filasWrap);
        filasWrap.hidden = colapsado;
        for (const m of grupo.movimientos) {
          filasWrap.append(fila(m, cargar, error, modo, asegurarCategorias));
        }
        const tarjeta = el("section", { class: "panel-tarjeta lista-grupo" }, [btn, filasWrap]);
        listaWrap.append(tarjeta);
      }
    }

    return el("div", { class: "catdet-movimientos" }, [encabezadoMov, listaWrap]);
  }

  function pintar() {
    limpiar(raiz);
    raiz.append(btnVolver);

    const paraTotales = filtrarParaCalculos(todos, {
      modo,
      incluirInactivos: prefs.get("incluirInactivos"),
    });
    const gastosTotalesPeriodo = calcularTotales(paraTotales).gastos;
    const movimientosCategoria = paraTotales.filter(
      (m) => m.tipo === "gasto" && String(m.categoria_id || "") === String(categoriaId)
    );

    const encontrada = movimientosCategoria.find((m) => m.categoria)?.categoria;
    if (encontrada) categoria = encontrada;
    const nombreCategoria = categoria ? categoria.nombre : "Categoría";
    const enPeriodo = etiquetaPeriodo(fechaRef, tipo);

    raiz.append(encabezado(nombreCategoria, enPeriodo), error);

    if (movimientosCategoria.length === 0) {
      raiz.append(
        el("section", { class: "panel-tarjeta" }, [
          el("p", { class: "vacio", text: "Sin movimientos de esta categoría en este período." }),
        ])
      );
      return;
    }

    const totalGastado = movimientosCategoria.reduce((s, m) => s + (Number(m.monto) || 0), 0);
    const pct =
      gastosTotalesPeriodo > 0 ? Math.round((totalGastado / gastosTotalesPeriodo) * 100) : 0;
    const diasPeriodo =
      Math.round(
        (new Date(`${rango.hasta}T00:00:00`) - new Date(`${rango.desde}T00:00:00`)) / 86400000
      ) + 1;
    const promedioDiario = diasPeriodo > 0 ? totalGastado / diasPeriodo : 0;
    const mayorMov = movimientosCategoria.reduce((a, b) =>
      Number(b.monto) > Number(a.monto) ? b : a
    );
    const numMovimientos = movimientosCategoria.length;

    raiz.append(
      el("div", { class: "resumen-metricas" }, [
        tarjetaMetrica(
          dolarCirculoIcono,
          "gasto",
          "Total gastado",
          valorOculto(totalGastado),
          `${pct}% del total de gastos`
        ),
        tarjetaMetrica(
          calendarioIcono,
          "gasto",
          "Promedio diario",
          valorOculto(promedioDiario),
          `${diasPeriodo} días`
        ),
        tarjetaMetrica(
          flechaArribaCirculo,
          "gasto",
          "Mayor gasto",
          valorOculto(Number(mayorMov.monto)),
          mayorMov.nombre,
          "metrica-desc--truncar"
        ),
        tarjetaMetrica(
          intercambioIcono,
          "balance",
          "Movimientos",
          String(numMovimientos),
          numMovimientos === 1 ? "transacción" : "transacciones"
        ),
      ])
    );

    if (tipo === "mes") {
      raiz.append(
        seccionSemanas(movimientosCategoria, rango, nombreCategoria, enPeriodo, categoria?.color)
      );
    }

    raiz.append(seccionMovimientos(movimientosCategoria, nombreCategoria, enPeriodo));
  }

  return { repintar };
}
