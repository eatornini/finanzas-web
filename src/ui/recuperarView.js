import { el, limpiar } from "./dom.js";
import { actualizarPassword, cerrarSesion } from "../auth.js";
import { validarPasswordNueva } from "../logic/cuentas.js";

// Pantalla "fijar contraseña nueva". El router la monta cuando Supabase
// emite el evento PASSWORD_RECOVERY (o al abrir la app con el hash
// #recuperar y una sesión de recuperación activa).
export function montarRecuperar(contenedor) {
  limpiar(contenedor);

  const error = el("p", { class: "error", role: "alert" });
  const aviso = el("p", { class: "login-aviso" });

  const pass = el("input", {
    type: "password",
    placeholder: "Nueva contraseña",
    autocomplete: "new-password",
    required: "true",
  });
  const pass2 = el("input", {
    type: "password",
    placeholder: "Repetir contraseña",
    autocomplete: "new-password",
    required: "true",
  });
  const boton = el("button", { type: "submit", class: "boton--primario", text: "Guardar contraseña" });

  const form = el(
    "form",
    {
      class: "login",
      onSubmit: async (ev) => {
        ev.preventDefault();
        error.textContent = "";
        aviso.textContent = "";
        const v = validarPasswordNueva(pass.value, pass2.value);
        if (!v.ok) {
          error.textContent = v.error;
          return;
        }
        boton.disabled = true;
        boton.textContent = "Guardando…";
        try {
          await actualizarPassword(pass.value);
          // Limpia el hash y deja que el router monte la app (ya hay sesión).
          history.replaceState(null, "", location.pathname + location.search);
          aviso.textContent = "Contraseña actualizada. Entrando…";
          location.reload();
        } catch (e) {
          error.textContent =
            "No se pudo actualizar la contraseña. El enlace pudo haber expirado; solicita uno nuevo.";
          boton.disabled = false;
          boton.textContent = "Guardar contraseña";
        }
      },
    },
    [
      el("h1", { text: "Nueva contraseña" }),
      el("p", { class: "login-nota", text: "Elige una contraseña para tu cuenta." }),
      pass,
      pass2,
      boton,
      error,
      aviso,
      el("div", { class: "login-cambiar" }, [
        el("button", {
          type: "button",
          class: "login-enlace",
          text: "Cancelar",
          onClick: async () => {
            await cerrarSesion();
            history.replaceState(null, "", location.pathname + location.search);
            location.reload();
          },
        }),
      ]),
    ]
  );

  contenedor.append(form);
}
