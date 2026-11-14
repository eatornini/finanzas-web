// Piezas compartidas de los gráficos SVG de Resumen y Reportes: tamaño del
// lienzo según el dispositivo y el tooltip flotante. Los gráficos se dibujan
// a mano (sin librerías) en un viewBox que escala al ancho del contenedor:
// en escritorio el viewBox es ancho (1000) y los textos de 12-13 unidades
// se ven de ~11-12px; en móvil se usa un viewBox angosto (360) para que el
// texto no quede diminuto al escalar.
import { el, limpiar } from "./dom.js";

export function medidasGrafico() {
  const movil = window.matchMedia("(max-width: 720px)").matches;
  return movil
    ? { movil, ancho: 360, alto: 260, izq: 46, der: 10, top: 24, inf: 30 }
    : { movil, ancho: 1000, alto: 300, izq: 64, der: 16, top: 26, inf: 32 };
}

// Tooltip: `filas` = [{ clase, nombre, valor }] (clase = color del punto:
// ingreso | gasto | balance | anterior | actual). `pista` es un texto chico
// opcional al pie (p. ej. "Clic para ver sus movimientos").
export function crearTooltip() {
  const nodo = el("div", { class: "vsgrafico-tooltip", role: "tooltip" });
  return {
    nodo,
    mostrar(xUnidades, anchoUnidades, titulo, filas, pista = null) {
      limpiar(nodo);
      nodo.append(
        el("p", { class: "vsgrafico-tooltip-titulo", text: titulo }),
        ...filas.map((f) =>
          el("div", { class: "vsgrafico-tooltip-fila" }, [
            el("span", { class: `vsgrafico-punto evo-punto--${f.clase}` }),
            el("span", { text: f.nombre }),
            el("span", { class: "vsgrafico-tooltip-valor", text: f.valor }),
          ])
        ),
        pista ? el("p", { class: "evo-tooltip-pista", text: pista }) : null
      );
      const pct = (xUnidades / anchoUnidades) * 100;
      nodo.style.left = `${pct}%`;
      nodo.style.transform = pct < 18 ? "translateX(0)" : pct > 82 ? "translateX(-100%)" : "translateX(-50%)";
      nodo.classList.add("vsgrafico-tooltip--visible");
    },
    ocultar() {
      nodo.classList.remove("vsgrafico-tooltip--visible");
    },
  };
}
