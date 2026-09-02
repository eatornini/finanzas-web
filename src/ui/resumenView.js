import { el, limpiar } from "./dom.js";
import { listarMovimientos } from "../data/movimientos.js";
import { calcularTotales, desglosarPorPago } from "../logic/totales.js";

function fmt(n) {
  return Number(n).toLocaleString("es", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function tarjeta(titulo, valor, clase) {
  return el("div", { class: `tarjeta ${clase}` }, [
    el("span", { class: "titulo", text: titulo }),
    el("span", { class: "valor", text: fmt(valor) }),
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
  const cifras = el("div", { class: "cifras" });
  contenedor.append(cifras, error);

  try {
    const movimientos = await listarMovimientos({ ...rango, modo });
    if (modo === "estimado") {
      const d = desglosarPorPago(movimientos);
      cifras.append(
        el("div", { class: "grupos" }, [
          grupo("Estimado", d.total),
          grupo("Pagado", d.pagado),
          grupo("Pendiente", d.pendiente),
        ])
      );
    } else {
      const { ingresos, gastos, balance } = calcularTotales(movimientos);
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
