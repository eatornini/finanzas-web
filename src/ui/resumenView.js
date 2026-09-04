import { el, limpiar } from "./dom.js";
import { listarMovimientos } from "../data/movimientos.js";
import { calcularTotales, desglosarPorPago, filtrarParaCalculos } from "../logic/totales.js";
import { formatoCLP } from "../logic/dinero.js";
import { prefs } from "../prefs.js";
import { ojoIcono, ojoTachadoIcono } from "./iconos.js";

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

export async function montarResumen(contenedor, { rango, modo }) {
  limpiar(contenedor);

  const error = el("p", { class: "error", role: "alert" });
  const oculto = prefs.get("ocultarTotal");
  const btnOjo = el(
    "button",
    {
      class: "boton--icono boton-ojo",
      "aria-label": oculto ? "Mostrar montos" : "Ocultar montos",
      title: oculto ? "Mostrar montos" : "Ocultar montos",
      "aria-pressed": String(oculto),
      onClick: () => {
        prefs.set("ocultarTotal", !prefs.get("ocultarTotal"));
        montarResumen(contenedor, { rango, modo });
      },
    },
    [oculto ? ojoTachadoIcono() : ojoIcono()]
  );
  const cifras = el("div", { class: "cifras" });
  contenedor.append(el("div", { class: "resumen-cabecera" }, [btnOjo]), cifras, error);

  try {
    const movimientos = await listarMovimientos({ ...rango, modo });
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
  } catch (e) {
    error.textContent = "No se pudo cargar el resumen. ";
    error.append(
      el("button", {
        text: "Reintentar",
        onClick: () => montarResumen(contenedor, { rango, modo }),
      })
    );
  }
}
