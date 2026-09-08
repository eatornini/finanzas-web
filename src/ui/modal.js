// Modal genérico centrado: overlay + panel con cabecera (título + cerrar).
// Se cierra con la X, con click en el fondo o con Escape.
import { el } from "./dom.js";
import { cerrarIcono } from "./iconos.js";

// `icono` (opcional): función que devuelve un <svg> nuevo (los exports de
// iconos.js). Con `icono` y/o `subtitulo` la cabecera pasa de un simple
// <h3> a un bloque con badge circular + título + subtítulo.
export function montarModal({ titulo, subtitulo, icono, contenido, onCerrar, accionesCabecera = [] }) {
  const btnCerrar = el(
    "button",
    { class: "boton--icono modal-cerrar", "aria-label": "Cerrar", onClick: () => cerrar() },
    [cerrarIcono()]
  );

  const textos = el("div", { class: "modal-titulo-textos" }, [
    el("h3", { text: titulo }),
    subtitulo ? el("p", { class: "modal-subtitulo", text: subtitulo }) : null,
  ]);
  const tituloBloque = icono
    ? el("div", { class: "modal-titulo-bloque" }, [
        el("span", { class: "modal-titulo-icono" }, [icono()]),
        textos,
      ])
    : textos;

  const panel = el(
    "div",
    { class: "modal-panel", role: "dialog", "aria-modal": "true", "aria-label": titulo },
    [
      el("div", { class: "modal-cabecera" }, [
        tituloBloque,
        el("div", { class: "modal-cabecera-acciones" }, [...accionesCabecera, btnCerrar]),
      ]),
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
  panel.querySelector("input:not([hidden]), select, textarea")?.focus();

  return { cerrar };
}
