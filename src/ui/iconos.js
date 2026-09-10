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
// Arco abierto: girando con CSS (@keyframes girar) hace de spinner.
export const cargandoIcono = () => svg("M21 12a9 9 0 1 1-6.219-8.56");
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
// Lucide: sticky-note — encabezado del campo "Detalle (opcional)" en el
// panel "Más opciones". Nota con la esquina inferior derecha doblada.
export const notaIcono = () =>
  svg([
    "M15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9l7-7V5a2 2 0 0 0-2-2z",
    "M14 21v-5a2 2 0 0 1 2-2h5",
    "M8 9h6",
    "M8 13h4",
  ]);
// Lucide: tag — encabezado de la sección "Categoría". Etiqueta inclinada
// con el agujero visible como anillo (no un punto suelto).
export const etiquetaIcono = () =>
  svg([
    "M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.41l8.7 8.71a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42z",
    "M8 6.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z",
  ]);
export const graficoIcono = () =>
  svg(["M3 3v18h18", "M18 17V9", "M13 17V5", "M8 17v-3"]);
// Lucide: store — encabezado de la sección "Comercio".
export const tiendaIcono = () =>
  svg([
    "M3 9l1.5-5h15L21 9",
    "M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9",
    "M3 9h18",
    "M9 20v-5h6v5",
  ]);
// Lucide: circle-dollar-sign — encabezado de la sección "Monto".
export const dolarCirculoIcono = () =>
  svg([
    "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
    "M16 8.5h-5A1.75 1.75 0 0 0 11 12h2a1.75 1.75 0 0 1 0 3.5H8",
    "M12 7v10",
  ]);
// Lucide: layout-grid — tarjeta "Todas" en la fila de categorías.
export const cuadriculaIcono = () =>
  svg(["M3 3h8v8H3z", "M13 3h8v8h-8z", "M13 13h8v8h-8z", "M3 13h8v8H3z"]);
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
export const menuIcono = () => svg(["M3 6h18", "M3 12h18", "M3 18h18"]);
export const camaraIcono = () =>
  svg([
    "M3 9a2 2 0 0 1 2-2h1.5l1-1.5h9l1 1.5H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
    "M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  ]);
export const flechaArribaCirculo = () => svg("M12 19V5M5 12l7-7 7 7");
export const flechaAbajoCirculo = () => svg("M12 5v14M5 12l7 7 7-7");
// Círculo con flecha hacia abajo — encabezado del campo "Tipo" (Gasto).
export const circuloFlechaAbajo = () =>
  svg(["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 8v8", "M8 12l4 4 4-4"]);
// Lucide: palette — encabezado del campo "Color".
export const paletaIcono = () =>
  svg([
    "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.83-.44-1.12-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.56-2.5 5.56-5.55C22 6 17.46 2 12 2z",
    "M8.5 7.5h.01",
    "M6.5 12.5h.01",
    "M13.5 6.5h.01",
    "M17.5 10.5h.01",
  ]);
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

// --- Sistema de iconos de títulos y categorías (Lucide) ---
// Añadidos para dar una iconografía coherente a los encabezados de cada
// pantalla y a los paneles/listas. Mismo estilo que el resto del archivo:
// viewBox 24, stroke 2, extremos redondeados.

// Lucide: arrow-left-right
export const intercambioIcono = () =>
  svg(["M8 3 4 7l4 4", "M4 7h16", "M16 21l4-4-4-4", "M20 17H4"]);

// Lucide: chart-no-axes-combined
export const tendenciaCombinadaIcono = () =>
  svg(["M12 16v5", "M16 14v7", "M20 10v11", "M8 10v11", "M4 18v3", "m2 14 8-6 4 3 8-7"]);

// Lucide: tags (el tercer trazo es el punto del ojal, como en puntosIcono)
export const etiquetasIcono = () =>
  svg([
    "M9.586 5.586A2 2 0 0 0 8.172 5H3a1 1 0 0 0-1 1v5.172a2 2 0 0 0 .586 1.414L8.29 18.29a2.426 2.426 0 0 0 3.42 0l3.58-3.58a2.426 2.426 0 0 0 0-3.42z",
    "m15 5 6.3 6.3a2.4 2.4 0 0 1 0 3.4L17 19",
    "M6.5 9.5h.01",
  ]);

// Lucide: file-chart-column
export const reporteIcono = () =>
  svg([
    "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z",
    "M14 2v4a2 2 0 0 0 2 2h4",
    "M8 18v-1",
    "M12 18v-4",
    "M16 18v-6",
  ]);

// Lucide: pie-chart
export const graficoTortaIcono = () =>
  svg(["M21.21 15.89A10 10 0 1 1 8 2.83", "M22 12A10 10 0 0 0 12 2v10z"]);

// Lucide: clock-3
export const reloj3Icono = () =>
  svg(["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M12 6v6h4.5"]);

// Lucide: lightbulb — "Consejo del mes"
export const bombillaIcono = () =>
  svg([
    "M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5",
    "M9 18h6",
    "M10 22h4",
  ]);

// Lucide: utensils
export const utensiliosIcono = () =>
  svg([
    "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2",
    "M7 2v20",
    "M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7",
  ]);

// Lucide: piggy-bank
export const alcanciaIcono = () =>
  svg([
    "M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z",
    "M2 9v1c0 1.1.9 2 2 2h1",
    "M16 11h.01",
  ]);

// Lucide: heart-pulse
export const saludPulsoIcono = () =>
  svg([
    "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z",
    "M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27",
  ]);

// Lucide: car (ruedas expresadas como arcos de path)
export const carroIcono = () =>
  svg([
    "M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2",
    "M5 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0z",
    "M15 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0z",
    "M9 17h6",
  ]);

// Lucide: shield-check — panel de administración
export const escudoIcono = () =>
  svg([
    "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
    "m9 12 2 2 4-4",
  ]);

// Lucide: user-plus — "crear cuenta"
export const usuarioMasIcono = () =>
  svg([
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    "M19 8v6",
    "M22 11h-6",
  ]);

// Logo de la app: "savings" de Material Symbols, relleno (FILL=1) y con
// menos peso (wght=200 en vez de 400 — el peso por defecto se veía
// demasiado grueso) — path extraído directo de la fuente vendoreada (ver
// assets/icons/icono.svg, mismo path). A diferencia de svg(), es un
// ícono sólido (fill, no stroke).
export const logoAppIcono = () => {
  const nodo = document.createElementNS(NS, "svg");
  nodo.setAttribute("viewBox", "0 0 960 960");
  nodo.setAttribute("width", "24");
  nodo.setAttribute("height", "24");
  nodo.setAttribute("aria-hidden", "true");
  const g = document.createElementNS(NS, "g");
  g.setAttribute("transform", "translate(0 960) scale(1 -1)");
  const p = document.createElementNS(NS, "path");
  p.setAttribute("fill", "currentColor");
  p.setAttribute(
    "d",
    "M259.31 160.0Q238.62 160.0 220.58 173.69Q202.54 187.38 197.08 207.31Q172.08 295.92 157.23 354.35Q142.38 412.77 134.04 453.12Q125.69 493.46 122.85 522.15Q120.0 550.85 120.0 580Q120.0 655.08 172.46 707.54Q224.92 760.0 300 760.0H520.0Q547.0 796.0 583.5 818.0Q620.0 840.0 660 840.0Q668.08 840.0 674.04 834.04Q680.0 828.08 680.0 820Q680.0 817.85 679.27 816.08Q678.54 814.31 678.08 811.62Q673.31 799.08 668.65 782.69Q664.0 766.31 658.92 737.15L776.08 620.0H807.69Q821.62 620.0 830.81 610.81Q840.0 601.62 840.0 587.69V433.85Q840.0 423.15 834.04 414.69Q828.08 406.23 817.38 402.77L734.69 375.54L683.92 206.23Q677.46 184.85 660.31 172.42Q643.15 160.0 621.54 160.0H584.62Q557.77 160.0 538.88 178.88Q520.0 197.77 520.0 224.62V240.0H360.0V224.62Q360.0 197.77 341.12 178.88Q322.23 160.0 295.38 160.0ZM260.0 200H295.38Q306.15 200 313.08 206.92Q320 213.85 320 224.62V280H560V224.62Q560 213.85 566.92 206.92Q573.85 200 584.62 200H621.54Q630.0 200 636.54 204.62Q643.08 209.23 645.38 217.69L702 406L800 439V580H760L620 720Q620 737.69 622.88 758.23Q625.77 778.77 631.54 795.23Q604.85 788 581.69 766.58Q558.54 745.15 547 720H300Q242 720 201.0 679.0Q160 638 160 580Q160 540.54 179.46 446.42Q198.92 352.31 234.62 219.23Q236.92 210.77 244.23 205.38Q251.54 200 260.0 200ZM640.0 529.23Q652.38 529.23 661.58 538.42Q670.77 547.62 670.77 560.0Q670.77 572.38 661.58 581.58Q652.38 590.77 640.0 590.77Q627.62 590.77 618.42 581.58Q609.23 572.38 609.23 560.0Q609.23 547.62 618.42 538.42Q627.62 529.23 640.0 529.23ZM500.0 620.0Q508.54 620.0 514.27 625.73Q520 631.46 520.0 640.0Q520 648.54 514.27 654.27Q508.54 660.0 500.0 660.0H340.0Q331.46 660.0 325.73 654.27Q320 648.54 320.0 640.0Q320 631.46 325.73 625.73Q331.46 620.0 340.0 620.0ZM260.0 200Q251.54 200 244.23 205.38Q236.92 210.77 234.62 219.23Q198.92 352.31 179.46 446.42Q160 540.54 160 580Q160 638 201.0 679.0Q242 720 300 720H547Q558.54 745.15 581.69 766.58Q604.85 788 631.54 795.23Q625.77 778.77 622.88 758.23Q620 737.69 620 720L760 580H800V439L702 406L645.38 217.69Q643.08 209.23 636.54 204.62Q630.0 200 621.54 200H584.62Q573.85 200 566.92 206.92Q560 213.85 560 224.62V280H320V224.62Q320 213.85 313.08 206.92Q306.15 200 295.38 200Z"
  );
  g.appendChild(p);
  nodo.appendChild(g);
  return nodo;
};
