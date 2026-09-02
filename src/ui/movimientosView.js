import { el, limpiar } from "./dom.js";
import {
  listarMovimientos,
  crearMovimiento,
  actualizarMovimiento,
  eliminarMovimiento,
} from "../data/movimientos.js";
import { listarCategorias } from "../data/categorias.js";
import { lapiz, basura } from "./iconos.js";

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function fmt(n) {
  return Number(n).toLocaleString("es", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export async function montarMovimientos(contenedor, { rango, modo }) {
  limpiar(contenedor);

  const error = el("p", { class: "error", role: "alert" });
  const lista = el("div", { class: "lista" });
  contenedor.append(error, lista);

  let categorias = [];
  try {
    categorias = await listarCategorias();
  } catch (e) {
    // Se seguirá intentando en recargar(); el alta permite "Sin categoría".
  }

  contenedor.prepend(formularioNuevo(categorias, recargar, error, rango, modo));
  await recargar();

  async function recargar() {
    error.textContent = "";
    limpiar(lista);
    try {
      const movimientos = await listarMovimientos({ ...rango, modo });
      if (movimientos.length === 0) {
        lista.append(
          el("p", { class: "vacio", text: "No hay movimientos en este período." })
        );
        return;
      }
      for (const m of movimientos) lista.append(fila(m, recargar, error, modo));
    } catch (e) {
      error.textContent = "No se pudo conectar. ";
      error.append(el("button", { text: "Reintentar", onClick: recargar }));
    }
  }
}

function opcionesCategoria(categorias, tipo) {
  return categorias
    .filter((c) => c.tipo === tipo)
    .map((c) => el("option", { value: c.id, text: c.nombre }));
}

function formularioNuevo(categorias, recargar, error, rango, modo) {
  const nombre = el("input", { placeholder: "Nombre", required: "true" });
  const monto = el("input", {
    type: "number",
    step: "0.01",
    min: "0",
    placeholder: "Monto",
    required: "true",
  });
  const tipo = el("select", {}, [
    el("option", { value: "gasto", text: "Gasto" }),
    el("option", { value: "ingreso", text: "Ingreso" }),
  ]);
  const categoria = el("select", {}, [
    el("option", { value: "", text: "Sin categoría" }),
    ...opcionesCategoria(categorias, "gasto"),
  ]);
  tipo.addEventListener("change", () => {
    limpiar(categoria);
    categoria.append(
      el("option", { value: "", text: "Sin categoría" }),
      ...opcionesCategoria(categorias, tipo.value)
    );
  });
  const fecha = el("input", { type: "date", value: hoyISO() });
  const detalle = el("input", { placeholder: "Detalle (opcional)" });
  const boton = el("button", { type: "submit", text: "Agregar" });

  return el(
    "form",
    {
      class: "form-mov form-grid",
      onSubmit: async (ev) => {
        ev.preventDefault();
        error.textContent = "";
        const montoNum = Number(monto.value);
        if (!nombre.value.trim() || !Number.isFinite(montoNum) || montoNum < 0) {
          error.textContent = "Completa el nombre y un monto válido (0 o mayor).";
          return;
        }
        boton.disabled = true;
        boton.textContent = "Guardando…";
        try {
          await crearMovimiento({
            nombre: nombre.value.trim(),
            monto: montoNum,
            tipo: tipo.value,
            modo,
            pagado: false,
            categoria_id: categoria.value || null,
            fecha: fecha.value || hoyISO(),
            detalle: detalle.value.trim() || null,
          });
          nombre.value = "";
          monto.value = "";
          detalle.value = "";
          await recargar();
        } catch (e) {
          error.textContent = "No se pudo guardar. Intenta de nuevo.";
        } finally {
          boton.disabled = false;
          boton.textContent = "Agregar";
        }
      },
    },
    [nombre, monto, tipo, categoria, fecha, detalle, boton]
  );
}

function fila(m, recargar, error, modo) {
  const signo = m.tipo === "ingreso" ? "+" : "−";
  const cat = m.categoria ? m.categoria.nombre : "Sin categoría";

  const editarMonto = el(
    "button",
    {
      class: "boton--icono",
      "aria-label": "Editar monto",
      title: "Editar monto",
      onClick: async () => {
        const nuevo = prompt("Nuevo monto", m.monto);
        const num = Number(nuevo);
        if (nuevo === null || !Number.isFinite(num) || num < 0) return;
        try {
          await actualizarMovimiento(m.id, { monto: num });
          await recargar();
        } catch (e) {
          error.textContent = "No se pudo actualizar el movimiento.";
        }
      },
    },
    [lapiz()]
  );

  const borrar = el(
    "button",
    {
      class: "boton--icono",
      "aria-label": `Borrar ${m.nombre}`,
      title: "Borrar",
      onClick: async () => {
        if (!confirm(`¿Borrar "${m.nombre}"?`)) return;
        try {
          await eliminarMovimiento(m.id);
          await recargar();
        } catch (e) {
          error.textContent = "No se pudo borrar el movimiento.";
        }
      },
    },
    [basura()]
  );

  const controles = [editarMonto, borrar];
  if (modo === "estimado") {
    const togglePagado = el(
      "button",
      {
        class: m.pagado ? "pagado" : "pendiente",
        text: m.pagado ? "Pagado" : "Pendiente",
        onClick: async () => {
          try {
            await actualizarMovimiento(m.id, { pagado: !m.pagado });
            await recargar();
          } catch (e) {
            error.textContent = "No se pudo actualizar el estado.";
          }
        },
      },
      []
    );
    controles.unshift(togglePagado);
  }

  const claseFila =
    modo === "estimado" && m.pagado ? `fila tipo-${m.tipo} fila-pagada` : `fila tipo-${m.tipo}`;

  return el("div", { class: claseFila }, [
    el("span", { class: "nombre", text: m.nombre }),
    el("span", { class: "cat", text: cat }),
    el("span", { class: "fecha", text: m.fecha }),
    el("span", { class: "monto", text: `${signo} ${fmt(m.monto)}` }),
    el("div", { class: "acciones" }, controles),
  ]);
}
