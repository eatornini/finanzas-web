import { limpiar } from "./dom.js";
import { sesionActual, alCambiarSesion } from "../auth.js";
import { montarLogin } from "./loginView.js";
import { montarShell } from "./shell.js";

const raiz = () => document.getElementById("app");

export async function iniciarRouter() {
  pintar(await sesionActual());
  alCambiarSesion((sesion) => pintar(sesion));
}

function pintar(sesion) {
  const contenedor = raiz();
  limpiar(contenedor);
  if (sesion) montarShell(contenedor, sesion);
  else montarLogin(contenedor);
}
