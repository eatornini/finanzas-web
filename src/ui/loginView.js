import { el, limpiar } from "./dom.js";
import { iniciarSesion, registrarse, enviarResetPassword } from "../auth.js";
import { validarRegistro } from "../logic/cuentas.js";
import {
  graficoIcono,
  graficoTortaIcono,
  escudoIcono,
  utensiliosIcono,
  carroIcono,
  saludPulsoIcono,
  alcanciaIcono,
  flechaArribaCirculo,
  sobreIcono,
  candadoIcono,
  ojoIcono,
  ojoTachadoIcono,
  usuarioMasIcono,
  flechaDer,
  logoAppIcono,
} from "./iconos.js";

// Vista de acceso con tres modos dentro de la misma tarjeta .login:
//   login    → email + contraseña
//   registro → crear cuenta (queda pendiente de aprobación)
//   reset    → pedir enlace de recuperación por email
// En escritorio, .login-pagina compone tres columnas independientes:
// identidad de Finanzas | ilustración financiera (HTML/CSS, sin imágenes) |
// tarjeta del formulario. En pantallas angostas se apilan verticalmente.
export function montarLogin(contenedor) {
  limpiar(contenedor);
  // Pantalla de acceso siempre en modo claro, sin importar el tema guardado
  // o el del sistema. El shell restaura el tema real al iniciar sesión.
  document.documentElement.dataset.tema = "claro";

  const form = el("form", { class: "login" });
  contenedor.append(
    el("div", { class: "login-pagina" }, [
      columnaIdentidad(),
      columnaIlustracion(),
      el("div", { class: "login-form-col" }, [form, pieLegal()]),
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

  let idSeqCampo = 0;

  // Campo con label arriba + icono embebido dentro del borde del input.
  // Si type es "password" agrega un botón de mostrar/ocultar contraseña.
  function campoConIcono({ label, fabricaIcono, type, placeholder, autocomplete }) {
    const id = `login-campo-${++idSeqCampo}`;
    const input = el("input", {
      id,
      type,
      placeholder,
      autocomplete,
      required: "true",
    });
    const hijos = [el("span", { class: "login-campo-icono" }, [fabricaIcono()]), input];

    if (type === "password") {
      const toggle = el(
        "button",
        { type: "button", class: "login-campo-toggle", "aria-label": "Mostrar contraseña" },
        [ojoIcono()]
      );
      toggle.addEventListener("click", () => {
        const visible = input.type === "text";
        input.type = visible ? "password" : "text";
        limpiar(toggle);
        toggle.append(visible ? ojoIcono() : ojoTachadoIcono());
        toggle.setAttribute("aria-label", visible ? "Mostrar contraseña" : "Ocultar contraseña");
      });
      hijos.push(toggle);
    }

    const campo = el("div", { class: "login-campo" }, [
      el("label", { for: id, class: "login-campo-label", text: label }),
      el("div", { class: "login-campo-caja" }, hijos),
    ]);
    return { campo, input };
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

  function botonEnvio(texto, fabricaIcono) {
    const hijos = [el("span", { text: texto })];
    if (fabricaIcono) hijos.push(fabricaIcono());
    return el("button", { type: "submit", class: "boton--primario login-boton-primario" }, hijos);
  }

  // Botón secundario con contorno ("Crear cuenta" / "Iniciar sesión") bajo
  // un divisor con texto, como cierre alternativo del formulario.
  function pieAlternativo(pregunta, textoBoton, fabricaIcono, destino) {
    const hijos = [];
    if (fabricaIcono) hijos.push(fabricaIcono());
    hijos.push(el("span", { text: textoBoton }));
    const boton = el(
      "button",
      { type: "button", class: "boton--secundario login-boton-secundario" },
      hijos
    );
    boton.addEventListener("click", () => {
      modo = destino;
      render();
    });
    return [
      el("div", { class: "login-divisor" }, [el("span", { text: pregunta })]),
      boton,
    ];
  }

  const error = el("p", { class: "error", role: "alert" });
  const aviso = el("p", { class: "login-aviso" });

  function limpiarMensajes() {
    error.textContent = "";
    aviso.textContent = "";
  }

  function setCargando(boton, activo, textoBase, fabricaIcono) {
    cargando = activo;
    boton.disabled = activo;
    limpiar(boton);
    if (activo) {
      boton.append(el("span", { text: "Un momento…" }));
      return;
    }
    boton.append(el("span", { text: textoBase }));
    if (fabricaIcono) boton.append(fabricaIcono());
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
    const { campo: campoEmail, input: email } = campoConIcono({
      label: "Correo electrónico",
      fabricaIcono: sobreIcono,
      type: "email",
      placeholder: "tu@email.com",
      autocomplete: "username",
    });
    const { campo: campoPass, input: pass } = campoConIcono({
      label: "Contraseña",
      fabricaIcono: candadoIcono,
      type: "password",
      placeholder: "••••••••",
      autocomplete: "current-password",
    });
    const boton = botonEnvio("Entrar", flechaDer);
    form.append(
      el("h1", { text: "Bienvenido de vuelta" }),
      el("p", { class: "login-nota", text: "Inicia sesión en tu cuenta para continuar." }),
      campoEmail,
      campoPass,
      el("div", { class: "login-olvido" }, [enlace("¿Olvidaste tu contraseña?", "reset")]),
      boton,
      error,
      ...pieAlternativo("¿No tienes una cuenta?", "Crear cuenta", usuarioMasIcono, "registro")
    );
    campos = { email, pass, boton };
  }

  function pintarRegistro() {
    const { campo: campoEmail, input: email } = campoConIcono({
      label: "Correo electrónico",
      fabricaIcono: sobreIcono,
      type: "email",
      placeholder: "tu@email.com",
      autocomplete: "username",
    });
    const { campo: campoPass, input: pass } = campoConIcono({
      label: "Contraseña",
      fabricaIcono: candadoIcono,
      type: "password",
      placeholder: "••••••••",
      autocomplete: "new-password",
    });
    const { campo: campoPass2, input: pass2 } = campoConIcono({
      label: "Repetir contraseña",
      fabricaIcono: candadoIcono,
      type: "password",
      placeholder: "••••••••",
      autocomplete: "new-password",
    });
    const boton = botonEnvio("Crear cuenta");
    form.append(
      el("h1", { text: "Crear cuenta" }),
      campoEmail,
      campoPass,
      campoPass2,
      boton,
      error,
      aviso,
      ...pieAlternativo("¿Ya tienes cuenta?", "Iniciar sesión", null, "login")
    );
    campos = { email, pass, pass2, boton };
  }

  function pintarReset() {
    const { campo: campoEmail, input: email } = campoConIcono({
      label: "Correo electrónico",
      fabricaIcono: sobreIcono,
      type: "email",
      placeholder: "tu@email.com",
      autocomplete: "username",
    });
    const boton = botonEnvio("Enviarme el enlace");
    form.append(
      el("h1", { text: "Recuperar contraseña" }),
      el("p", { class: "login-nota", text: "Te enviaremos un enlace para crear una contraseña nueva." }),
      campoEmail,
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
      setCargando(boton, false, "Entrar", flechaDer);
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

// --- Las tres columnas de la página de acceso -------------------------------
// En escritorio (.login-pagina en grid) quedan una al lado de otra:
// identidad | ilustración | formulario. En pantallas angostas (flex column)
// se apilan con orden identidad → formulario → ilustración vía `order` en
// el CSS, así el login queda arriba y la ilustración es lo último.

function columnaIdentidad() {
  return el("div", { class: "login-identidad", "aria-hidden": "true" }, [
    el("div", { class: "login-marca" }, [
      el("span", { class: "login-marca-logo" }, [logoAppIcono()]),
      el("div", { class: "login-marca-txt" }, [
        el("span", { class: "login-marca-nombre", text: "Finanzas" }),
        el("span", { class: "login-marca-tagline", text: "Controla tu dinero, vive tranquilo" }),
      ]),
    ]),
    el("div", { class: "login-hero" }, [
      el("h2", { class: "login-hero-titulo" }, ["Tus finanzas", el("br"), "en un solo lugar"]),
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
  ]);
}

function columnaIlustracion() {
  return el("div", { class: "login-ilu-col", "aria-hidden": "true" }, [ilustracionFinanzas()]);
}

// Texto legal bajo la tarjeta del formulario. Son spans con el color de
// enlace (no <a>) porque todavía no existen páginas de términos/privacidad;
// es solo el cierre visual que muestra la referencia de diseño.
function pieLegal() {
  return el("p", { class: "login-legal" }, [
    el("span", { text: "Al continuar, aceptas nuestros " }),
    el("span", { class: "login-legal-enlace", text: "Términos de uso" }),
    el("span", { text: " y " }),
    el("span", { class: "login-legal-enlace", text: "Política de privacidad" }),
    el("span", { text: "." }),
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
