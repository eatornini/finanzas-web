import { el } from "./dom.js";
import { iconoMovimiento } from "./iconosCategoria.js";
import { ICONOS } from "./iconos-codepoints.js";

// Nombres de icono disponibles en el picker (los que trae la fuente subseteada).
export const LISTA_ICONOS = Object.keys(ICONOS);

// <span> con el glifo Material Symbols para un nombre de icono, o null si no está.
export function spanIcono(nombre) {
  const car = ICONOS[nombre];
  if (!car) return null;
  return el("span", { class: "ms-icono", text: car });
}

// Nodo a mostrar para la categoría de un movimiento (o para una categoría suelta).
// Prioridad: emoji explícito > icono Material Symbols > inferencia por palabras.
export function nodoIconoCategoria(cat, fallbackTexto = "") {
  if (cat && cat.emoji) return el("span", { class: "cat-emoji", text: cat.emoji });
  if (cat && cat.icono) {
    const s = spanIcono(cat.icono);
    if (s) return s;
  }
  const nombreCat = cat && cat.nombre ? cat.nombre : "";
  return iconoMovimiento({
    nombre: fallbackTexto,
    categoria: nombreCat ? { nombre: nombreCat } : null,
  });
}
