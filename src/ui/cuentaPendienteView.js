import { el, limpiar } from "./dom.js";
import { cerrarSesion } from "../auth.js";
import { mensajeEstadoCuenta } from "../logic/cuentas.js";

// Se muestra a un usuario logueado cuya cuenta no está 'activa'
// (pendiente de aprobación, deshabilitada o rechazada).
export function montarCuentaPendiente(contenedor, perfil) {
  limpiar(contenedor);

  const estado = perfil?.estado || "pendiente";
  const titulo = estado === "pendiente" ? "Cuenta pendiente" : "Sin acceso";

  contenedor.append(
    el("div", { class: "login" }, [
      el("h1", { text: titulo }),
      el("p", { class: "login-nota", text: mensajeEstadoCuenta(estado) }),
      perfil?.email ? el("p", { class: "login-nota", text: perfil.email }) : null,
      el("button", {
        class: "boton--primario",
        text: "Cerrar sesión",
        onClick: () => cerrarSesion(),
      }),
    ])
  );
}
