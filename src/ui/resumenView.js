import { el, limpiar } from "./dom.js";

export function montarResumen(contenedor, ctx) {
  limpiar(contenedor);
  contenedor.append(
    el("p", { text: `Resumen — ${ctx.rango.desde} a ${ctx.rango.hasta} (pendiente)` })
  );
}
