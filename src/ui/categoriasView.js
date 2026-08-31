import { el, limpiar } from "./dom.js";

export function montarCategorias(contenedor) {
  limpiar(contenedor);
  contenedor.append(el("p", { text: "Categorías (pendiente)" }));
}
