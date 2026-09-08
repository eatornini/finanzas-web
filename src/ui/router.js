import { limpiar } from "./dom.js";
import { sesionActual, alCambiarSesion, cerrarSesion } from "../auth.js";
import { miPerfil } from "../data/perfil.js";
import { cuentaActiva } from "../logic/cuentas.js";
import { montarLogin } from "./loginView.js";
import { montarShell } from "./shell.js";
import { montarRecuperar } from "./recuperarView.js";
import { montarCuentaPendiente } from "./cuentaPendienteView.js";

const raiz = () => document.getElementById("app");

export async function iniciarRouter() {
  let sesion = await sesionActual();
  // Enlace de recuperación de contraseña: Supabase deja el token en el hash
  // (`type=recovery`) y, tras procesarlo, emite el evento PASSWORD_RECOVERY.
  // El chequeo del hash solo evita un parpadeo del login antes del evento.
  let recuperando =
    location.hash.includes("type=recovery") || location.hash.includes("recuperar");

  await resolver(sesion, recuperando);

  // Supabase emite eventos de auth por muchos motivos que NO cambian quién
  // está logueado (TOKEN_REFRESHED, revalidación al volver el foco,
  // INITIAL_SESSION). Solo re-renderizamos cuando cambia la identidad o
  // cuando entra un flujo de recuperación.
  alCambiarSesion(async (nueva, evento) => {
    if (evento === "PASSWORD_RECOVERY") {
      recuperando = true;
      sesion = nueva;
      await resolver(nueva, true);
      return;
    }
    const idAntes = sesion?.user?.id ?? null;
    const idAhora = nueva?.user?.id ?? null;
    sesion = nueva;
    if (idAntes !== idAhora) {
      recuperando = false;
      await resolver(nueva, false);
    }
  });
}

async function resolver(sesion, recuperando) {
  const contenedor = raiz();
  limpiar(contenedor);

  if (recuperando) {
    montarRecuperar(contenedor);
    return;
  }
  if (!sesion) {
    montarLogin(contenedor);
    return;
  }

  // Con sesión: el acceso depende del estado del perfil.
  let perfil = null;
  try {
    perfil = await miPerfil();
  } catch (e) {
    // Sin poder leer el perfil no se puede autorizar: cerrar e ir al login.
    await cerrarSesion();
    limpiar(contenedor);
    montarLogin(contenedor);
    return;
  }

  if (cuentaActiva(perfil)) {
    montarShell(contenedor, sesion, perfil);
  } else {
    montarCuentaPendiente(contenedor, perfil);
  }
}
