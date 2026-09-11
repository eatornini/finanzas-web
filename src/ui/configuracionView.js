import { el, limpiar } from "./dom.js";
import { prefs } from "../prefs.js";
import { engranajeIcono, intercambioIcono, paletaIcono } from "./iconos.js";
import { tituloVista, iconoTitulo } from "./tituloVista.js";
import { aplicarAcento, esHexValido, ACENTO_DEFECTO } from "./acento.js";

// Colores de acento predefinidos (el primero es el de por defecto). El
// selector de color al final permite cualquier otro.
const PRESETS_ACENTO = [
  "#0966DF", // azul (por defecto)
  "#4F46E5", // índigo
  "#7C3AED", // violeta
  "#DB2777", // fucsia
  "#DC2626", // rojo
  "#EA580C", // naranja
  "#16A34A", // verde
  "#0891B2", // cian
];

export function montarConfiguracion(contenedor) {
  limpiar(contenedor);

  const chkInactivos = el("input", { id: "config-inactivos", type: "checkbox" });
  chkInactivos.checked = prefs.get("incluirInactivos");
  chkInactivos.addEventListener("change", () => {
    prefs.set("incluirInactivos", chkInactivos.checked);
  });

  // --- Color de acento: círculos predefinidos + selector personalizado ---
  function fijarAcento(c) {
    prefs.set("acento", c);
    aplicarAcento(c);
    sincronizarAcento();
  }

  const botonesPreset = PRESETS_ACENTO.map((c) => {
    const b = el("button", { type: "button", class: "cat-swatch", "aria-label": `Usar color ${c}` });
    b.style.background = c;
    b.style.setProperty("--swatch-color", c);
    b.dataset.color = c.toLowerCase();
    b.addEventListener("click", () => fijarAcento(c));
    return b;
  });

  // Último círculo: selector nativo para cualquier color (mismo patrón que el
  // formulario de categoría).
  const inputAcento = el("input", {
    type: "color",
    class: "cat-swatch-custom-input",
    "aria-label": "Elegir un color de acento personalizado",
  });
  inputAcento.addEventListener("input", () => fijarAcento(inputAcento.value));
  const swatchCustom = el(
    "span",
    { class: "cat-swatch cat-swatch--custom", title: "Color personalizado" },
    [inputAcento]
  );

  const swatches = el("div", { class: "cat-swatches" }, [...botonesPreset, swatchCustom]);
  const valorAcento = el("span", { class: "config-color-hex" });
  const btnResetAcento = el("button", {
    type: "button",
    class: "boton--secundario",
    text: "Restablecer",
  });
  btnResetAcento.addEventListener("click", () => fijarAcento(ACENTO_DEFECTO));

  function sincronizarAcento() {
    const guardado = prefs.get("acento");
    const c = esHexValido(guardado) ? guardado : ACENTO_DEFECTO;
    const cl = c.toLowerCase();
    const esPreset = PRESETS_ACENTO.some((p) => p.toLowerCase() === cl);

    for (const b of botonesPreset) b.classList.toggle("activo", b.dataset.color === cl);
    swatchCustom.classList.toggle("activo", !esPreset);
    if (esPreset) {
      swatchCustom.style.background = "";
    } else {
      swatchCustom.style.setProperty("--swatch-color", c);
      swatchCustom.style.background = c;
    }
    inputAcento.value = c;
    valorAcento.textContent = c.toUpperCase();
    btnResetAcento.disabled = cl === ACENTO_DEFECTO.toLowerCase();
  }
  sincronizarAcento();

  contenedor.append(
    el("div", { class: "config-vista" }, [
      tituloVista(engranajeIcono, "Configuración", "Personaliza las opciones de tu cuenta."),
      el("section", { class: "panel-tarjeta" }, [
        el("h3", {}, [iconoTitulo(intercambioIcono), "Movimientos"]),
        el("label", { class: "campo campo--check", for: "config-inactivos" }, [
          chkInactivos,
          "Incluir movimientos inactivos en los cálculos de Estimado",
        ]),
      ]),
      el("section", { class: "panel-tarjeta" }, [
        el("h3", {}, [iconoTitulo(paletaIcono), "Apariencia"]),
        el("div", { class: "config-color" }, [
          el("div", { class: "config-color-info" }, [
            el("span", { class: "config-color-titulo", text: "Color de acento" }),
            el("span", {
              class: "config-color-ayuda",
              text: "Se usa en botones, enlaces y elementos destacados, en tema claro y oscuro.",
            }),
          ]),
          el("div", { class: "config-color-control" }, [
            swatches,
            el("div", { class: "config-color-pie" }, [valorAcento, btnResetAcento]),
          ]),
        ]),
      ]),
    ])
  );
}
