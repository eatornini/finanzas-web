// Iconos SVG inline (subconjunto de Lucide, licencia ISC), sin dependencias.
// Cada export devuelve un nodo <svg> nuevo listo para insertar como hijo de un botón.
const NS = "http://www.w3.org/2000/svg";

function svg(paths) {
  const nodo = document.createElementNS(NS, "svg");
  nodo.setAttribute("viewBox", "0 0 24 24");
  nodo.setAttribute("width", "24");
  nodo.setAttribute("height", "24");
  nodo.setAttribute("fill", "none");
  nodo.setAttribute("stroke", "currentColor");
  nodo.setAttribute("stroke-width", "2");
  nodo.setAttribute("stroke-linecap", "round");
  nodo.setAttribute("stroke-linejoin", "round");
  nodo.setAttribute("aria-hidden", "true");
  for (const d of [].concat(paths)) {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    nodo.appendChild(p);
  }
  return nodo;
}

export const flechaIzq = () => svg("M15 18l-6-6 6-6");
export const flechaDer = () => svg("M9 18l6-6-6-6");
export const salir = () =>
  svg(["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"]);
export const mas = () => svg(["M12 5v14", "M5 12h14"]);
export const lapiz = () =>
  svg(["M12 20h9", "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"]);
export const basura = () =>
  svg([
    "M3 6h18",
    "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
    "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6",
    "M10 11v6",
    "M14 11v6",
  ]);
export const check = () => svg("M20 6L9 17l-5-5");
