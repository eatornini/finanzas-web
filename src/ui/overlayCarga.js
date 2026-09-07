// Overlay de carga a pantalla completa: tapa toda la UI (modales incluidos)
// y captura los toques mientras dura una tarea que el usuario no debe
// interrumpir, p. ej. el OCR de un comprobante. No tiene botón de cierre;
// se quita llamando a la función que devuelve.
import { el } from "./dom.js";
import { cargandoIcono } from "./iconos.js";

export function mostrarOverlayCarga(texto = "Cargando…") {
  const overlay = el(
    "div",
    { class: "overlay-carga", role: "alert", "aria-busy": "true" },
    [
      el("div", { class: "overlay-carga-caja" }, [
        el("span", { class: "overlay-carga-icono" }, [cargandoIcono()]),
        el("span", { class: "overlay-carga-texto", text: texto }),
      ]),
    ]
  );
  document.body.append(overlay);
  return () => overlay.remove();
}
