import { el, limpiar } from "./dom.js";

export function montarMovimientos(contenedor, ctx) {
  limpiar(contenedor);
  contenedor.append(
    el("p", { text: `Movimientos — ${ctx.rango.desde} a ${ctx.rango.hasta} (pendiente)` })
  );
}
