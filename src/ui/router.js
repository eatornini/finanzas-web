import { limpiar } from "./dom.js";
import { sesionActual, alCambiarSesion } from "../auth.js";
import { montarLogin } from "./loginView.js";
import { montarShell } from "./shell.js";

const raiz = () => document.getElementById("app");

export async function iniciarRouter() {
  let sesion = await sesionActual();
  pintar(sesion);

  // Supabase emite eventos de auth por muchos motivos que NO cambian quién
  // está logueado: TOKEN_REFRESHED periódico, revalidación de sesión al
  // volver el foco a la pestaña, INITIAL_SESSION al arrancar. Reconstruir
  // toda la app en cada uno tira la vista activa y recarga datos sin razón.
  // Solo re-renderizamos cuando cambia la identidad: iniciar sesión, cerrarla
  // o cambiar de usuario. El paso a sesión nula por un 401 (verificar() hace
  // signOut) también entra acá y lleva al login.
  alCambiarSesion((nueva) => {
    const idAntes = sesion?.user?.id ?? null;
    const idAhora = nueva?.user?.id ?? null;
    sesion = nueva;
    if (idAntes !== idAhora) pintar(nueva);
  });
}

function pintar(sesion) {
  const contenedor = raiz();
  limpiar(contenedor);
  if (sesion) montarShell(contenedor, sesion);
  else montarLogin(contenedor);
}
