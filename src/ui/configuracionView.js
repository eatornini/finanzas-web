import { el, limpiar } from "./dom.js";
import { prefs } from "../prefs.js";

export function montarConfiguracion(contenedor) {
  limpiar(contenedor);

  const chkInactivos = el("input", { id: "config-inactivos", type: "checkbox" });
  chkInactivos.checked = prefs.get("incluirInactivos");
  chkInactivos.addEventListener("change", () => {
    prefs.set("incluirInactivos", chkInactivos.checked);
  });

  contenedor.append(
    el("div", { class: "config-vista" }, [
      el("h2", { text: "Configuración" }),
      el("section", { class: "panel-tarjeta" }, [
        el("h3", { text: "Movimientos" }),
        el("label", { class: "campo campo--check", for: "config-inactivos" }, [
          chkInactivos,
          "Incluir movimientos inactivos en los cálculos de Estimado",
        ]),
      ]),
    ])
  );
}
