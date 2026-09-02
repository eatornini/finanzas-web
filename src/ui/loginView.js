import { el, limpiar } from "./dom.js";
import { iniciarSesion } from "../auth.js";

export function montarLogin(contenedor) {
  limpiar(contenedor);

  const error = el("p", { class: "error", role: "alert" });
  const email = el("input", {
    type: "email",
    placeholder: "Email",
    required: "true",
    autocomplete: "username",
  });
  const pass = el("input", {
    type: "password",
    placeholder: "Contraseña",
    required: "true",
    autocomplete: "current-password",
  });
  const boton = el("button", {
    type: "submit",
    class: "boton--primario",
    text: "Entrar",
  });

  const form = el(
    "form",
    {
      class: "login",
      onSubmit: async (ev) => {
        ev.preventDefault();
        error.textContent = "";
        boton.disabled = true;
        boton.textContent = "Entrando…";
        try {
          await iniciarSesion(email.value.trim(), pass.value);
          // El router reacciona vía alCambiarSesion.
        } catch (e) {
          error.textContent = "No se pudo iniciar sesión. Revisa tus datos.";
          boton.disabled = false;
          boton.textContent = "Entrar";
        }
      },
    },
    [el("h1", { text: "Finanzas" }), email, pass, boton, error]
  );

  contenedor.append(form);
}
