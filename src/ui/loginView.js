import { el, limpiar } from "./dom.js";
import { iniciarSesion, registrarse, enviarResetPassword } from "../auth.js";
import { validarRegistro } from "../logic/cuentas.js";
import {
  billeteraIcono,
  graficoIcono,
  graficoTortaIcono,
  escudoIcono,
  utensiliosIcono,
  carroIcono,
  saludPulsoIcono,
  alcanciaIcono,
  flechaArribaCirculo,
} from "./iconos.js";

// Vista de acceso con tres modos dentro de la misma tarjeta .login:
//   login    → email + contraseña
//   registro → crear cuenta (queda pendiente de aprobación)
//   reset    → pedir enlace de recuperación por email
// La tarjeta del formulario vive en la columna derecha de una composición de
// dos áreas (.login-pagina); a la izquierda va la identidad de Finanzas + una
// ilustración financiera construida con HTML/CSS (sin imágenes).
export function montarLogin(contenedor) {
  limpiar(contenedor);

  const form = el("form", { class: "login" });
  contenedor.append(
    el("div", { class: "login-pagina" }, [
      ladoIdentidad(),
      el("div", { class: "login-form-col" }, [
        el("div", { class: "login-mini-marca" }, [
          el("span", { class: "login-mini-marca-logo" }, [billeteraIcono()]),
          el("span", { text: "Finanzas" }),
        ]),
        form,
      ]),
    ])
  );

  let modo = location.hash === "#registro" ? "registro" : "login";
  let cargando = false;
  let campos = {};

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (cargando) return;
    if (modo === "login") await enviarLogin();
    else if (modo === "registro") await enviarRegistro();
    else await enviarReset();
  });

  // --- helpers de construcción -------------------------------------------------

  function campo(props) {
    return el("input", { required: "true", ...props });
  }

  function enlace(texto, destino) {
    return el("button", {
      type: "button",
      class: "login-enlace",
      text: texto,
      onClick: () => {
        modo = destino;
        render();
      },
    });
  }

  function botonEnvio(texto) {
    return el("button", { type: "submit", class: "boton--primario", text: texto });
  }

  const error = el("p", { class: "error", role: "alert" });
  const aviso = el("p", { class: "login-aviso" });

  function limpiarMensajes() {
    error.textContent = "";
    aviso.textContent = "";
  }

  function setCargando(boton, activo, textoBase) {
    cargando = activo;
    boton.disabled = activo;
    boton.textContent = activo ? "Un momento…" : textoBase;
  }

  // --- render por modo -------------------------------------------------------

  function render() {
    limpiar(form);
    limpiarMensajes();
    if (modo === "registro") return pintarRegistro();
    if (modo === "reset") return pintarReset();
    return pintarLogin();
  }

  function pintarLogin() {
    const email = campo({ type: "email", placeholder: "Email", autocomplete: "username" });
    const pass = campo({ type: "password", placeholder: "Contraseña", autocomplete: "current-password" });
    const boton = botonEnvio("Entrar");
    form.append(
      el("h1", { text: "Bienvenido de vuelta" }),
      el("p", { class: "login-nota", text: "Inicia sesión en tu cuenta para continuar." }),
      email,
      pass,
      boton,
      error,
      el("div", { class: "login-cambiar" }, [
        enlace("¿Olvidaste tu contraseña?", "reset"),
        enlace("Crear cuenta", "registro"),
      ])
    );
    campos = { email, pass, boton };
  }

  function pintarRegistro() {
    const email = campo({ type: "email", placeholder: "Email", autocomplete: "username" });
    const pass = campo({ type: "password", placeholder: "Contraseña", autocomplete: "new-password" });
    const pass2 = campo({ type: "password", placeholder: "Repetir contraseña", autocomplete: "new-password" });
    const boton = botonEnvio("Crear cuenta");
    form.append(
      el("h1", { text: "Crear cuenta" }),
      email,
      pass,
      pass2,
      boton,
      error,
      aviso,
      el("div", { class: "login-cambiar" }, [enlace("Ya tengo cuenta", "login")])
    );
    campos = { email, pass, pass2, boton };
  }

  function pintarReset() {
    const email = campo({ type: "email", placeholder: "Email", autocomplete: "username" });
    const boton = botonEnvio("Enviarme el enlace");
    form.append(
      el("h1", { text: "Recuperar contraseña" }),
      el("p", { class: "login-nota", text: "Te enviaremos un enlace para crear una contraseña nueva." }),
      email,
      boton,
      error,
      aviso,
      el("div", { class: "login-cambiar" }, [enlace("Volver a iniciar sesión", "login")])
    );
    campos = { email, boton };
  }

  // --- envíos --------------------------------------------------------------

  async function enviarLogin() {
    const { email, pass, boton } = campos;
    limpiarMensajes();
    setCargando(boton, true, "Entrar");
    try {
      await iniciarSesion(email.value.trim(), pass.value);
      // El router reacciona vía alCambiarSesion.
    } catch (e) {
      error.textContent = "No se pudo iniciar sesión. Revisa tus datos.";
      setCargando(boton, false, "Entrar");
    }
  }

  async function enviarRegistro() {
    const { email, pass, pass2, boton } = campos;
    limpiarMensajes();
    const v = validarRegistro({ email: email.value.trim(), pass: pass.value, pass2: pass2.value });
    if (!v.ok) {
      error.textContent = v.error;
      return;
    }
    setCargando(boton, true, "Crear cuenta");
    try {
      await registrarse(email.value.trim(), pass.value);
      // Éxito: dejar solo el mensaje y el enlace de vuelta.
      limpiar(form);
      form.append(
        el("h1", { text: "Registro recibido" }),
        el("p", {
          class: "login-aviso",
          text: "Un administrador debe aprobar tu cuenta antes de que puedas entrar. Te avisaremos cuando esté lista.",
        }),
        el("div", { class: "login-cambiar" }, [enlace("Volver a iniciar sesión", "login")])
      );
    } catch (e) {
      const ya = /registered|already/i.test(e?.message || "");
      error.textContent = ya
        ? "Ya existe una cuenta con ese email."
        : "No se pudo crear la cuenta. Intenta de nuevo.";
      setCargando(boton, false, "Crear cuenta");
    }
  }

  async function enviarReset() {
    const { email, boton } = campos;
    limpiarMensajes();
    setCargando(boton, true, "Enviarme el enlace");
    try {
      await enviarResetPassword(email.value.trim());
    } catch (_e) {
      // No se distingue el caso "email no existe" para no filtrar cuentas.
    }
    aviso.textContent =
      "Si el email corresponde a una cuenta, te enviamos un enlace para restablecer la contraseña.";
    setCargando(boton, false, "Enviarme el enlace");
  }

  render();
}

// --- Columna de identidad (solo visible en pantallas anchas) ----------------

function ladoIdentidad() {
  return el("aside", { class: "login-aside", "aria-hidden": "true" }, [
    el("div", { class: "login-marca" }, [
      el("span", { class: "login-marca-logo" }, [billeteraIcono()]),
      el("div", { class: "login-marca-txt" }, [
        el("span", { class: "login-marca-nombre", text: "Finanzas" }),
        el("span", { class: "login-marca-tagline", text: "Controla tu dinero, vive tranquilo" }),
      ]),
    ]),
    el("div", { class: "login-hero" }, [
      el("h2", { class: "login-hero-titulo", text: "Tus finanzas en un solo lugar" }),
      el("p", {
        class: "login-hero-sub",
        text:
          "Registra tus gastos, organiza tus categorías y toma mejores decisiones para alcanzar tus objetivos.",
      }),
    ]),
    el("ul", { class: "login-features" }, [
      featureItem(graficoIcono, "azul", "Control total", "Visualiza tus ingresos y gastos"),
      featureItem(graficoTortaIcono, "violeta", "Organiza", "Crea tus propias categorías"),
      featureItem(escudoIcono, "verde", "Más tranquilidad", "Toma el control de tu futuro"),
    ]),
    ilustracionFinanzas(),
  ]);
}

function featureItem(fabricaIcono, tono, titulo, desc) {
  return el("li", { class: `login-feature login-feature--${tono}` }, [
    el("span", { class: "login-feature-icono" }, [fabricaIcono()]),
    el("div", { class: "login-feature-txt" }, [
      el("span", { class: "login-feature-titulo", text: titulo }),
      el("span", { class: "login-feature-desc", text: desc }),
    ]),
  ]);
}

// Composición financiera: gráfico de barras de fondo + tarjetas flotantes
// ("Balance del mes" y categorías) ligeramente superpuestas. Puramente
// decorativa y construida con nodos, sin imágenes.
function ilustracionFinanzas() {
  const alturas = [40, 58, 48, 76, 44, 92, 60, 100];
  const barras = alturas.map((h) => {
    const b = el("span", { class: "login-ilu-barra" });
    b.style.height = `${h}%`;
    return b;
  });

  return el("div", { class: "login-ilu", "aria-hidden": "true" }, [
    el("span", { class: "login-ilu-chispa" }, [el("i"), el("i"), el("i")]),
    el("div", { class: "login-ilu-grafico" }, barras),
    el("div", { class: "login-ilu-tarjeta login-ilu-tarjeta--balance" }, [
      el("span", { class: "login-ilu-balance-icono" }, [flechaArribaCirculo()]),
      el("div", { class: "login-ilu-balance-txt" }, [
        el("span", { class: "login-ilu-balance-label", text: "Balance del mes" }),
        el("span", { class: "login-ilu-balance-valor", text: "$102.112" }),
      ]),
    ]),
    el("div", { class: "login-ilu-tarjeta login-ilu-tarjeta--cats" }, [
      catFila(utensiliosIcono, "alimentos", "Alimentos", "- $42.830", "neg"),
      catFila(carroIcono, "transporte", "Transporte", "- $20.000", "neg"),
      catFila(saludPulsoIcono, "salud", "Salud", "- $15.500", "neg"),
      catFila(alcanciaIcono, "ahorro", "Ahorro", "+ $50.000", "pos"),
    ]),
  ]);
}

function catFila(fabricaIcono, tono, nombre, monto, signo) {
  return el("div", { class: `login-ilu-cat login-ilu-cat--${tono}` }, [
    el("span", { class: "login-ilu-cat-icono" }, [fabricaIcono()]),
    el("span", { class: "login-ilu-cat-nombre", text: nombre }),
    el("span", { class: `login-ilu-cat-monto login-ilu-cat-monto--${signo}`, text: monto }),
  ]);
}
