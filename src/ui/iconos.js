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
export const cerrarIcono = () => svg(["M18 6 6 18", "M6 6l12 12"]);
export const ojoIcono = () =>
  svg(["M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"]);
export const ojoTachadoIcono = () =>
  svg([
    "M3 3l18 18",
    "M10.6 10.6a3 3 0 0 0 4.2 4.2",
    "M9.9 4.5A9.6 9.6 0 0 1 12 4c6.5 0 10 8 10 8a17.7 17.7 0 0 1-2.4 3.4",
    "M6.6 6.6A17.8 17.8 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.1-.9",
  ]);

// --- Iconos añadidos para el rediseño ---
export const listaIcono = () =>
  svg(["M8 6h13", "M8 12h13", "M8 18h13", "M3 6h.01", "M3 12h.01", "M3 18h.01"]);
export const relojIcono = () => svg(["M12 8v4l3 3", "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"]);
export const calendarioIcono = () =>
  svg(["M8 2v4", "M16 2v4", "M3 10h18", "M4 4h16a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"]);
export const etiquetaIcono = () =>
  svg([
    "M20.59 13.41 11 3.83 3.83 11l9.58 9.58a2 2 0 0 0 2.83 0l4.35-4.35a2 2 0 0 0 0-2.82z",
    "M7 7h.01",
  ]);
export const graficoIcono = () =>
  svg(["M3 3v18h18", "M18 17V9", "M13 17V5", "M8 17v-3"]);
export const engranajeIcono = () =>
  svg([
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  ]);
export const solIcono = () =>
  svg([
    "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
    "M12 1v2", "M12 21v2", "M4.22 4.22l1.42 1.42", "M18.36 18.36l1.42 1.42",
    "M1 12h2", "M21 12h2", "M4.22 19.78l1.42-1.42", "M18.36 5.64l1.42-1.42",
  ]);
export const lunaIcono = () => svg("M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z");
export const lupaIcono = () => svg(["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M21 21l-4.35-4.35"]);
export const embudoIcono = () => svg("M22 3H2l8 9.46V19l4 2v-8.54L22 3z");
export const chevronAbajo = () => svg("M6 9l6 6 6-6");
export const puntosIcono = () => svg(["M12 6h.01", "M12 12h.01", "M12 18h.01"]);
export const camaraIcono = () =>
  svg([
    "M3 9a2 2 0 0 1 2-2h1.5l1-1.5h9l1 1.5H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
    "M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  ]);
export const flechaArribaCirculo = () => svg("M12 19V5M5 12l7-7 7 7");
export const flechaAbajoCirculo = () => svg("M12 5v14M5 12l7 7 7-7");
export const billeteraIcono = () =>
  svg([
    "M21 12V7H5a2 2 0 0 1 0-4h14v4",
    "M3 5v14a2 2 0 0 0 2 2h16v-5",
    "M18 12a2 2 0 0 0 0 4h4v-4z",
  ]);
export const combustibleIcono = () =>
  svg([
    "M3 22V9a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v13",
    "M3 13h9",
    "M14 8V5a2 2 0 0 1 2-2h1",
    "M16 8h2.5l2 2v8a1.5 1.5 0 0 1-3 0v-2a1 1 0 0 0-1-1H18",
  ]);
export const llaveIcono = () =>
  svg(
    "M14.7 6.3a4 4 0 1 1-5.66 5.66L4 17l1 1 1-1v-1h1v-1h1l1.34-1.34A4 4 0 1 1 14.7 6.3z"
  );
export const billeteIcono = () =>
  svg([
    "M3 6h18v12H3z",
    "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
    "M6 9v6", "M18 9v6",
  ]);
export const carritoIcono = () =>
  svg([
    "M2 3h2l2.68 12.39a2 2 0 0 0 2 1.61h8.64a2 2 0 0 0 2-1.61L21 8H6",
    "M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
    "M19 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  ]);
export const casaIcono = () => svg(["M3 10.5 12 3l9 7.5", "M5 9v11h14V9"]);
export const corazonIcono = () =>
  svg(
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"
  );
export const peliculaIcono = () =>
  svg(["M4 4h16v16H4z", "M4 9h16", "M4 15h16", "M9 4v16", "M15 4v16"]);
export const autoIcono = () =>
  svg([
    "M5 17h14", "M5 17a2 2 0 1 0 0-4h14a2 2 0 1 0 0 4",
    "M5 13l1.5-5h11L19 13",
  ]);
export const maletinIcono = () =>
  svg([
    "M3 7h18v13H3z", "M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2", "M3 12h18",
  ]);
