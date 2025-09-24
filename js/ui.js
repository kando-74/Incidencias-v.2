import { formatDate, stringifyTags, groupBy, sortIncidencias } from "./utils.js";

const modalBackdrop = document.getElementById("modal-backdrop");
const modalRoot = document.getElementById("modal-root");

/**
 * Gestiona los modales declarados con data-modal-target.
 */
export function setupModales() {
  document.addEventListener("click", (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    const openButton = target.closest("[data-modal-target]");
    if (openButton) {
      const modalId = openButton.getAttribute("data-modal-target");
      const mode = openButton.getAttribute("data-modal-mode");
      if (modalId) {
        const modal = document.getElementById(modalId);
        if (modal instanceof HTMLDialogElement) {
          if (mode) {
            modal.dataset.mode = mode;
          }
          openModal(modal);
        }
      }
    }

    const closeButton = target.closest("[data-modal-close]");
    if (closeButton) {
      const modal = closeButton.closest("dialog");
      if (modal instanceof HTMLDialogElement) {
        closeModal(modal);
      }
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const abierta = document.querySelector("dialog[open]");
      if (abierta instanceof HTMLDialogElement) {
        closeModal(abierta);
      }
    }
  });

  modalBackdrop?.addEventListener("click", () => {
    const abierta = document.querySelector("dialog[open]");
    if (abierta instanceof HTMLDialogElement) {
      closeModal(abierta);
    }
  });
}

/**
 * Abre un modal y gestiona el foco.
 * @param {HTMLDialogElement} modal
 */
export function openModal(modal) {
  if (!modal.open) {
    modal.showModal();
  }
  document.body.classList.add("modal-open");
  modalBackdrop?.classList.remove("hidden");
  modal.dataset.openedAt = Date.now().toString();
  modal.focus();
}

/**
 * Cierra un modal y limpia estados.
 * @param {HTMLDialogElement} modal
 */
export function closeModal(modal) {
  modal.close();
  document.body.classList.remove("modal-open");
  modalBackdrop?.classList.add("hidden");
}

/**
 * Renderiza tarjetas en la vista de lista.
 * @param {HTMLElement} contenedor
 * @param {any[]} incidencias
 * @param {string} [seleccionId]
 */
export function renderListaIncidencias(contenedor, incidencias, seleccionId) {
  contenedor.innerHTML = "";
  const fragment = document.createDocumentFragment();
  sortIncidencias(incidencias).forEach((incidencia) => {
    const tarjeta = crearTarjetaIncidencia(incidencia);
    if (seleccionId && incidencia.id === seleccionId) {
      tarjeta.classList.add("is-selected");
    }
    fragment.appendChild(tarjeta);
  });
  contenedor.appendChild(fragment);
}

/**
 * Renderiza columnas Kanban.
 * @param {Record<string, HTMLElement>} columnas
 * @param {any[]} incidencias
 * @param {string} [seleccionId]
 */
export function renderKanban(columnas, incidencias, seleccionId) {
  Object.values(columnas).forEach((columna) => {
    columna.innerHTML = "";
  });
  const grupos = groupBy(incidencias, (item) => item.estado ?? "abierta");
  Object.entries(columnas).forEach(([estado, contenedor]) => {
    const lista = sortIncidencias(grupos[estado] ?? []);
    const fragment = document.createDocumentFragment();
    lista.forEach((incidencia) => {
      const tarjeta = crearTarjetaIncidencia(incidencia);
      tarjeta.setAttribute("draggable", "true");
      tarjeta.dataset.id = incidencia.id;
      if (seleccionId && incidencia.id === seleccionId) {
        tarjeta.classList.add("is-selected");
      }
      fragment.appendChild(tarjeta);
    });
    contenedor.appendChild(fragment);
  });
}

/**
 * Renderiza el detalle de una incidencia.
 * @param {any | null} incidencia
 */
export function renderDetalle(incidencia) {
  const detalle = {
    titulo: document.getElementById("detalle-titulo"),
    descripcion: document.getElementById("detalle-descripcion"),
    estado: document.getElementById("detalle-estado"),
    prioridad: document.getElementById("detalle-prioridad"),
    edificio: document.getElementById("detalle-edificio"),
    reparador: document.getElementById("detalle-reparador"),
    fechas: document.getElementById("detalle-fechas"),
    siniestro: document.getElementById("detalle-siniestro"),
    poliza: document.getElementById("detalle-poliza"),
    archivos: document.getElementById("detalle-archivos"),
    btnEditar: document.getElementById("btn-editar-incidencia"),
    btnArchivos: document.getElementById("btn-abrir-archivos"),
  };
  if (!incidencia) {
    detalle.titulo.textContent = "Selecciona una incidencia";
    detalle.descripcion.textContent = "—";
    detalle.estado.textContent = "—";
    detalle.prioridad.textContent = "—";
    detalle.edificio.textContent = "—";
    detalle.reparador.textContent = "—";
    detalle.fechas.textContent = "—";
    detalle.siniestro.textContent = "—";
    detalle.poliza.textContent = "—";
    detalle.archivos.textContent = "—";
    detalle.btnEditar?.setAttribute("disabled", "true");
    detalle.btnArchivos?.setAttribute("disabled", "true");
    if (detalle.btnEditar?.dataset.id) {
      delete detalle.btnEditar.dataset.id;
    }
    if (detalle.btnArchivos?.dataset.id) {
      delete detalle.btnArchivos.dataset.id;
    }
    return;
  }
  detalle.titulo.textContent = incidencia.titulo ?? "(Sin título)";
  detalle.descripcion.textContent = incidencia.descripcion ?? "—";
  detalle.estado.textContent = incidencia.estado ?? "—";
  detalle.prioridad.textContent = incidencia.prioridad ?? "—";
  detalle.edificio.textContent = incidencia.edificioNombre ?? incidencia.edificioId ?? "—";
  detalle.reparador.textContent = incidencia.reparadorNombre ?? incidencia.reparadorId ?? "—";
  const fechas = [];
  if (incidencia.fechaCreacion) fechas.push(`Creación: ${formatDate(incidencia.fechaCreacion)}`);
  if (incidencia.fechaLimite) fechas.push(`Límite: ${formatDate(incidencia.fechaLimite)}`);
  if (incidencia.fechaCierre) fechas.push(`Cierre: ${formatDate(incidencia.fechaCierre)}`);
  detalle.fechas.textContent = fechas.join(" · ") || "—";
  detalle.siniestro.textContent = incidencia.esSiniestro ? "Sí" : "No";
  detalle.poliza.textContent = incidencia.polizaNombre ?? incidencia.polizaId ?? "—";
  detalle.archivos.textContent = (incidencia.archivos?.length ?? 0) > 0 ? `${incidencia.archivos.length} archivo(s)` : "—";
  detalle.btnEditar?.removeAttribute("disabled");
  detalle.btnArchivos?.removeAttribute("disabled");
  if (detalle.btnEditar) {
    detalle.btnEditar.dataset.id = incidencia.id;
  }
  if (detalle.btnArchivos) {
    detalle.btnArchivos.dataset.id = incidencia.id;
  }
}

/**
 * Crea una tarjeta accesible para una incidencia.
 * @param {any} incidencia
 */
function crearTarjetaIncidencia(incidencia) {
  const tarjeta = document.createElement("article");
  tarjeta.className = "tarjeta-incidencia";
  tarjeta.tabIndex = 0;
  tarjeta.dataset.id = incidencia.id;
  tarjeta.setAttribute("role", "listitem");

  const titulo = document.createElement("h4");
  titulo.className = "titulo";
  titulo.textContent = incidencia.titulo ?? "(Sin título)";

  const descripcion = document.createElement("p");
  descripcion.className = "descripcion";
  descripcion.textContent = incidencia.descripcion ?? "Sin descripción";

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.innerHTML = `
    <span class="badge">${incidencia.estado ?? "abierta"}</span>
    <span class="badge">Prioridad: ${incidencia.prioridad ?? "media"}</span>
    ${incidencia.edificioNombre ? `<span>${incidencia.edificioNombre}</span>` : ""}
    ${incidencia.fechaLimite ? `<span>Límite: ${formatDate(incidencia.fechaLimite)}</span>` : ""}
  `;

  const etiquetas = document.createElement("p");
  etiquetas.className = "meta";
  if (incidencia.etiquetas?.length) {
    etiquetas.textContent = `Etiquetas: ${stringifyTags(incidencia.etiquetas)}`;
  } else {
    etiquetas.textContent = "";
  }

  tarjeta.append(titulo, descripcion, meta, etiquetas);
  return tarjeta;
}

/**
 * Rellena selectores con opciones.
 * @param {HTMLSelectElement} select
 * @param {Array<{ id: string; nombre?: string; label?: string }>} opciones
 * @param {string} [placeholder]
 */
export function poblarSelect(select, opciones, placeholder = "Seleccione") {
  select.innerHTML = "";
  if (placeholder) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = placeholder;
    select.appendChild(option);
  }
  opciones.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.nombre ?? item.label ?? item.id;
    select.appendChild(option);
  });
}

/**
 * Muestra el listado de archivos en el modal correspondiente.
 * @param {Array<{ nombre: string; url: string }>} archivos
 */
export function renderArchivos(archivos) {
  const contenedor = document.getElementById("lista-archivos");
  if (!contenedor) return;
  contenedor.innerHTML = "";
  if (!archivos.length) {
    contenedor.innerHTML = "<p>No hay archivos disponibles.</p>";
    return;
  }
  const lista = document.createElement("ul");
  lista.className = "lista-archivos";
  archivos.forEach((archivo) => {
    const item = document.createElement("li");
    const enlace = document.createElement("a");
    enlace.href = archivo.url;
    enlace.target = "_blank";
    enlace.rel = "noopener";
    enlace.textContent = archivo.nombre;
    item.appendChild(enlace);
    lista.appendChild(item);
  });
  contenedor.appendChild(lista);
}

/**
 * Alterna la visibilidad entre lista y kanban.
 * @param {HTMLElement} lista
 * @param {HTMLElement} kanban
 * @param {"lista" | "kanban"} vista
 */
export function toggleVista(lista, kanban, vista) {
  if (vista === "kanban") {
    lista.classList.add("hidden");
    lista.setAttribute("hidden", "true");
    kanban.classList.remove("hidden");
    kanban.removeAttribute("hidden");
  } else {
    kanban.classList.add("hidden");
    kanban.setAttribute("hidden", "true");
    lista.classList.remove("hidden");
    lista.removeAttribute("hidden");
  }
}

/**
 * Actualiza los indicadores del resumen.
 * @param {{ total: number; abiertas: number; enProceso: number; cerradas: number }} resumen
 */
export function actualizarResumen(resumen) {
  const refs = {
    total: document.getElementById("resumen-total"),
    abiertas: document.getElementById("resumen-abiertas"),
    proceso: document.getElementById("resumen-proceso"),
    cerradas: document.getElementById("resumen-cerradas"),
  };
  refs.total.textContent = resumen.total.toString();
  refs.abiertas.textContent = resumen.abiertas.toString();
  refs.proceso.textContent = resumen.enProceso.toString();
  refs.cerradas.textContent = resumen.cerradas.toString();
}

/**
 * Muestra un mensaje efímero en la pantalla.
 * @param {string} mensaje
 * @param {"success" | "error"} [tipo]
 */
export function showToast(mensaje, tipo = "success") {
  let toast = modalRoot?.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    modalRoot?.appendChild(toast);
  }
  toast.textContent = mensaje;
  toast.dataset.tipo = tipo;
  toast.classList.add("visible");
  setTimeout(() => {
    toast?.classList.remove("visible");
  }, 3000);
}
