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
  intercambioIcono,
  tendenciaCombinadaIcono,
  etiquetasIcono,
  reporteIcono,
  engranajeIcono,
  escudoIcono,
  solIcono,
  lunaIcono,
  chevronAbajo,
  lupaIcono,
  menuIcono,
  logoAppIcono,
} from "./iconos.js";
import { montarMovimientos } from "./movimientosView.js";
import { montarResumen } from "./resumenView.js";
import { montarCategorias } from "./categoriasView.js";
import { montarBuscador } from "./buscadorView.js";
import { montarReportes } from "./reportesView.js";
import { montarConfiguracion } from "./configuracionView.js";
import { montarAdmin } from "./adminView.js";
import { registrarAcceso } from "../data/perfil.js";

const VISTAS_BASE = [
  { clave: "movimientos", titulo: "Movimientos", icono: intercambioIcono, montar: montarMovimientos },
  { clave: "resumen", titulo: "Resumen", icono: tendenciaCombinadaIcono, montar: montarResumen },
  { clave: "categorias", titulo: "Categorías", icono: etiquetasIcono, montar: montarCategorias },
  { clave: "buscar", titulo: "Buscar", icono: lupaIcono, montar: montarBuscador },
  { clave: "reportes", titulo: "Reportes", icono: reporteIcono, montar: montarReportes },
  { clave: "configuracion", titulo: "Configuración", icono: engranajeIcono, montar: montarConfiguracion },
];

// Solo visible para cuentas admin (ver montarShell).
const VISTA_ADMIN = {
  clave: "admin",
  titulo: "Administración",
  icono: escudoIcono,
  montar: montarAdmin,
};

function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
}

// La vista guardada en prefs puede quedar obsoleta (clave renombrada, dato
// corrupto, o "admin" guardada por alguien que ya no es admin); si no está
// en `vistas`, se cae a "movimientos".
function vistaValida(clave, vistas) {
  return vistas.some((v) => v.clave === clave) ? clave : "movimientos";
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

export function montarShell(contenedor, sesion, perfil) {
  limpiar(contenedor);

  // El menú "Administración" solo existe para cuentas admin.
  const VISTAS = perfil?.rol === "admin" ? [...VISTAS_BASE, VISTA_ADMIN] : VISTAS_BASE;

  // Marca de último acceso (best-effort, no bloquea el render).
  registrarAcceso();

  let tipo = prefs.get("periodoTipo");
  const fechaGuardada = prefs.get("fechaRef");
  let fechaRef = fechaGuardada ? new Date(`${fechaGuardada}T12:00:00`) : new Date();
  let activa = vistaValida(prefs.get("vistaActiva"), VISTAS);
  let modo = prefs.get("modo");
  let tema = prefs.get("tema");
  aplicarTema(tema);

  const cuerpo = el("main", { class: "cuerpo" });
  const etiqueta = el("span", { class: "periodo-label" });

  function pintarVista() {
    const rango = rangoPeriodo(fechaRef, tipo);
    etiqueta.textContent = etiquetaPeriodo(fechaRef, tipo);
    const vista = VISTAS.find((v) => v.clave === activa);
    vista.montar(cuerpo, { rango, tipo, fechaRef, modo, irA });
  }

  const ETIQUETAS_TIPO = { semana: "Sem", mes: "Mes", año: "Año" };
  const btnTipo = {};
  for (const t of ["semana", "mes", "año"]) {
    btnTipo[t] = el("button", {
      text: ETIQUETAS_TIPO[t],
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
  }
  const selectorModo = el("div", { class: "selector-modo" }, [
    btnModo.real,
    btnModo.estimado,
  ]);

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

  function irA(clave) {
    activa = clave;
    prefs.set("vistaActiva", clave);
    sincronizarNav();
    pintarVista();
    cerrarDrawer();
  }

  const botonesNav = VISTAS.map((v) =>
    el(
      "button",
      { class: "nav-boton", onClick: () => irA(v.clave) },
      [el("span", { class: "nav-icono" }, [v.icono()]), v.titulo]
    )
  );
  function sincronizarNav() {
    botonesNav.forEach((b, i) => b.classList.toggle("activo", VISTAS[i].clave === activa));
  }
  const nav = el("nav", { class: "nav" }, botonesNav);

  // --- Drawer (mobile): reutiliza el mismo `sidebar` de siempre, mostrado
  // como panel off-canvas en vez de fijo, disparado por el botón ☰.
  let drawerAbierto = false;
  const drawerFondo = el("div", { class: "drawer-fondo", onClick: () => cerrarDrawer() });
  function abrirDrawer() {
    if (drawerAbierto) return;
    drawerAbierto = true;
    sidebar.classList.add("abierto");
    drawerFondo.classList.add("visible");
    document.addEventListener("keydown", alTeclearDrawer);
  }
  function cerrarDrawer() {
    if (!drawerAbierto) return;
    drawerAbierto = false;
    sidebar.classList.remove("abierto");
    drawerFondo.classList.remove("visible");
    document.removeEventListener("keydown", alTeclearDrawer);
  }
  function alTeclearDrawer(ev) {
    if (ev.key === "Escape") cerrarDrawer();
  }

  const btnMenu = el(
    "button",
    { class: "boton--icono boton-menu", "aria-label": "Abrir menú", onClick: () => abrirDrawer() },
    [menuIcono()]
  );

  const email = sesion?.user?.email || "";
  const nombre = nombreDesdeEmail(email);
  const iniciales = inicialesDesdeNombre(nombre);

  const perfilNodo = el("div", { class: "perfil" }, [
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
      el("span", { class: "marca-logo" }, [logoAppIcono()]),
      el("div", { class: "marca-texto" }, [
        el("span", { class: "marca-nombre", text: "Finanzas" }),
        el("span", { class: "marca-lema", text: "Controla tu dinero" }),
      ]),
      btnTema,
    ]),
    nav,
    el("div", { class: "sidebar-pie" }, [perfilNodo, btnSalir]),
  ]);

  const topbar = el("header", { class: "topbar" }, [
    el("div", { class: "topbar-marca-movil" }, [btnMenu, el("span", { class: "marca-movil", text: "Finanzas" })]),
    selectorPeriodo,
    el("div", { class: "topbar-derecha" }, [selectorModo]),
  ]);

  const piePagina = el("footer", { class: "pie-app" }, [
    el("span", { text: "Finanzas v3.12" }),
    el("span", { class: "pie-punto", text: "·" }),
    el("span", { text: "Tus datos están seguros" }),
  ]);

  const principal = el("div", { class: "principal" }, [topbar, cuerpo, piePagina]);
  const app = el("div", { class: "app" }, [sidebar, drawerFondo, principal]);

  contenedor.append(app);
  sincronizarTipo();
  sincronizarModo();
  sincronizarNav();
  pintarVista();
}
