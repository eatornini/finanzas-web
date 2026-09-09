import { el, limpiar } from "./dom.js";
import { montarModal } from "./modal.js";
import { crearCategoria, actualizarCategoria } from "../data/categorias.js";
import { spanIcono, cargarIconosCompletos } from "./iconoCategoria.js";
import { buscarIconos } from "../logic/busquedaIconos.js";
import {
  etiquetaIcono,
  notaIcono,
  circuloFlechaAbajo,
  billeteraIcono,
  paletaIcono,
  lupaIcono,
  mas,
} from "./iconos.js";

const PALETA = [
  "#c0392b", "#e67e22", "#f1c40f", "#2ecc71", "#1abc9c",
  "#3498db", "#9b59b6", "#e84393", "#7f8c8d",
];

// Selección curada para "Iconos populares": nombre amigable + icono
// Material Symbols (todos en el subset chico, siempre cargado).
const ICONOS_POPULARES = [
  { icono: "restaurant", nombre: "Alimentos" },
  { icono: "directions_car", nombre: "Transporte" },
  { icono: "home", nombre: "Hogar" },
  { icono: "health_and_safety", nombre: "Salud" },
  { icono: "savings", nombre: "Ahorro" },
  { icono: "shopping_cart", nombre: "Compras" },
  { icono: "school", nombre: "Educación" },
  { icono: "flight", nombre: "Viajes" },
  { icono: "fitness_center", nombre: "Deporte" },
  { icono: "category", nombre: "Otros" },
];

// Encabezado de campo: badge de icono de acento + título (mismo lenguaje
// visual que las secciones del formulario de movimiento). Con `forId` se
// renderiza como <label> para que el clic enfoque el control.
function campoCab(fabricaIcono, texto, { forId, claseIcono = "" } = {}) {
  const clase = claseIcono ? `mov-seccion-icono ${claseIcono}` : "mov-seccion-icono";
  const hijos = [
    el("span", { class: "mov-seccion-titulo" }, [
      el("span", { class: clase }, [fabricaIcono()]),
      texto,
    ]),
  ];
  return forId
    ? el("label", { class: "mov-seccion-cab", for: forId }, hijos)
    : el("div", { class: "mov-seccion-cab" }, hijos);
}

function campoBloque(cab, control, ayuda) {
  return el("div", { class: "cat-campo" }, [
    cab,
    control,
    ayuda ? el("p", { class: "cat-campo-ayuda", text: ayuda }) : null,
  ]);
}

export function abrirCategoriaForm({
  categoria = null,
  modoInicial = "real",
  tipoInicial = "gasto",
  onGuardado,
}) {
  const edicion = Boolean(categoria);
  const estado = {
    color: categoria?.color || PALETA[4],
    emoji: categoria?.emoji || "",
    icono: categoria?.icono || (categoria?.emoji ? "" : ICONOS_POPULARES[0].icono),
  };

  const error = el("p", { class: "error", role: "alert" });
  const nombre = el("input", {
    id: "cat-nombre",
    required: "true",
    placeholder: "Ej. Alimentación",
    value: categoria?.nombre || "",
  });
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

  // --- Color: fila de círculos, el elegido con anillo del propio color ---
  const swatches = el(
    "div",
    { class: "cat-swatches" },
    PALETA.map((c) => {
      const b = el("button", { type: "button", class: "cat-swatch", "aria-label": c });
      b.style.background = c;
      b.style.setProperty("--swatch-color", c);
      b.dataset.color = c;
      b.addEventListener("click", () => {
        estado.color = c;
        sincronizarColor();
      });
      return b;
    })
  );
  function sincronizarColor() {
    for (const b of swatches.children) {
      b.classList.toggle("activo", b.dataset.color === estado.color);
    }
  }

  // --- Icono: buscador + "Iconos populares" ---
  function elegirIcono(nombreIcono) {
    estado.icono = nombreIcono;
    estado.emoji = "";
    sincronizarGrilla();
  }

  function tilePopular({ icono, nombre: etiqueta }) {
    const b = el("button", { type: "button", class: "cat-icono-op", title: etiqueta }, [
      el("span", { class: "cat-icono-op-glifo" }, [spanIcono(icono)]),
      el("span", { class: "cat-icono-op-nombre", text: etiqueta }),
    ]);
    b.dataset.icono = icono;
    b.addEventListener("click", () => elegirIcono(icono));
    return b;
  }

  const grilla = el(
    "div",
    { class: "cat-iconos-grilla" },
    ICONOS_POPULARES.map(tilePopular)
  );
  const popularesWrap = el("div", { class: "cat-iconos-populares" }, [
    el("p", { class: "cat-iconos-populares-titulo", text: "Iconos populares" }),
    grilla,
  ]);

  const busquedaIcono = el("input", {
    type: "search",
    placeholder: "Buscar iconos…",
    "aria-label": "Buscar iconos",
  });
  const estadoBusqueda = el("p", { class: "cat-icono-busqueda-estado" });
  const grillaBusqueda = el("div", {
    class: "cat-iconos-grilla cat-iconos-grilla--busqueda",
    hidden: "true",
  });

  function sincronizarGrilla() {
    for (const b of [...grilla.children, ...grillaBusqueda.children]) {
      b.classList.toggle("activo", !estado.emoji && b.dataset.icono === estado.icono);
    }
  }

  let mapaCompletos = null;
  busquedaIcono.addEventListener("input", async () => {
    const consulta = busquedaIcono.value;
    limpiar(grillaBusqueda);
    grillaBusqueda.hidden = true;
    estadoBusqueda.textContent = "";
    popularesWrap.hidden = Boolean(consulta.trim());
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
    for (const { nombre: nombreIcono, caracter } of resultados) {
      const b = el("button", { type: "button", class: "cat-icono-op", title: nombreIcono }, [
        el("span", { class: "cat-icono-op-glifo" }, [
          el("span", { class: "ms-icono ms-icono--completo", text: caracter }),
        ]),
        el("span", { class: "cat-icono-op-nombre", text: nombreIcono.replace(/_/g, " ") }),
      ]);
      b.dataset.icono = nombreIcono;
      b.addEventListener("click", () => elegirIcono(nombreIcono));
      grillaBusqueda.append(b);
    }
    grillaBusqueda.hidden = false;
    sincronizarGrilla();
  });

  // El botón de guardar vive en el pie del modal (fuera del <form> en el
  // DOM); `form=` lo mantiene asociado para que el clic dispare el submit.
  const btnGuardar = el(
    "button",
    { type: "submit", form: "form-categoria", class: "boton--primario" },
    edicion ? ["Guardar"] : [mas(), el("span", { text: "Crear categoría" })]
  );
  const btnCancelar = el("button", { type: "button", text: "Cancelar", onClick: () => cerrar() });

  const form = el(
    "form",
    {
      id: "form-categoria",
      class: "cat-form-wrap",
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
      el("div", { class: "cat-form" }, [
        campoBloque(
          campoCab(notaIcono, "Nombre", { forId: "cat-nombre" }),
          nombre,
          "Elige un nombre claro para identificar la categoría."
        ),
        el("div", { class: "cat-form-fila" }, [
          campoBloque(
            campoCab(circuloFlechaAbajo, "Tipo", {
              forId: "cat-tipo",
              claseIcono: "mov-seccion-icono--rojo",
            }),
            tipo,
            "¿Es un ingreso o un gasto?"
          ),
          campoBloque(
            campoCab(billeteraIcono, "Modo", { forId: "cat-modo" }),
            modo,
            "Define el modo de la categoría."
          ),
        ]),
        campoBloque(campoCab(paletaIcono, "Color"), swatches),
        el("div", { class: "cat-campo" }, [
          campoCab(etiquetaIcono, "Icono"),
          el("div", { class: "cat-iconos-buscar" }, [lupaIcono(), busquedaIcono]),
          estadoBusqueda,
          grillaBusqueda,
          popularesWrap,
        ]),
      ]),
      error,
    ]
  );

  const { cerrar } = montarModal({
    titulo: edicion ? "Editar categoría" : "Nueva categoría",
    subtitulo: edicion
      ? "Ajustá los datos de esta categoría."
      : "Crea una categoría para organizar tus movimientos.",
    icono: etiquetaIcono,
    contenido: form,
    acciones: [btnCancelar, btnGuardar],
    claseExtra: "modal-panel--ancho",
  });
  sincronizarColor();
  sincronizarGrilla();
}
