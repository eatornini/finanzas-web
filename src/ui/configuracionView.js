import { el, limpiar } from "./dom.js";
import { prefs } from "../prefs.js";
import { listarMovimientos } from "../data/movimientos.js";
import { todosActivos } from "../logic/totales.js";
import { rangoPeriodo, etiquetaPeriodo, periodoAnterior, periodoSiguiente } from "../logic/periodos.js";
import {
  contarMovimientosEstimado,
  copiarMesEstimado,
  borrarMesEstimado,
  cambiarEstadoMesEstimado,
} from "../data/herramientasMes.js";
import { engranajeIcono, intercambioIcono, paletaIcono, calendarioIcono, flechaIzq, flechaDer } from "./iconos.js";
import { tituloVista, iconoTitulo } from "./tituloVista.js";
import { aplicarAcento, esHexValido, ACENTO_DEFECTO } from "./acento.js";
import { actualizarAcento } from "../data/perfil.js";

// Sección "Mes estimado": copiar/activar-desactivar/borrar los movimientos
// estimados de un mes completo. Vivía como menú "⋮" dentro de Resumen — se
// movió acá porque es una herramienta de mantenimiento de datos, no algo
// que se use al mirar el resumen del período. Reutiliza exactamente la
// misma lógica de datos que tenía en Resumen (herramientasMes.js).
async function montarSeccionMesEstimado(seccion, fechaInicial) {
  let fechaMes = fechaInicial instanceof Date ? fechaInicial : new Date();
  let movimientos = [];

  const aviso = el("p", { class: "aviso" });
  const error = el("p", { class: "error", role: "alert" });

  await cargar();

  async function cargar() {
    error.textContent = "";
    try {
      const rango = rangoPeriodo(fechaMes, "mes");
      movimientos = await listarMovimientos({ ...rango, modo: "estimado" });
      pintar();
    } catch (e) {
      movimientos = [];
      error.textContent = "No se pudieron cargar los movimientos estimados de este mes.";
      pintar();
    }
  }

  async function conBloqueo(fn) {
    for (const b of seccion.querySelectorAll(".menu-mes-item")) b.disabled = true;
    error.textContent = "";
    aviso.textContent = "";
    try {
      await fn();
    } catch (e) {
      error.textContent = "No se pudo completar la acción.";
    } finally {
      for (const b of seccion.querySelectorAll(".menu-mes-item")) b.disabled = false;
    }
  }

  function pintar() {
    limpiar(seccion);

    const rango = rangoPeriodo(fechaMes, "mes");
    const etiquetaActual = etiquetaPeriodo(fechaMes, "mes");
    const desdeSiguiente = periodoSiguiente(fechaMes, "mes");
    const etiquetaSiguiente = etiquetaPeriodo(desdeSiguiente, "mes");
    const hayMovimientos = movimientos.length > 0;

    const navegador = el("div", { class: "navegador-periodo" }, [
      el(
        "button",
        {
          class: "boton--icono",
          "aria-label": "Mes anterior",
          onClick: () => {
            fechaMes = periodoAnterior(fechaMes, "mes");
            cargar();
          },
        },
        [flechaIzq()]
      ),
      el("span", { class: "periodo-label", text: etiquetaActual }),
      el(
        "button",
        {
          class: "boton--icono",
          "aria-label": "Mes siguiente",
          onClick: () => {
            fechaMes = periodoSiguiente(fechaMes, "mes");
            cargar();
          },
        },
        [flechaDer()]
      ),
    ]);

    const btnCopiar = el(
      "button",
      {
        class: "menu-mes-item",
        type: "button",
        onClick: () =>
          conBloqueo(async () => {
            const rangoDestino = rangoPeriodo(desdeSiguiente, "mes");
            const n = await contarMovimientosEstimado(rangoDestino.desde, rangoDestino.hasta);
            const mensajeConfirm =
              n > 0
                ? `${etiquetaSiguiente} ya tiene ${n} movimientos estimados. Se reemplazarán por la copia de ${etiquetaActual}. ¿Continuar?`
                : `¿Copiar los movimientos estimados de ${etiquetaActual} a ${etiquetaSiguiente}?`;
            if (!confirm(mensajeConfirm)) return;
            const total = await copiarMesEstimado(rango.desde);
            aviso.textContent = `Se copiaron ${total} movimientos a ${etiquetaSiguiente}.`;
          }),
      },
      [`Copiar a ${etiquetaSiguiente}`]
    );

    const btnEstado = el(
      "button",
      {
        class: "menu-mes-item",
        type: "button",
        disabled: hayMovimientos ? null : "true",
        onClick: () =>
          conBloqueo(async () => {
            const nuevoEstado = !todosActivos(movimientos);
            const verbo = nuevoEstado ? "Activar" : "Desactivar";
            if (!confirm(`¿${verbo} los ${movimientos.length} movimientos de ${etiquetaActual}?`)) return;
            await cambiarEstadoMesEstimado(rango.desde, rango.hasta, nuevoEstado);
            await cargar();
            aviso.textContent = `Se ${nuevoEstado ? "activaron" : "desactivaron"} los movimientos de ${etiquetaActual}.`;
          }),
      },
      [hayMovimientos && todosActivos(movimientos) ? "Desactivar todos" : "Activar todos"]
    );

    const btnBorrar = el(
      "button",
      {
        class: "menu-mes-item menu-mes-item--peligro",
        type: "button",
        disabled: hayMovimientos ? null : "true",
        onClick: () =>
          conBloqueo(async () => {
            if (
              !confirm(
                `¿Borrar los ${movimientos.length} movimientos estimados de ${etiquetaActual}? Esta acción no se puede deshacer.`
              )
            )
              return;
            await borrarMesEstimado(rango.desde, rango.hasta);
            await cargar();
            aviso.textContent = `Se borraron los movimientos estimados de ${etiquetaActual}.`;
          }),
      },
      ["Borrar datos del mes"]
    );

    seccion.append(
      el("h3", {}, [iconoTitulo(calendarioIcono), "Mes estimado"]),
      el("span", {
        class: "config-color-ayuda",
        text: "Copia, activa/desactiva o borra los movimientos estimados de un mes completo.",
      }),
      navegador,
      el("p", {
        class: "mesestimado-estado",
        text: hayMovimientos
          ? `${movimientos.length} movimiento${movimientos.length === 1 ? "" : "s"} estimado${movimientos.length === 1 ? "" : "s"} en ${etiquetaActual}.`
          : `Sin movimientos estimados en ${etiquetaActual}.`,
      }),
      el("div", { class: "menu-mes-lista" }, [btnCopiar, btnEstado, btnBorrar]),
      aviso,
      error
    );
  }
}

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

export async function montarConfiguracion(contenedor, { fechaRef } = {}) {
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
    // Best-effort: si falla (sin conexión, etc.) el color igual queda
    // aplicado localmente; se reintentará solo al volver a elegirlo.
    actualizarAcento(c).catch(() => {});
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

  const seccionMesEstimado = el("section", { class: "panel-tarjeta" });

  contenedor.append(
    el("div", { class: "config-vista" }, [
      tituloVista(engranajeIcono, "Configuración", "Personaliza las opciones de tu cuenta."),
      el("section", { class: "panel-tarjeta" }, [
        el("h3", {}, [iconoTitulo(intercambioIcono), "Movimientos"]),
        el("label", { class: "campo campo--check mov-opcion-switch", for: "config-inactivos" }, [
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
      seccionMesEstimado,
    ])
  );

  await montarSeccionMesEstimado(seccionMesEstimado, fechaRef);
}
