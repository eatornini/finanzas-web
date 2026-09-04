import { el, limpiar } from "./dom.js";
import { listarMovimientos } from "../data/movimientos.js";
import { calcularTotales, desglosarPorPago, filtrarParaCalculos, todosActivos } from "../logic/totales.js";
import { formatoCLP } from "../logic/dinero.js";
import { prefs } from "../prefs.js";
import { ojoIcono, ojoTachadoIcono, puntosIcono } from "./iconos.js";
import { periodoSiguiente, rangoPeriodo, etiquetaPeriodo } from "../logic/periodos.js";
import {
  contarMovimientosEstimado,
  copiarMesEstimado,
  borrarMesEstimado,
  cambiarEstadoMesEstimado,
} from "../data/herramientasMes.js";

function valorOculto(valor) {
  return prefs.get("ocultarTotal") ? "*****" : formatoCLP(valor);
}

function tarjeta(titulo, valor, clase) {
  return el("div", { class: `tarjeta ${clase}` }, [
    el("span", { class: "titulo", text: titulo }),
    el("span", { class: "valor", text: valorOculto(valor) }),
  ]);
}

function grupo(titulo, t) {
  return el("div", { class: "grupo-resumen" }, [
    el("h3", { text: titulo }),
    el("div", { class: "tarjetas-grupo" }, [
      tarjeta("Ingresos", t.ingresos, "ingreso"),
      tarjeta("Gastos", t.gastos, "gasto"),
      tarjeta("Balance", t.balance, t.balance >= 0 ? "ingreso" : "gasto"),
    ]),
  ]);
}

export async function montarResumen(contenedor, { rango, tipo, fechaRef, modo }) {
  limpiar(contenedor);

  const error = el("p", { class: "error", role: "alert" });
  const aviso = el("p", { class: "aviso" });
  const cabecera = el("div", { class: "resumen-cabecera" });
  const cifras = el("div", { class: "cifras" });
  contenedor.append(cabecera, aviso, cifras, error);

  let movimientos = [];

  await recargar();

  async function recargar() {
    error.textContent = "";
    aviso.textContent = "";
    try {
      movimientos = await listarMovimientos({ ...rango, modo });
      pintarCabecera();
      pintarCifras();
    } catch (e) {
      limpiar(cifras);
      error.textContent = "No se pudo cargar el resumen. ";
      error.append(el("button", { text: "Reintentar", onClick: recargar }));
    }
  }

  function pintarCabecera() {
    limpiar(cabecera);
    const oculto = prefs.get("ocultarTotal");
    const btnOjo = el(
      "button",
      {
        class: "boton--icono boton-ojo",
        "aria-label": oculto ? "Mostrar montos" : "Ocultar montos",
        title: oculto ? "Mostrar montos" : "Ocultar montos",
        "aria-pressed": String(oculto),
        onClick: () => {
          prefs.set("ocultarTotal", !oculto);
          pintarCabecera();
          pintarCifras();
        },
      },
      [oculto ? ojoTachadoIcono() : ojoIcono()]
    );
    cabecera.append(btnOjo);
    if (modo === "estimado" && tipo === "mes") {
      cabecera.append(construirMenuMes());
    }
  }

  function pintarCifras() {
    limpiar(cifras);
    const paraTotales = filtrarParaCalculos(movimientos, {
      modo,
      incluirInactivos: prefs.get("incluirInactivos"),
    });
    if (modo === "estimado") {
      const d = desglosarPorPago(paraTotales);
      cifras.append(
        el("div", { class: "grupos" }, [
          grupo("Estimado", d.total),
          grupo("Pagado", d.pagado),
          grupo("Pendiente", d.pendiente),
        ])
      );
    } else {
      const { ingresos, gastos, balance } = calcularTotales(paraTotales);
      cifras.append(
        el("div", { class: "tarjetas-fila" }, [
          tarjeta("Ingresos", ingresos, "ingreso"),
          tarjeta("Gastos", gastos, "gasto"),
          tarjeta("Balance", balance, balance >= 0 ? "ingreso" : "gasto"),
        ])
      );
    }
  }

  function construirMenuMes() {
    const popover = el("div", { class: "menu-mes", hidden: "true" });
    const btnMenu = el(
      "button",
      {
        class: "boton--icono",
        "aria-label": "Más acciones del mes",
        title: "Más acciones del mes",
        onClick: () => {
          popover.hidden = !popover.hidden;
        },
      },
      [puntosIcono()]
    );

    const etiquetaActual = etiquetaPeriodo(fechaRef, tipo);
    const desdeSiguiente = periodoSiguiente(fechaRef, "mes");
    const etiquetaSiguiente = etiquetaPeriodo(desdeSiguiente, "mes");

    function cerrarMenu() {
      popover.hidden = true;
    }

    async function conBloqueo(fn) {
      for (const b of popover.querySelectorAll("button")) b.disabled = true;
      error.textContent = "";
      aviso.textContent = "";
      try {
        await fn();
      } catch (e) {
        error.textContent = "No se pudo completar la acción.";
      } finally {
        for (const b of popover.querySelectorAll("button")) b.disabled = false;
      }
    }

    const btnCopiar = el(
      "button",
      {
        class: "menu-mes-item",
        type: "button",
        onClick: () =>
          conBloqueo(async () => {
            cerrarMenu();
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
        onClick: () =>
          conBloqueo(async () => {
            cerrarMenu();
            const nuevoEstado = !todosActivos(movimientos);
            const verbo = nuevoEstado ? "Activar" : "Desactivar";
            if (!confirm(`¿${verbo} los ${movimientos.length} movimientos de ${etiquetaActual}?`)) return;
            await cambiarEstadoMesEstimado(rango.desde, rango.hasta, nuevoEstado);
            await recargar();
            aviso.textContent = `Se ${nuevoEstado ? "activaron" : "desactivaron"} los movimientos de ${etiquetaActual}.`;
          }),
      },
      [todosActivos(movimientos) ? "Desactivar todos" : "Activar todos"]
    );

    const btnBorrar = el(
      "button",
      {
        class: "menu-mes-item menu-mes-item--peligro",
        type: "button",
        onClick: () =>
          conBloqueo(async () => {
            cerrarMenu();
            if (
              !confirm(
                `¿Borrar los ${movimientos.length} movimientos estimados de ${etiquetaActual}? Esta acción no se puede deshacer.`
              )
            )
              return;
            await borrarMesEstimado(rango.desde, rango.hasta);
            await recargar();
            aviso.textContent = `Se borraron los movimientos estimados de ${etiquetaActual}.`;
          }),
      },
      ["Borrar datos del mes"]
    );

    popover.append(btnCopiar, btnEstado, btnBorrar);
    return el("div", { class: "menu-mes-wrap" }, [btnMenu, popover]);
  }
}
