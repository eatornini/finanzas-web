import { el, limpiar } from "./dom.js";
import { cerrarSesion } from "../auth.js";
import { prefs } from "../prefs.js";
import {
  rangoPeriodo,
  periodoAnterior,
  periodoSiguiente,
  etiquetaPeriodo,
} from "../logic/periodos.js";
import {
  flechaIzq,
  flechaDer,
  salir,
  listaIcono,
  relojIcono,
  etiquetaIcono,
  graficoIcono,
  engranajeIcono,
  solIcono,
  lunaIcono,
  chevronAbajo,
  lupaIcono,
} from "./iconos.js";
import { montarMovimientos } from "./movimientosView.js";
import { montarResumen } from "./resumenView.js";
import { montarCategorias } from "./categoriasView.js";
import { montarBuscador } from "./buscadorView.js";
import { montarReportes } from "./reportesView.js";
import { montarPlaceholder } from "./placeholderView.js";

const VISTAS = [
  { clave: "movimientos", titulo: "Movimientos", icono: listaIcono, montar: montarMovimientos },
  { clave: "resumen", titulo: "Resumen", icono: relojIcono, montar: montarResumen },
  { clave: "categorias", titulo: "Categorías", icono: etiquetaIcono, montar: montarCategorias },
  { clave: "buscar", titulo: "Buscar", icono: lupaIcono, montar: montarBuscador },
  { clave: "reportes", titulo: "Reportes", icono: graficoIcono, montar: montarReportes },
  {
    clave: "configuracion",
    titulo: "Configuración",
    icono: engranajeIcono,
    montar: (c) =>
      montarPlaceholder(c, {
        icono: engranajeIcono,
        titulo: "Configuración",
        descripcion: "Próximamente: preferencias de la cuenta y la aplicación.",
      }),
  },
];

function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
}

function ymdLocal(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function nombreDesdeEmail(email) {
  if (!email) return "Cuenta";
  const local = email.split("@")[0];
  const partes = local.split(/[._-]+/).filter(Boolean);
  return partes.map((p) => p[0].toUpperCase() + p.slice(1)).join(" ") || local;
}

function inicialesDesdeNombre(nombre) {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] || "") + (partes[1]?.[0] || "")).toUpperCase() || "?";
}

export function montarShell(contenedor, sesion) {
  limpiar(contenedor);

  let tipo = prefs.get("periodoTipo");
  const fechaGuardada = prefs.get("fechaRef");
  let fechaRef = fechaGuardada ? new Date(`${fechaGuardada}T12:00:00`) : new Date();
  let activa = "movimientos";
  let modo = prefs.get("modo");
  let tema = prefs.get("tema");
  aplicarTema(tema);

  const cuerpo = el("main", { class: "cuerpo" });
  const etiqueta = el("span", { class: "periodo-label" });

  function pintarVista() {
    const rango = rangoPeriodo(fechaRef, tipo);
    etiqueta.textContent = etiquetaPeriodo(fechaRef, tipo);
    const vista = VISTAS.find((v) => v.clave === activa);
    vista.montar(cuerpo, { rango, tipo, fechaRef, modo });
  }

  const btnTipo = {};
  for (const t of ["semana", "mes", "año"]) {
    btnTipo[t] = el("button", {
      text: t[0].toUpperCase() + t.slice(1),
      onClick: () => {
        tipo = t;
        prefs.set("periodoTipo", t);
        sincronizarTipo();
        pintarVista();
      },
    });
  }
  function sincronizarTipo() {
    for (const t of ["semana", "mes", "año"]) {
      btnTipo[t].classList.toggle("activo", tipo === t);
    }
  }

  const btnModo = {};
  for (const m of ["real", "estimado"]) {
    btnModo[m] = el("button", {
      text: m === "real" ? "Real" : "Estimado",
      onClick: () => {
        modo = m;
        prefs.set("modo", modo);
        sincronizarModo();
        pintarVista();
      },
    });
  }
  function sincronizarModo() {
    for (const m of ["real", "estimado"]) {
      btnModo[m].classList.toggle("activo", modo === m);
    }
    sincronizarInactivosVisible();
  }
  const selectorModo = el("div", { class: "selector-modo" }, [
    btnModo.real,
    btnModo.estimado,
  ]);

  const btnInactivos = el("button", {
    class: "boton--chip",
    text: "Incluir inactivos",
    "aria-pressed": String(prefs.get("incluirInactivos")),
    onClick: () => {
      const on = !prefs.get("incluirInactivos");
      prefs.set("incluirInactivos", on);
      btnInactivos.setAttribute("aria-pressed", String(on));
      btnInactivos.classList.toggle("activo", on);
      pintarVista();
    },
  });
  btnInactivos.classList.toggle("activo", prefs.get("incluirInactivos"));
  function sincronizarInactivosVisible() {
    btnInactivos.hidden = modo !== "estimado";
  }

  const iconoTema = el("span", { class: "icono-tema" }, [tema === "oscuro" ? lunaIcono() : solIcono()]);
  const btnTema = el(
    "button",
    {
      class: "boton--icono boton-tema",
      "aria-label": "Cambiar tema",
      title: "Cambiar tema",
      onClick: () => {
        tema = tema === "oscuro" ? "claro" : "oscuro";
        prefs.set("tema", tema);
        aplicarTema(tema);
        limpiar(iconoTema);
        iconoTema.append(tema === "oscuro" ? lunaIcono() : solIcono());
      },
    },
    [iconoTema]
  );

  const selectorPeriodo = el("div", { class: "selector-periodo" }, [
    el("div", { class: "selector-tipo" }, [btnTipo.semana, btnTipo.mes, btnTipo["año"]]),
    el("div", { class: "navegador-periodo" }, [
      el(
        "button",
        {
          class: "boton--icono",
          "aria-label": "Período anterior",
          onClick: () => {
            fechaRef = periodoAnterior(fechaRef, tipo);
            prefs.set("fechaRef", ymdLocal(fechaRef));
            pintarVista();
          },
        },
        [flechaIzq()]
      ),
      etiqueta,
      el(
        "button",
        {
          class: "boton--icono",
          "aria-label": "Período siguiente",
          onClick: () => {
            fechaRef = periodoSiguiente(fechaRef, tipo);
            prefs.set("fechaRef", ymdLocal(fechaRef));
            pintarVista();
          },
        },
        [flechaDer()]
      ),
    ]),
  ]);

  const botonesNav = VISTAS.map((v) =>
    el(
      "button",
      {
        class: "nav-boton",
        onClick: () => {
          activa = v.clave;
          sincronizarNav();
          pintarVista();
        },
      },
      [el("span", { class: "nav-icono" }, [v.icono()]), v.titulo]
    )
  );
  function sincronizarNav() {
    botonesNav.forEach((b, i) =>
      b.classList.toggle("activo", VISTAS[i].clave === activa)
    );
  }
  const nav = el("nav", { class: "nav" }, botonesNav);

  const email = sesion?.user?.email || "";
  const nombre = nombreDesdeEmail(email);
  const iniciales = inicialesDesdeNombre(nombre);

  const perfil = el("div", { class: "perfil" }, [
    el("span", { class: "perfil-avatar", text: iniciales }),
    el("div", { class: "perfil-info" }, [
      el("span", { class: "perfil-nombre", text: nombre }),
      el("span", { class: "perfil-email", text: email }),
    ]),
    chevronAbajo(),
  ]);

  const btnSalir = el(
    "button",
    { class: "boton-salir", onClick: () => cerrarSesion() },
    [salir(), "Salir"]
  );

  const sidebar = el("aside", { class: "sidebar" }, [
    el("div", { class: "marca" }, [
      el("span", { class: "marca-logo", text: "$" }),
      el("div", { class: "marca-texto" }, [
        el("span", { class: "marca-nombre", text: "Finanzas" }),
        el("span", { class: "marca-lema", text: "Controla tu dinero" }),
      ]),
    ]),
    nav,
    el("div", { class: "sidebar-pie" }, [perfil, btnSalir]),
  ]);

  const topbar = el("header", { class: "topbar" }, [
    el("div", { class: "marca-movil", text: "Finanzas" }),
    selectorPeriodo,
    el("div", { class: "topbar-derecha" }, [selectorModo, btnInactivos, btnTema]),
  ]);

  const piePagina = el("footer", { class: "pie-app" }, [
    el("span", { text: "Finanzas v2.4" }),
    el("span", { class: "pie-punto", text: "·" }),
    el("span", { text: "Tus datos están seguros" }),
  ]);

  const principal = el("div", { class: "principal" }, [topbar, cuerpo, piePagina]);
  const app = el("div", { class: "app" }, [sidebar, principal]);

  contenedor.append(app);
  sincronizarTipo();
  sincronizarModo();
  sincronizarNav();
  pintarVista();
}
