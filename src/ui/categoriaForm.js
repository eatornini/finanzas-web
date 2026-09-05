import { el, limpiar } from "./dom.js";
import { montarModal } from "./modal.js";
import { crearCategoria, actualizarCategoria } from "../data/categorias.js";
import { LISTA_ICONOS, spanIcono, spanIconoConCarga, cargarIconosCompletos } from "./iconoCategoria.js";
import { buscarIconos } from "../logic/busquedaIconos.js";

const PALETA = [
  "#c0392b", "#e67e22", "#f1c40f", "#2ecc71", "#1abc9c", "#3498db",
  "#2980b9", "#9b59b6", "#8e44ad", "#e84393", "#7f8c8d", "#34495e",
];

export function abrirCategoriaForm({
  categoria = null,
  modoInicial = "real",
  tipoInicial = "gasto",
  onGuardado,
}) {
  const edicion = Boolean(categoria);
  const estado = {
    color: categoria?.color || PALETA[3],
    emoji: categoria?.emoji || "",
    icono: categoria?.icono || (categoria?.emoji ? "" : "category"),
  };

  const error = el("p", { class: "error", role: "alert" });
  const nombre = el("input", { id: "cat-nombre", required: "true", value: categoria?.nombre || "" });
  const tipo = el("select", { id: "cat-tipo" }, [
    el("option", { value: "gasto", text: "Gasto" }),
    el("option", { value: "ingreso", text: "Ingreso" }),
  ]);
  tipo.value = categoria?.tipo || tipoInicial;
  const modo = el("select", { id: "cat-modo" }, [
    el("option", { value: "real", text: "Real" }),
    el("option", { value: "estimado", text: "Estimado" }),
  ]);
  modo.value = categoria?.modo || modoInicial;

  const preview = el("span", { class: "cat-preview" });
  function pintarPreview() {
    limpiar(preview);
    preview.style.background = estado.color;
    if (estado.emoji) {
      preview.append(el("span", { class: "cat-emoji", text: estado.emoji }));
    } else {
      preview.append(spanIconoConCarga(estado.icono || "category"));
    }
  }

  const colorInput = el("input", { type: "color", value: estado.color });
  colorInput.addEventListener("input", () => {
    estado.color = colorInput.value;
    pintarPreview();
  });
  const swatches = el(
    "div",
    { class: "cat-swatches" },
    PALETA.map((c) => {
      const b = el("button", { type: "button", class: "cat-swatch", "aria-label": c });
      b.style.background = c;
      b.addEventListener("click", () => {
        estado.color = c;
        colorInput.value = c;
        pintarPreview();
      });
      return b;
    })
  );

  const emojiInput = el("input", {
    class: "cat-emoji-input",
    maxlength: "2",
    placeholder: "😀",
    value: estado.emoji,
  });
  emojiInput.addEventListener("input", () => {
    estado.emoji = emojiInput.value.trim();
    if (estado.emoji) estado.icono = "";
    pintarPreview();
    sincronizarGrilla();
  });

  function elegirIcono(nombreIcono) {
    estado.icono = nombreIcono;
    estado.emoji = "";
    emojiInput.value = "";
    pintarPreview();
    sincronizarGrilla();
  }

  const grilla = el(
    "div",
    { class: "cat-iconos-grilla" },
    LISTA_ICONOS.map((nombreIcono) => {
      const b = el("button", { type: "button", class: "cat-icono-op", title: nombreIcono }, [
        spanIcono(nombreIcono),
      ]);
      b.dataset.icono = nombreIcono;
      b.addEventListener("click", () => elegirIcono(nombreIcono));
      return b;
    })
  );
  function sincronizarGrilla() {
    for (const b of [...grilla.children, ...grillaBusqueda.children]) {
      b.classList.toggle("activo", !estado.emoji && b.dataset.icono === estado.icono);
    }
  }

  const busquedaIcono = el("input", {
    type: "search",
    class: "cat-icono-busqueda",
    placeholder: "Buscar entre todos los íconos…",
  });
  const estadoBusqueda = el("p", { class: "cat-icono-busqueda-estado" });
  const grillaBusqueda = el("div", { class: "cat-iconos-grilla", hidden: "true" });

  let mapaCompletos = null;
  busquedaIcono.addEventListener("input", async () => {
    const consulta = busquedaIcono.value;
    limpiar(grillaBusqueda);
    grillaBusqueda.hidden = true;
    estadoBusqueda.textContent = "";
    if (!consulta.trim()) return;

    if (!mapaCompletos) {
      estadoBusqueda.textContent = "Cargando…";
      try {
        mapaCompletos = await cargarIconosCompletos();
      } catch (e) {
        estadoBusqueda.textContent = "Necesitás conexión para buscar más íconos.";
        return;
      }
      if (busquedaIcono.value !== consulta) return; // el usuario ya escribió otra cosa
      estadoBusqueda.textContent = "";
    }

    const resultados = buscarIconos(mapaCompletos, consulta);
    if (resultados.length === 0) {
      estadoBusqueda.textContent = "Sin resultados.";
      return;
    }
    for (const { nombre, caracter } of resultados) {
      const b = el("button", { type: "button", class: "cat-icono-op", title: nombre }, [
        el("span", { class: "ms-icono ms-icono--completo", text: caracter }),
      ]);
      b.dataset.icono = nombre;
      b.addEventListener("click", () => elegirIcono(nombre));
      grillaBusqueda.append(b);
    }
    grillaBusqueda.hidden = false;
    sincronizarGrilla();
  });

  const btnGuardar = el("button", {
    type: "submit",
    class: "boton--primario",
    text: edicion ? "Guardar" : "Crear categoría",
  });

  const form = el(
    "form",
    {
      class: "form-mov",
      onSubmit: async (ev) => {
        ev.preventDefault();
        error.textContent = "";
        if (!nombre.value.trim()) {
          error.textContent = "El nombre es obligatorio.";
          return;
        }
        btnGuardar.disabled = true;
        const datos = {
          nombre: nombre.value.trim(),
          tipo: tipo.value,
          modo: modo.value,
          color: estado.color,
          emoji: estado.emoji || null,
          icono: estado.emoji ? null : estado.icono || null,
        };
        try {
          const guardada = edicion
            ? await actualizarCategoria(categoria.id, datos)
            : await crearCategoria({ ...datos, orden: categoria?.orden ?? 0 });
          cerrar();
          onGuardado?.(guardada);
        } catch (e) {
          error.textContent = "No se pudo guardar la categoría.";
          btnGuardar.disabled = false;
        }
      },
    },
    [
      el("div", { class: "form-grid" }, [
        el("label", { class: "campo", for: "cat-nombre", text: "Nombre" }, [nombre]),
        el("label", { class: "campo", for: "cat-tipo", text: "Tipo" }, [tipo]),
        el("label", { class: "campo", for: "cat-modo", text: "Modo" }, [modo]),
        el("div", { class: "campo" }, [
          el("span", { class: "campo-etiqueta", text: "Color" }),
          swatches,
          colorInput,
        ]),
        el("div", { class: "campo" }, [
          el("span", { class: "campo-etiqueta", text: "Icono o emoji" }),
          el("div", { class: "cat-icono-fila" }, [preview, emojiInput]),
          grilla,
          busquedaIcono,
          estadoBusqueda,
          grillaBusqueda,
        ]),
      ]),
      error,
      el("div", { class: "modal-acciones" }, [
        el("button", { type: "button", text: "Cancelar", onClick: () => cerrar() }),
        btnGuardar,
      ]),
    ]
  );

  const { cerrar } = montarModal({
    titulo: edicion ? "Editar categoría" : "Nueva categoría",
    contenido: form,
  });
  pintarPreview();
  sincronizarGrilla();
}
