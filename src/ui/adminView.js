import { el, limpiar } from "./dom.js";
import { sesionActual } from "../auth.js";
import {
  listarUsuarios,
  estadisticas,
  setEstado,
  setRol,
  resetPassword,
  fijarPassword,
  eliminarUsuario,
} from "../data/admin.js";
import { etiquetaEstado } from "../logic/cuentas.js";
import { escudoIcono } from "./iconos.js";
import { tituloVista } from "./tituloVista.js";

const FILTROS = [
  ["todos", "Todos"],
  ["pendiente", "Pendientes"],
  ["activo", "Activos"],
  ["inactivos", "Inactivos"],
];

function fmtFecha(iso) {
  if (!iso) return "—";
  return String(iso).slice(0, 10);
}

function tarjetaStat(titulo, valor) {
  return el("div", { class: "tarjeta" }, [
    el("span", { class: "titulo", text: titulo }),
    el("span", { class: "valor", text: String(valor ?? "—") }),
  ]);
}

export async function montarAdmin(contenedor) {
  limpiar(contenedor);

  const error = el("p", { class: "error", role: "alert" });
  const aviso = el("p", { class: "aviso" });
  const cajaStats = el("div", { class: "tarjetas-fila" });
  const lista = el("div", { class: "admin-lista" });
  let filtro = "todos";
  let miId = null;
  let usuarios = [];

  const botonesFiltro = FILTROS.map(([valor, texto]) =>
    el("button", {
      type: "button",
      text: texto,
      onClick: () => {
        filtro = valor;
        sincronizarFiltro();
        pintarLista();
      },
    })
  );
  function sincronizarFiltro() {
    botonesFiltro.forEach((b, i) => b.classList.toggle("activo", FILTROS[i][0] === filtro));
  }
  sincronizarFiltro();

  contenedor.append(
    tituloVista(escudoIcono, "Administración", "Gestiona usuarios y opciones administrativas."),
    error,
    aviso,
    cajaStats,
    el("section", { class: "panel-tarjeta" }, [
      el("div", { class: "selector-tipo tabs-vista" }, botonesFiltro),
      lista,
    ])
  );

  const s = await sesionActual();
  miId = s?.user?.id || null;

  await recargar();

  async function recargar() {
    error.textContent = "";
    aviso.textContent = "";
    try {
      const [stats, lst] = await Promise.all([estadisticas(), listarUsuarios()]);
      pintarStats(stats);
      usuarios = lst || [];
      pintarLista();
    } catch (e) {
      error.textContent = "No se pudo cargar la administración. ";
      error.append(el("button", { text: "Reintentar", onClick: recargar }));
    }
  }

  function pintarStats(stats) {
    limpiar(cajaStats);
    cajaStats.append(
      tarjetaStat("Usuarios", stats?.usuarios_total),
      tarjetaStat("Pendientes", stats?.usuarios_pendientes),
      tarjetaStat("Activos", stats?.usuarios_activos),
      tarjetaStat("Movimientos", stats?.movimientos_total)
    );
  }

  function coincideFiltro(u) {
    if (filtro === "todos") return true;
    if (filtro === "inactivos") return u.estado === "deshabilitado" || u.estado === "rechazado";
    return u.estado === filtro;
  }

  function pintarLista() {
    limpiar(lista);
    const visibles = usuarios.filter(coincideFiltro);
    if (visibles.length === 0) {
      lista.append(el("p", { class: "vacio", text: "Sin usuarios en este filtro." }));
      return;
    }
    for (const u of visibles) lista.append(fila(u));
  }

  // Ejecuta `fn`, recarga la lista/estadísticas y muestra `exito` (si se
  // pasa) — en ese orden, porque recargar() limpia los mensajes.
  async function accion(fn, exito = "") {
    error.textContent = "";
    aviso.textContent = "";
    try {
      await fn();
      await recargar();
      if (exito) aviso.textContent = exito;
    } catch (e) {
      error.textContent = e?.message || "No se pudo completar la acción.";
    }
  }

  function botonAccion(texto, onClick, extra = "") {
    return el("button", { type: "button", class: `admin-btn ${extra}`.trim(), text: texto, onClick });
  }

  function fila(u) {
    const esYo = u.id === miId;
    const inactivo = u.estado === "deshabilitado" || u.estado === "rechazado";

    const badges = el("span", { class: "admin-badges" }, [
      el("span", { class: `admin-badge admin-badge--${u.estado}`, text: etiquetaEstado(u.estado) }),
      u.rol === "admin" ? el("span", { class: "admin-badge admin-badge--admin", text: "Admin" }) : null,
      esYo ? el("span", { class: "admin-badge", text: "Tú" }) : null,
    ]);

    const acciones = el("div", { class: "admin-acciones" });
    if (!esYo) {
      if (u.estado === "pendiente") {
        acciones.append(
          botonAccion("Aprobar", () => accion(() => setEstado(u.id, "activo")), "admin-btn--ok"),
          botonAccion("Rechazar", () => accion(() => setEstado(u.id, "rechazado")))
        );
      }
      if (u.estado === "activo") {
        acciones.append(botonAccion("Deshabilitar", () => accion(() => setEstado(u.id, "deshabilitado"))));
      }
      if (inactivo) {
        acciones.append(botonAccion("Reactivar", () => accion(() => setEstado(u.id, "activo")), "admin-btn--ok"));
      }
      acciones.append(
        botonAccion(u.rol === "admin" ? "Quitar admin" : "Hacer admin", () =>
          accion(() => setRol(u.id, u.rol === "admin" ? "usuario" : "admin"))
        ),
        botonAccion("Enviar reset", () =>
          accion(() => resetPassword(u.email), `Email de recuperación enviado a ${u.email}.`)
        ),
        botonAccion("Fijar clave", () => {
          const p = prompt(`Nueva contraseña para ${u.email} (mínimo 8 caracteres):`);
          if (p == null) return;
          if (p.length < 8) {
            error.textContent = "La contraseña debe tener al menos 8 caracteres.";
            return;
          }
          accion(() => fijarPassword(u.id, p), `Contraseña actualizada para ${u.email}.`);
        }),
        botonAccion("Eliminar", () => {
          if (!confirm(`¿Eliminar la cuenta ${u.email}? Se borran también todos sus datos. Esta acción no se puede deshacer.`)) {
            return;
          }
          accion(() => eliminarUsuario(u.id));
        }, "admin-btn--peligro")
      );
    }

    return el("div", { class: "admin-fila" }, [
      el("div", { class: "admin-fila-info" }, [
        el("span", { class: "admin-fila-email", text: u.email || "(sin email)" }),
        badges,
        el("span", {
          class: "admin-fila-meta",
          text: `Registro ${fmtFecha(u.creado_en)} · Último acceso ${fmtFecha(u.ultimo_acceso)} · ${u.n_movimientos} movs`,
        }),
      ]),
      acciones,
    ]);
  }
}
