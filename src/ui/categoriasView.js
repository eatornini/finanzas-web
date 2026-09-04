import { el, limpiar } from "./dom.js";
import { listarCategorias, actualizarCategoria, eliminarCategoria } from "../data/categorias.js";
import { abrirCategoriaForm } from "./categoriaForm.js";
import { nodoIconoCategoria } from "./iconoCategoria.js";
import { prefs } from "../prefs.js";
import { lapiz, basura, flechaArribaCirculo, flechaAbajoCirculo } from "./iconos.js";

export function montarCategorias(contenedor) {
  limpiar(contenedor);
  let modo = prefs.get("modo");
  let todas = [];
  const normalizados = new Set();

  const error = el("p", { class: "error", role: "alert" });
  const cuerpo = el("div", { class: "categorias-cuerpo" });

  const btnModo = {};
  for (const m of ["real", "estimado"]) {
    btnModo[m] = el("button", {
      text: m === "real" ? "Real" : "Estimado",
      class: modo === m ? "activo" : "",
      onClick: () => {
        modo = m;
        sincronizarModo();
        pintar();
      },
    });
  }
  function sincronizarModo() {
    for (const m of ["real", "estimado"]) btnModo[m].classList.toggle("activo", modo === m);
  }

  const btnNueva = el("button", {
    class: "boton--primario",
    text: "+ Nueva categoría",
    onClick: () =>
      abrirCategoriaForm({ modoInicial: modo, tipoInicial: "gasto", onGuardado: recargar }),
  });

  contenedor.append(
    el("div", { class: "categorias-cabecera" }, [
      el("div", { class: "selector-modo" }, [btnModo.real, btnModo.estimado]),
      btnNueva,
    ]),
    error,
    cuerpo
  );

  recargar();

  async function recargar() {
    error.textContent = "";
    try {
      todas = await listarCategorias();
      pintar();
    } catch (e) {
      error.textContent = "No se pudieron cargar las categorías.";
    }
  }

  async function normalizarOrden(grupo, clave) {
    // Si el grupo nunca se reordenó, todos los "orden" valen 0 y ↑/↓ no puede
    // intercambiar. Se asigna orden = índice una sola vez.
    const ordenes = grupo.map((c) => c.orden);
    const hayDuplicados = new Set(ordenes).size !== ordenes.length;
    if (!hayDuplicados || normalizados.has(clave)) return false;
    normalizados.add(clave);
    try {
      await Promise.all(
        grupo.map((c, i) => (c.orden === i ? null : actualizarCategoria(c.id, { orden: i })))
      );
      await recargar();
      return true;
    } catch (e) {
      error.textContent = "No se pudo ordenar las categorías.";
      return false;
    }
  }

  async function pintar() {
    limpiar(cuerpo);
    for (const tipo of ["gasto", "ingreso"]) {
      const clave = `${modo}-${tipo}`;
      const delGrupo = todas
        .filter((c) => c.modo === modo && c.tipo === tipo)
        .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
      if (delGrupo.length > 1 && (await normalizarOrden(delGrupo, clave))) return;
      cuerpo.append(
        el("section", { class: "categorias-grupo" }, [
          el("h3", { text: tipo === "gasto" ? "Gastos" : "Ingresos" }),
          delGrupo.length
            ? el("div", { class: "lista" }, delGrupo.map((c, i) => fila(c, delGrupo, i)))
            : el("p", { class: "vacio", text: "Sin categorías en este grupo." }),
        ])
      );
    }
  }

  function fila(c, grupo, indice) {
    const icono = el("span", { class: "cat-fila-icono" }, [nodoIconoCategoria(c)]);
    if (c.color) icono.style.color = c.color;

    const subir = botonIcono("Subir", flechaArribaCirculo, indice === 0, () =>
      intercambiarOrden(c, grupo[indice - 1])
    );
    const bajar = botonIcono("Bajar", flechaAbajoCirculo, indice === grupo.length - 1, () =>
      intercambiarOrden(c, grupo[indice + 1])
    );
    const editar = botonIcono("Editar", lapiz, false, () =>
      abrirCategoriaForm({ categoria: c, modoInicial: modo, onGuardado: recargar })
    );
    const borrar = botonIcono("Borrar", basura, false, async () => {
      if (!confirm(`¿Borrar "${c.nombre}"? Los movimientos quedarán sin categoría.`)) return;
      try {
        await eliminarCategoria(c.id);
        await recargar();
      } catch (e) {
        error.textContent = "No se pudo borrar la categoría.";
      }
    });

    return el("div", { class: "fila fila--categoria" }, [
      icono,
      el("span", { class: "nombre", text: c.nombre }),
      el("div", { class: "acciones" }, [subir, bajar, editar, borrar]),
    ]);
  }

  function botonIcono(label, fabricaIcono, deshabilitado, onClick) {
    const b = el("button", { class: "boton--icono", "aria-label": label, title: label, onClick }, [
      fabricaIcono(),
    ]);
    if (deshabilitado) b.disabled = true;
    return b;
  }

  async function intercambiarOrden(a, b) {
    if (!a || !b) return;
    try {
      await actualizarCategoria(a.id, { orden: b.orden });
      await actualizarCategoria(b.id, { orden: a.orden });
      await recargar();
    } catch (e) {
      error.textContent = "No se pudo reordenar.";
    }
  }
}
