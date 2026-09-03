import { el, limpiar } from "./dom.js";

export function montarPlaceholder(contenedor, { icono, titulo, descripcion }) {
  limpiar(contenedor);
  contenedor.append(
    el("div", { class: "placeholder" }, [
      el("div", { class: "placeholder-icono" }, [icono()]),
      el("h2", { text: titulo }),
      el("p", { text: descripcion }),
    ])
  );
}
