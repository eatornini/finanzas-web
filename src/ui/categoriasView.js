import { el, limpiar } from "./dom.js";
import {
  listarCategorias,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
} from "../data/categorias.js";

export function montarCategorias(contenedor) {
  limpiar(contenedor);

  const error = el("p", { class: "error", role: "alert" });
  const lista = el("div", { class: "lista" });

  async function recargar() {
    error.textContent = "";
    limpiar(lista);
    try {
      const categorias = await listarCategorias();
      if (categorias.length === 0) {
        lista.append(el("p", { class: "vacio", text: "Aún no tienes categorías." }));
        return;
      }
      for (const c of categorias) lista.append(fila(c, recargar, error));
    } catch (e) {
      error.textContent = "No se pudieron cargar las categorías.";
    }
  }

  contenedor.append(formularioNueva(recargar, error), lista, error);
  recargar();
}

function formularioNueva(recargar, error) {
  const nombre = el("input", { placeholder: "Nombre", required: "true" });
  const tipo = el("select", {}, [
    el("option", { value: "gasto", text: "Gasto" }),
    el("option", { value: "ingreso", text: "Ingreso" }),
  ]);
  const color = el("input", { type: "color", value: "#888888" });
  const boton = el("button", { type: "submit", text: "Agregar" });

  return el(
    "form",
    {
      class: "form-inline",
      onSubmit: async (ev) => {
        ev.preventDefault();
        if (!nombre.value.trim()) {
          error.textContent = "El nombre es obligatorio.";
          return;
        }
        error.textContent = "";
        boton.disabled = true;
        try {
          await crearCategoria({
            nombre: nombre.value.trim(),
            tipo: tipo.value,
            color: color.value,
          });
          nombre.value = "";
          await recargar();
        } catch (e) {
          error.textContent = "No se pudo crear la categoría.";
        } finally {
          boton.disabled = false;
        }
      },
    },
    [nombre, tipo, color, boton]
  );
}

function fila(c, recargar, error) {
  const punto = el("span", { class: "punto" });
  if (c.color) punto.style.background = c.color;

  const renombrar = el("button", {
    text: "Renombrar",
    onClick: async () => {
      const nuevo = prompt("Nuevo nombre", c.nombre);
      if (nuevo === null || !nuevo.trim()) return;
      try {
        await actualizarCategoria(c.id, { nombre: nuevo.trim() });
        await recargar();
      } catch (e) {
        error.textContent = "No se pudo actualizar la categoría.";
      }
    },
  });

  const borrar = el("button", {
    text: "Borrar",
    onClick: async () => {
      if (!confirm(`¿Borrar "${c.nombre}"? Los movimientos quedarán sin categoría.`)) return;
      try {
        await eliminarCategoria(c.id);
        await recargar();
      } catch (e) {
        error.textContent = "No se pudo borrar la categoría.";
      }
    },
  });

  return el("div", { class: `fila tipo-${c.tipo}` }, [
    punto,
    el("span", { class: "nombre", text: c.nombre }),
    el("span", { class: "tipo", text: c.tipo }),
    renombrar,
    borrar,
  ]);
}
