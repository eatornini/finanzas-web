import { el } from "./dom.js";

// Encabezado principal de una pantalla: icono Lucide (azul corporativo) +
// título. Mismo lenguaje visual en todas las vistas para reconocer la
// sección de un vistazo. `fabricaIcono` es una función que devuelve un <svg>
// nuevo (los exports de iconos.js).
export function tituloVista(fabricaIcono, texto) {
  return el("h2", { class: "vista-titulo" }, [
    el("span", { class: "vista-titulo-icono" }, [fabricaIcono()]),
    texto,
  ]);
}

// Icono pequeño para anteponer a un título de panel o tarjeta (h3), sin
// cambiar el texto ni el tamaño del título.
export function iconoTitulo(fabricaIcono) {
  return el("span", { class: "titulo-icono" }, [fabricaIcono()]);
}
