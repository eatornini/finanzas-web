// Modal genérico centrado: overlay + panel con cabecera (título + cerrar).
// Se cierra con la X, con click en el fondo o con Escape.
import { el } from "./dom.js";
import { cerrarIcono } from "./iconos.js";

export function montarModal({ titulo, contenido, onCerrar }) {
  const btnCerrar = el(
    "button",
    { class: "boton--icono modal-cerrar", "aria-label": "Cerrar", onClick: () => cerrar() },
    [cerrarIcono()]
  );

  const panel = el(
    "div",
    { class: "modal-panel", role: "dialog", "aria-modal": "true", "aria-label": titulo },
    [
      el("div", { class: "modal-cabecera" }, [el("h3", { text: titulo }), btnCerrar]),
      el("div", { class: "modal-cuerpo" }, [contenido]),
    ]
  );

  const overlay = el(
    "div",
    {
      class: "modal-overlay",
      onClick: (ev) => {
        if (ev.target === overlay) cerrar();
      },
    },
    [panel]
  );

  function alTeclear(ev) {
    if (ev.key === "Escape") cerrar();
  }

  let abierto = true;
  function cerrar() {
    if (!abierto) return;
    abierto = false;
    document.removeEventListener("keydown", alTeclear);
    overlay.remove();
    onCerrar?.();
  }

  document.addEventListener("keydown", alTeclear);
  document.body.append(overlay);
  panel.querySelector("input, select, textarea")?.focus();

  return { cerrar };
}
