import { el, limpiar } from "./dom.js";
import { cerrarSesion } from "../auth.js";
import {
  rangoPeriodo,
  periodoAnterior,
  periodoSiguiente,
  etiquetaPeriodo,
} from "../logic/periodos.js";
import { montarMovimientos } from "./movimientosView.js";
import { montarResumen } from "./resumenView.js";
import { montarCategorias } from "./categoriasView.js";

const VISTAS = [
  { clave: "movimientos", titulo: "Movimientos", montar: montarMovimientos },
  { clave: "resumen", titulo: "Resumen", montar: montarResumen },
  { clave: "categorias", titulo: "Categorías", montar: montarCategorias },
];

export function montarShell(contenedor) {
  limpiar(contenedor);

  let fechaRef = new Date();
  let tipo = "mes";
  let activa = "movimientos";
  let modo =
    localStorage.getItem("finanzas.modo") === "estimado" ? "estimado" : "real";

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
        localStorage.setItem("finanzas.modo", modo);
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

  const selectorPeriodo = el("div", { class: "selector-periodo" }, [
    btnTipo.semana,
    btnTipo.mes,
    btnTipo["año"],
    el("button", {
      text: "‹",
      "aria-label": "Período anterior",
      onClick: () => {
        fechaRef = periodoAnterior(fechaRef, tipo);
        pintarVista();
      },
    }),
    etiqueta,
    el("button", {
      text: "›",
      "aria-label": "Período siguiente",
      onClick: () => {
        fechaRef = periodoSiguiente(fechaRef, tipo);
        pintarVista();
      },
    }),
  ]);

  const botonesNav = VISTAS.map((v) =>
    el("button", {
      text: v.titulo,
      onClick: () => {
        activa = v.clave;
        sincronizarNav();
        pintarVista();
      },
    })
  );
  function sincronizarNav() {
    botonesNav.forEach((b, i) => b.classList.toggle("activo", VISTAS[i].clave === activa));
  }
  const nav = el("nav", { class: "nav" }, botonesNav);

  const barra = el("header", { class: "barra" }, [
    el("strong", { text: "Finanzas" }),
    el("button", { class: "salir", text: "Salir", onClick: () => cerrarSesion() }),
  ]);

  contenedor.append(barra, selectorPeriodo, selectorModo, nav, cuerpo);
  sincronizarTipo();
  sincronizarModo();
  sincronizarNav();
  pintarVista();
}
