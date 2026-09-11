import { el } from "./dom.js";

// Encabezado principal de una pantalla: icono en contenedor azul suave +
// título + subtítulo opcional debajo. Mismo lenguaje visual en todas las
// vistas (referencia: encabezado de Resumen) para reconocer la sección de
// un vistazo. `fabricaIcono` es una función que devuelve un <svg> nuevo (los
// exports de iconos.js). `texto` admite un string o un array de hijos (por
// ejemplo, para intercalar un badge junto al título). `subtitulo` admite un
// string, un nodo ya construido (para poder actualizarlo luego) o nada.
export function tituloVista(fabricaIcono, texto, subtitulo) {
  const hijosTitulo = Array.isArray(texto) ? texto : [texto];
  let nodoSub = null;
  if (subtitulo != null) {
    nodoSub = subtitulo.nodeType ? subtitulo : el("p", { text: subtitulo });
    nodoSub.classList.add("vista-titulo-sub");
  }

  return el("div", { class: "vista-titulo" }, [
    el("span", { class: "vista-titulo-icono" }, [fabricaIcono()]),
    el("div", { class: "vista-titulo-cuerpo" }, [
      el("h2", { class: "vista-titulo-txt" }, hijosTitulo),
      nodoSub,
    ]),
  ]);
}

// Icono pequeño para anteponer a un título de panel o tarjeta (h3), sin
// cambiar el texto ni el tamaño del título.
export function iconoTitulo(fabricaIcono) {
  return el("span", { class: "titulo-icono" }, [fabricaIcono()]);
}
