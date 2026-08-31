import { el, limpiar } from "./dom.js";
import { sesionActual, alCambiarSesion, cerrarSesion } from "../auth.js";
import { montarLogin } from "./loginView.js";

const raiz = () => document.getElementById("app");

export async function iniciarRouter() {
  pintar(await sesionActual());
  alCambiarSesion((sesion) => pintar(sesion));
}

function pintar(sesion) {
  const contenedor = raiz();
  limpiar(contenedor);
  if (sesion) {
    // Stub temporal: se reemplaza por montarShell en la Tarea 5.
    contenedor.append(
      el("p", { text: "Sesión iniciada." }),
      el("button", { text: "Salir", onClick: () => cerrarSesion() })
    );
  } else {
    montarLogin(contenedor);
  }
}
