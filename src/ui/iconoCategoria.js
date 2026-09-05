import { el } from "./dom.js";
import { iconoMovimiento } from "./iconosCategoria.js";
import { ICONOS } from "./iconos-codepoints.js";

// Nombres de icono disponibles en el picker rápido (los que trae la fuente
// subseteada chica, siempre cargada).
export const LISTA_ICONOS = Object.keys(ICONOS);

const URL_FUENTE_COMPLETA = new URL(
  "../../assets/fonts/material-symbols-full.woff2",
  import.meta.url
).href;

let promesaCompletos = null;

// Carga bajo demanda el subset completo de Material Symbols (~300 KB, todos
// los iconos de la fuente) y su mapa nombre->caracter. Se pide una sola vez
// por sesión; el navegador cachea el archivo (service worker) para la
// próxima. Usar solo cuando el usuario realmente busca un icono fuera del
// subset chico — nunca en la carga inicial de la app.
export function cargarIconosCompletos() {
  if (!promesaCompletos) {
    const fuente = new FontFace("Material Symbols Full", `url(${URL_FUENTE_COMPLETA}) format("woff2")`);
    promesaCompletos = Promise.all([
      import("./iconos-codepoints-full.js"),
      fuente.load().then((cargada) => document.fonts.add(cargada)),
    ]).then(([mod]) => mod.ICONOS_COMPLETOS);
  }
  return promesaCompletos;
}

// <span> con el glifo Material Symbols del subset chico para un nombre de
// icono, o null si no está ahí.
export function spanIcono(nombre) {
  const car = ICONOS[nombre];
  if (!car) return null;
  return el("span", { class: "ms-icono", text: car });
}

// Como spanIcono, pero si el nombre no está en el subset chico, muestra un
// espacio vacío que se completa solo en cuanto cargue el subset completo
// (o se reemplaza por `crearFallback()` si el nombre tampoco está ahí, o si
// falla la carga — por ejemplo sin conexión y sin caché todavía).
export function spanIconoConCarga(nombre, crearFallback = () => el("span", { text: "?" })) {
  const directo = spanIcono(nombre);
  if (directo) return directo;

  const span = el("span", { class: "ms-icono ms-icono--pendiente" });
  cargarIconosCompletos()
    .then((mapa) => {
      const car = mapa[nombre];
      if (car) {
        span.textContent = car;
        span.classList.remove("ms-icono--pendiente");
        span.classList.add("ms-icono--completo");
      } else {
        span.replaceWith(crearFallback());
      }
    })
    .catch(() => span.replaceWith(crearFallback()));
  return span;
}

// Nodo a mostrar para la categoría de un movimiento (o para una categoría
// suelta). Prioridad: emoji explícito > icono Material Symbols (chico o
// completo) > inferencia por palabras.
export function nodoIconoCategoria(cat, fallbackTexto = "") {
  if (cat && cat.emoji) return el("span", { class: "cat-emoji", text: cat.emoji });
  const nombreCat = cat && cat.nombre ? cat.nombre : "";
  const fallback = () =>
    iconoMovimiento({
      nombre: fallbackTexto,
      categoria: nombreCat ? { nombre: nombreCat } : null,
    });
  if (cat && cat.icono) return spanIconoConCarga(cat.icono, fallback);
  return fallback();
}
