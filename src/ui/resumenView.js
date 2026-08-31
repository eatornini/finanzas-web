import { el, limpiar } from "./dom.js";
import { listarMovimientos } from "../data/movimientos.js";
import { calcularTotales } from "../logic/totales.js";

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

export async function montarResumen(contenedor, { rango }) {
  limpiar(contenedor);

  const error = el("p", { class: "error", role: "alert" });
  const cifras = el("div", { class: "cifras" });
  contenedor.append(cifras, error);

  try {
    const movimientos = await listarMovimientos(rango);
    const { ingresos, gastos, balance } = calcularTotales(movimientos);
    cifras.append(
      tarjeta("Ingresos", ingresos, "ingreso"),
      tarjeta("Gastos", gastos, "gasto"),
      tarjeta("Balance", balance, balance >= 0 ? "ingreso" : "gasto")
    );
  } catch (e) {
    error.textContent = "No se pudo cargar el resumen. ";
    error.append(
      el("button", {
        text: "Reintentar",
        onClick: () => montarResumen(contenedor, { rango }),
      })
    );
  }
}
