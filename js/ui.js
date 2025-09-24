import { formatDate, stringifyTags, groupBy, sortIncidencias } from "./utils.js";

const modalBackdrop = document.getElementById("modal-backdrop");
const modalRoot = document.getElementById("modal-root");
const focusableSelectors =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
const modalReturnFocus = new WeakMap();
const modalFocusHandlers = new WeakMap();
const dayNames = ["L", "M", "X", "J", "V", "S", "D"];
const estadoLabels = {
  abierta: "Abierta",
  en_proceso: "En proceso",
  cerrada: "Cerrada",
};

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
          openModal(modal, { trigger: openButton });
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
  const options = arguments.length > 1 ? arguments[1] : {};
  if (!modal.open) {
    modal.showModal();
  }
  document.body.classList.add("modal-open");
  modalBackdrop?.classList.remove("hidden");
  modal.dataset.openedAt = Date.now().toString();
  prepararFocoModal(modal, options.trigger);
}

/**
 * Cierra un modal y limpia estados.
 * @param {HTMLDialogElement} modal
 */
export function closeModal(modal) {
  modal.close();
  document.body.classList.remove("modal-open");
  modalBackdrop?.classList.add("hidden");
  liberarFocoModal(modal);
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
    const tarjeta = crearTarjetaIncidencia(incidencia, "lista");
    const seleccionada = Boolean(seleccionId && incidencia.id === seleccionId);
    tarjeta.setAttribute("aria-selected", seleccionada ? "true" : "false");
    if (seleccionada) {
      tarjeta.classList.add("is-selected");
    }
    fragment.appendChild(tarjeta);
  });
  contenedor.appendChild(fragment);
  if (seleccionId) {
    contenedor.setAttribute("aria-activedescendant", `incidencia-${seleccionId}`);
  } else {
    contenedor.removeAttribute("aria-activedescendant");
  }
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
    let activeDescendant = "";
    lista.forEach((incidencia) => {
      const tarjeta = crearTarjetaIncidencia(incidencia, "kanban");
      tarjeta.setAttribute("draggable", "true");
      tarjeta.dataset.id = incidencia.id;
      const seleccionada = Boolean(seleccionId && incidencia.id === seleccionId);
      tarjeta.setAttribute("aria-selected", seleccionada ? "true" : "false");
      if (seleccionada) {
        tarjeta.classList.add("is-selected");
        activeDescendant = tarjeta.id;
      }
      fragment.appendChild(tarjeta);
    });
    contenedor.appendChild(fragment);
    if (activeDescendant) {
      contenedor.setAttribute("aria-activedescendant", activeDescendant);
    } else {
      contenedor.removeAttribute("aria-activedescendant");
    }
  });
}

/**
 * Renderiza el detalle de una incidencia.
 * @param {any | null} incidencia
 */
export function renderDetalle(incidencia) {
  const extras = arguments.length > 1 ? arguments[1] : {};
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
    btnEliminar: document.getElementById("btn-eliminar-incidencia"),
    btnImprimir: document.getElementById("btn-imprimir-detalle"),
    comunicaciones: document.getElementById("comunicaciones-lista"),
    formComunicacion: document.getElementById("form-comunicacion"),
    errorComunicacion: document.getElementById("comunicacion-error"),
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
    detalle.btnEliminar?.setAttribute("disabled", "true");
    detalle.btnImprimir?.setAttribute("disabled", "true");
    if (detalle.btnEditar?.dataset.id) {
      delete detalle.btnEditar.dataset.id;
    }
    if (detalle.btnArchivos?.dataset.id) {
      delete detalle.btnArchivos.dataset.id;
    }
    if (detalle.btnEliminar?.dataset.id) {
      delete detalle.btnEliminar.dataset.id;
    }
    if (detalle.comunicaciones) {
      detalle.comunicaciones.innerHTML = "";
      const vacio = document.createElement("li");
      vacio.className = "hint";
      vacio.textContent = "No hay comunicaciones registradas.";
      detalle.comunicaciones.appendChild(vacio);
    }
    if (detalle.errorComunicacion) {
      detalle.errorComunicacion.textContent = "";
    }
    toggleFormularioComunicacion(detalle.formComunicacion, false);
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
  detalle.btnEliminar?.removeAttribute("disabled");
  detalle.btnImprimir?.removeAttribute("disabled");
  if (detalle.btnEditar) {
    detalle.btnEditar.dataset.id = incidencia.id;
  }
  if (detalle.btnArchivos) {
    detalle.btnArchivos.dataset.id = incidencia.id;
  }
  if (detalle.btnEliminar) {
    detalle.btnEliminar.dataset.id = incidencia.id;
  }
  if (detalle.comunicaciones) {
    renderComunicaciones(
      detalle.comunicaciones,
      Array.isArray(extras.comunicaciones) ? extras.comunicaciones : []
    );
  }
  if (detalle.errorComunicacion) {
    detalle.errorComunicacion.textContent = "";
  }
  toggleFormularioComunicacion(detalle.formComunicacion, true);
}

/**
 * Crea una tarjeta accesible para una incidencia.
 * @param {any} incidencia
 * @param {"lista" | "kanban"} [modo]
 */
function crearTarjetaIncidencia(incidencia, modo = "lista") {
  if (modo === "kanban") {
    return crearTarjetaKanban(incidencia);
  }
  return crearTarjetaLinea(incidencia);
}

function crearTarjetaLinea(incidencia) {
  const tarjeta = document.createElement("article");
  tarjeta.className = "tarjeta-incidencia tarjeta-incidencia--linea";
  tarjeta.tabIndex = 0;
  tarjeta.dataset.id = incidencia.id;
  tarjeta.setAttribute("role", "option");
  tarjeta.id = `incidencia-${incidencia.id}`;
  const estado = incidencia.estado ?? "abierta";
  tarjeta.dataset.estado = estado;

  const tituloTexto = incidencia.titulo?.trim() || "(Sin título)";
  const titulo = document.createElement("span");
  titulo.className = "linea-titulo";
  titulo.textContent = tituloTexto;

  if (incidencia.esSiniestro) {
    const siniestro = crearBadge("Siniestro", "siniestro");
    siniestro.classList.add("linea-indicador");
    titulo.appendChild(siniestro);
  }
  const archivos = Array.isArray(incidencia.archivos) ? incidencia.archivos.length : 0;
  if (archivos > 0) {
    const texto = archivos === 1 ? "1 archivo" : `${archivos} archivos`;
    const badgeArchivos = crearBadge(texto, "archivos");
    badgeArchivos.classList.add("linea-indicador");
    titulo.appendChild(badgeArchivos);
  }

  const edificio = document.createElement("span");
  edificio.className = "linea-edificio";
  edificio.textContent = incidencia.edificioNombre || "Sin edificio";

  const estadoLabel = estadoLabels[estado] ?? estado;
  const estadoBadge = crearBadge(estadoLabel, "estado");
  estadoBadge.classList.add("linea-estado", "linea-estado-text");

  const prioridadTexto = formatearPrioridad(incidencia.prioridad);
  const prioridadBadge = crearBadge(prioridadTexto, "prioridad");
  prioridadBadge.classList.add("linea-prioridad", "linea-prioridad-text");

  const fecha = document.createElement("span");
  fecha.className = "linea-fecha";
  if (incidencia.fechaLimite) {
    fecha.textContent = formatDate(incidencia.fechaLimite);
    if (esFechaVencida(incidencia.fechaLimite)) {
      fecha.classList.add("is-alerta");
    }
  } else {
    fecha.textContent = "Sin límite";
    fecha.classList.add("linea-fecha--sin-limite");
  }

  const descripcion = document.createElement("span");
  descripcion.className = "linea-descripcion linea-print-only";
  descripcion.textContent = incidencia.descripcion?.trim() || "—";

  const fechaAlta = document.createElement("span");
  fechaAlta.className = "linea-fecha-alta linea-print-only";
  fechaAlta.textContent = incidencia.fechaCreacion ? formatDate(incidencia.fechaCreacion) : "—";

  const asignado = document.createElement("span");
  asignado.className = "linea-asignado linea-print-only";
  asignado.textContent = obtenerAsignadoLinea(incidencia);

  const acciones = crearAccionesTarjeta(incidencia);
  acciones.classList.add("linea-acciones");

  const ariaLabelPartes = [
    tituloTexto,
    `Estado ${estadoLabel}`,
    `Prioridad ${prioridadTexto}`,
    `Edificio ${edificio.textContent}`,
  ];
  if (incidencia.fechaLimite) {
    ariaLabelPartes.push(`Fecha límite ${formatDate(incidencia.fechaLimite)}`);
  } else {
    ariaLabelPartes.push("Sin fecha límite");
  }
  if (incidencia.fechaCreacion) {
    ariaLabelPartes.push(`Fecha de alta ${formatDate(incidencia.fechaCreacion)}`);
  }
  if (incidencia.descripcion) {
    ariaLabelPartes.push(`Descripción ${incidencia.descripcion}`);
  }
  const asignadoTexto = obtenerAsignadoLinea(incidencia);
  if (asignadoTexto && asignadoTexto !== "Sin asignar") {
    ariaLabelPartes.push(`Asignado ${asignadoTexto}`);
  }
  tarjeta.setAttribute("aria-label", ariaLabelPartes.join(". "));

  tarjeta.append(
    titulo,
    edificio,
    estadoBadge,
    prioridadBadge,
    fecha,
    descripcion,
    fechaAlta,
    asignado,
    acciones
  );
  return tarjeta;
}

function crearTarjetaKanban(incidencia) {
  const tarjeta = document.createElement("article");
  tarjeta.className = "tarjeta-incidencia tarjeta-incidencia--kanban";
  tarjeta.tabIndex = 0;
  tarjeta.dataset.id = incidencia.id;
  tarjeta.setAttribute("role", "option");
  tarjeta.id = `incidencia-${incidencia.id}`;
  const estado = incidencia.estado ?? "abierta";
  tarjeta.dataset.estado = estado;

  const titulo = document.createElement("h4");
  titulo.className = "titulo";
  const tituloTexto = incidencia.titulo?.trim() || "(Sin título)";
  titulo.textContent = tituloTexto;

  const descripcion = document.createElement("p");
  descripcion.className = "descripcion";
  descripcion.textContent = incidencia.descripcion?.trim() || "Sin descripción";

  const meta = document.createElement("div");
  meta.className = "meta";
  const estadoLabel = estadoLabels[estado] ?? estado;
  meta.append(
    crearBadge(estadoLabel, "estado"),
    crearBadge(`Prioridad: ${incidencia.prioridad ?? "media"}`, "prioridad")
  );
  if (incidencia.edificioNombre) {
    const edificio = document.createElement("span");
    edificio.textContent = incidencia.edificioNombre;
    meta.appendChild(edificio);
  }
  if (incidencia.fechaLimite) {
    const fecha = document.createElement("span");
    fecha.textContent = `Límite: ${formatDate(incidencia.fechaLimite)}`;
    meta.appendChild(fecha);
  }

  const indicadores = crearIndicadoresTarjeta(incidencia);

  const etiquetas = document.createElement("p");
  etiquetas.className = "meta";
  if (incidencia.etiquetas?.length) {
    etiquetas.textContent = `Etiquetas: ${stringifyTags(incidencia.etiquetas)}`;
  }

  const acciones = crearAccionesTarjeta(incidencia);

  const ariaLabelPartes = [
    tituloTexto,
    `Estado ${estadoLabel}`,
    `Prioridad ${incidencia.prioridad ?? "media"}`,
  ];
  if (incidencia.fechaLimite) {
    ariaLabelPartes.push(`Límite ${formatDate(incidencia.fechaLimite)}`);
  }
  tarjeta.setAttribute("aria-label", ariaLabelPartes.join(". "));

  tarjeta.append(titulo, descripcion, meta);
  if (indicadores.childElementCount > 0) {
    tarjeta.appendChild(indicadores);
  }
  if (etiquetas.textContent) {
    tarjeta.appendChild(etiquetas);
  }
  if (acciones.childElementCount > 0) {
    tarjeta.appendChild(acciones);
  }
  return tarjeta;
}

function formatearPrioridad(prioridad) {
  const base = typeof prioridad === "string" && prioridad.trim() ? prioridad.trim() : "media";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function obtenerAsignadoLinea(incidencia) {
  if (!incidencia) return "Sin asignar";
  if (incidencia.esSiniestro) {
    const partes = [];
    if (incidencia.polizaNombre || incidencia.polizaId) {
      partes.push(`Compañía: ${incidencia.polizaNombre || incidencia.polizaId}`);
    }
    if (incidencia.referenciaSiniestro) {
      partes.push(`Nº siniestro: ${incidencia.referenciaSiniestro}`);
    }
    return partes.join(" · ") || "Siniestro";
  }
  return incidencia.reparadorNombre?.trim() || incidencia.reparadorId?.trim() || "Sin asignar";
}

function esFechaVencida(fechaLimite) {
  const fecha = new Date(fechaLimite);
  if (Number.isNaN(fecha.getTime())) return false;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  fecha.setHours(0, 0, 0, 0);
  return fecha.getTime() < hoy.getTime();
}

function crearBadge(texto, tipo) {
  const badge = document.createElement("span");
  badge.className = "badge";
  if (tipo) {
    badge.dataset.type = tipo;
  }
  badge.textContent = texto;
  return badge;
}

function crearIndicadoresTarjeta(incidencia) {
  const contenedor = document.createElement("div");
  contenedor.className = "tarjeta-indicadores";
  if (incidencia.esSiniestro) {
    contenedor.appendChild(crearBadge("Siniestro", "siniestro"));
  }
  const archivos = Array.isArray(incidencia.archivos) ? incidencia.archivos.length : 0;
  if (archivos > 0) {
    const texto = archivos === 1 ? "1 archivo" : `${archivos} archivos`;
    contenedor.appendChild(crearBadge(texto, "archivos"));
  }
  return contenedor;
}

function crearAccionesTarjeta(incidencia) {
  const contenedor = document.createElement("div");
  contenedor.className = "tarjeta-acciones";
  contenedor.setAttribute("role", "group");
  contenedor.setAttribute("aria-label", "Mover incidencia por teclado");
  const estadoActual = incidencia.estado ?? "abierta";
  const botones = [];
  ["abierta", "en_proceso", "cerrada"].forEach((estado) => {
    if (estado === estadoActual) return;
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "btn ghost";
    boton.dataset.action = "move-incidencia";
    boton.dataset.estado = estado;
    boton.textContent = estadoLabels[estado] ?? estado;
    boton.setAttribute(
      "aria-label",
      `Mover a ${estadoLabels[estado] ?? estado}`
    );
    botones.push(boton);
  });
  if (botones.length) {
    const label = document.createElement("span");
    label.className = "tarjeta-acciones-label";
    label.textContent = "Mover a:";
    contenedor.append(label, ...botones);
  }
  return contenedor;
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
 * @param {Array<{ nombre: string; url: string; path?: string }>} archivos
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
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "btn danger";
    boton.dataset.deletePath = archivo.path ?? "";
    boton.textContent = "Eliminar";
    item.append(enlace, boton);
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

function prepararFocoModal(modal, trigger) {
  const opener = trigger instanceof HTMLElement
    ? trigger
    : document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  if (opener) {
    modalReturnFocus.set(modal, opener);
  }
  if (!modalFocusHandlers.has(modal)) {
    const handler = (event) => mantenerFocoEnModal(event, modal);
    modal.addEventListener("keydown", handler);
    modalFocusHandlers.set(modal, handler);
  }
  const focusables = obtenerElementosFoco(modal);
  const autoFocus = modal.querySelector("[data-autofocus]");
  const objetivo =
    autoFocus instanceof HTMLElement
      ? autoFocus
      : focusables[0] ?? modal;
  window.requestAnimationFrame(() => {
    if (objetivo instanceof HTMLElement) {
      objetivo.focus();
    } else {
      modal.focus();
    }
  });
}

function liberarFocoModal(modal) {
  const handler = modalFocusHandlers.get(modal);
  if (handler) {
    modal.removeEventListener("keydown", handler);
    modalFocusHandlers.delete(modal);
  }
  const opener = modalReturnFocus.get(modal);
  modalReturnFocus.delete(modal);
  if (opener instanceof HTMLElement) {
    opener.focus();
  }
}

function obtenerElementosFoco(modal) {
  return Array.from(modal.querySelectorAll(focusableSelectors)).filter(
    (element) =>
      element instanceof HTMLElement &&
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true" &&
      !element.closest("[hidden]") &&
      (element.offsetParent !== null || element.getClientRects().length > 0)
  );
}

function mantenerFocoEnModal(event, modal) {
  if (event.key !== "Tab") return;
  const focusables = obtenerElementosFoco(modal);
  if (!focusables.length) {
    event.preventDefault();
    modal.focus();
    return;
  }
  const current = /** @type {HTMLElement | null} */ (document.activeElement);
  const index = current ? focusables.indexOf(current) : -1;
  if (event.shiftKey) {
    if (index <= 0) {
      event.preventDefault();
      focusables[focusables.length - 1].focus();
    }
  } else {
    if (index === focusables.length - 1) {
      event.preventDefault();
      focusables[0].focus();
    } else if (index === -1) {
      event.preventDefault();
      focusables[0].focus();
    }
  }
}

function actualizarDeltaMetricas(elemento, info) {
  if (!info || typeof info.diferencia !== "number") {
    elemento.textContent = "";
    elemento.removeAttribute("data-trend");
    return;
  }
  const delta = info.diferencia;
  const etiqueta = info.etiqueta ? ` ${info.etiqueta}` : "";
  if (delta === 0) {
    elemento.textContent = `Sin cambios${etiqueta}`.trim();
    elemento.dataset.trend = "equal";
    return;
  }
  const prefijo = delta > 0 ? "+" : "";
  elemento.textContent = `${prefijo}${delta}${etiqueta}`.trim();
  elemento.dataset.trend = delta > 0 ? "up" : "down";
}

/**
 * Actualiza los indicadores del panel diario.
 * @param {{ abiertas: number; proximas: number; sinAsignar: number; nuevas: number }} metrics
 */
export function actualizarResumenDiario(metrics) {
  const refs = {
    abiertas: document.getElementById("metric-abiertas"),
    proximas: document.getElementById("metric-proximas"),
    sinAsignar: document.getElementById("metric-sin-asignar"),
    nuevas: document.getElementById("metric-nuevas"),
  };
  const deltaRefs = {
    abiertas: document.getElementById("metric-abiertas-delta"),
    proximas: document.getElementById("metric-proximas-delta"),
    sinAsignar: document.getElementById("metric-sin-asignar-delta"),
    nuevas: document.getElementById("metric-nuevas-delta"),
  };
  if (refs.abiertas) refs.abiertas.textContent = String(metrics.abiertas ?? 0);
  if (refs.proximas) refs.proximas.textContent = String(metrics.proximas ?? 0);
  if (refs.sinAsignar) refs.sinAsignar.textContent = String(metrics.sinAsignar ?? 0);
  if (refs.nuevas) refs.nuevas.textContent = String(metrics.nuevas ?? 0);
  const deltas = metrics.deltas ?? {};
  ["abiertas", "proximas", "sinAsignar", "nuevas"].forEach((clave) => {
    const elemento = deltaRefs[clave];
    if (!elemento) return;
    const info = deltas[clave];
    actualizarDeltaMetricas(elemento, info);
  });
}

/**
 * Pinta la lista de filtros rápidos disponibles.
 * @param {HTMLElement | null} contenedor
 * @param {Array<{ id: string; nombre: string }>} filtros
 * @param {string | null} activoId
 */
export function renderFiltrosRapidos(contenedor, filtros, activoId) {
  if (!contenedor) return;
  contenedor.innerHTML = "";
  if (!filtros.length) {
    return;
  }
  const fragment = document.createDocumentFragment();
  filtros.forEach((filtro) => {
    const wrapper = document.createElement("div");
    wrapper.className = "chip";
    if (filtro.id === activoId) {
      wrapper.classList.add("is-active");
    }
    wrapper.dataset.id = filtro.id;
    const aplicar = document.createElement("button");
    aplicar.type = "button";
    aplicar.className = "chip-apply";
    aplicar.dataset.action = "apply";
    aplicar.textContent = filtro.nombre;
    aplicar.setAttribute("aria-label", `Aplicar filtro ${filtro.nombre}`);
    const eliminar = document.createElement("button");
    eliminar.type = "button";
    eliminar.className = "chip-delete";
    eliminar.dataset.action = "delete";
    eliminar.setAttribute("aria-label", `Eliminar filtro ${filtro.nombre}`);
    eliminar.textContent = "×";
    wrapper.append(aplicar, eliminar);
    fragment.appendChild(wrapper);
  });
  contenedor.appendChild(fragment);
}

/**
 * Renderiza el calendario y los próximos vencimientos.
 * @param {HTMLElement | null} contenedor
 * @param {Array<Record<string, any>>} incidencias
 * @param {Date} [fechaBase]
 */
export function renderAgenda(contenedor, incidencias, fechaBase = new Date()) {
  if (!contenedor) return;
  contenedor.innerHTML = "";
  const base = new Date(fechaBase.getFullYear(), fechaBase.getMonth(), 1);
  const diasMes = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const primerDia = new Date(base);
  const inicioSemana = (primerDia.getDay() + 6) % 7; // lunes = 0
  const calendario = document.createElement("div");
  calendario.className = "calendar-grid";
  dayNames.forEach((nombre) => {
    const etiqueta = document.createElement("div");
    etiqueta.className = "calendar-day-name";
    etiqueta.textContent = nombre;
    calendario.appendChild(etiqueta);
  });
  for (let i = 0; i < inicioSemana; i += 1) {
    const vacio = document.createElement("div");
    vacio.className = "calendar-day is-empty";
    calendario.appendChild(vacio);
  }
  const incidenciasPorDia = agruparIncidenciasPorFecha(incidencias);
  for (let dia = 1; dia <= diasMes; dia += 1) {
    const fecha = new Date(base.getFullYear(), base.getMonth(), dia);
    const clave = formatoClave(fecha);
    const eventos = incidenciasPorDia.get(clave) ?? [];
    const celda = document.createElement("div");
    celda.className = "calendar-day";
    if (eventos.length) {
      celda.classList.add("has-events");
      celda.setAttribute("aria-label", `${eventos.length} incidencias con vencimiento el ${fecha.toLocaleDateString()}`);
    }
    const numero = document.createElement("span");
    numero.className = "calendar-date";
    numero.textContent = String(dia);
    celda.appendChild(numero);
    if (eventos.length) {
      const contador = document.createElement("span");
      contador.className = "event-count";
      contador.textContent = String(eventos.length);
      celda.appendChild(contador);
    }
    calendario.appendChild(celda);
  }
  contenedor.appendChild(calendario);

  const proximos = document.createElement("div");
  proximos.className = "agenda-proximos";
  const titulo = document.createElement("h4");
  titulo.textContent = "Próximos 7 días";
  proximos.appendChild(titulo);
  const lista = document.createElement("ul");
  const ahora = new Date();
  const limite = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);
  const proximasIncidencias = incidencias
    .filter((incidencia) => {
      if (!incidencia.fechaLimite || incidencia.estado === "cerrada") return false;
      const fecha = new Date(incidencia.fechaLimite);
      if (Number.isNaN(fecha.getTime())) return false;
      return fecha >= ahora && fecha <= limite;
    })
    .sort((a, b) => new Date(a.fechaLimite).getTime() - new Date(b.fechaLimite).getTime())
    .slice(0, 5);
  if (!proximasIncidencias.length) {
    const item = document.createElement("li");
    item.className = "hint";
    item.textContent = "Sin vencimientos en la próxima semana.";
    lista.appendChild(item);
  } else {
    proximasIncidencias.forEach((incidencia) => {
      const item = document.createElement("li");
      const fecha = formatDate(incidencia.fechaLimite) || "Sin fecha";
      item.textContent = `${fecha} · ${incidencia.titulo ?? "(Sin título)"}`;
      lista.appendChild(item);
    });
  }
  proximos.appendChild(lista);
  contenedor.appendChild(proximos);
}

/**
 * Pinta el historial de comunicaciones.
 * @param {HTMLElement} contenedor
 * @param {Array<{ id: string; tipo?: string; mensaje: string; autor?: string; fecha?: string | Date }>} comunicaciones
 */
export function renderComunicaciones(contenedor, comunicaciones) {
  contenedor.innerHTML = "";
  if (!comunicaciones.length) {
    const vacio = document.createElement("li");
    vacio.className = "hint";
    vacio.textContent = "Sin registros de comunicación.";
    contenedor.appendChild(vacio);
    return;
  }
  const fragment = document.createDocumentFragment();
  comunicaciones.forEach((item) => {
    const li = document.createElement("li");
    li.className = "comunicacion-item";
    const tipo = document.createElement("span");
    tipo.className = "comunicacion-tipo";
    tipo.textContent = (item.tipo ?? "nota").toUpperCase();
    const mensaje = document.createElement("p");
    mensaje.className = "comunicacion-mensaje";
    mensaje.textContent = item.mensaje ?? "";
    const meta = document.createElement("span");
    meta.className = "comunicacion-meta";
    const autor = item.autor ?? "Equipo";
    const fecha = item.fecha ? formatDate(item.fecha) : "";
    meta.textContent = fecha ? `${autor} · ${fecha}` : autor;
    li.append(tipo, mensaje, meta);
    fragment.appendChild(li);
  });
  contenedor.appendChild(fragment);
}

function toggleFormularioComunicacion(form, habilitar) {
  if (!(form instanceof HTMLFormElement)) return;
  const controles = form.querySelectorAll("input, select, textarea, button");
  controles.forEach((control) => {
    control.disabled = !habilitar;
  });
}

function agruparIncidenciasPorFecha(incidencias) {
  const mapa = new Map();
  incidencias.forEach((incidencia) => {
    if (!incidencia.fechaLimite || incidencia.estado === "cerrada") return;
    const fecha = new Date(incidencia.fechaLimite);
    if (Number.isNaN(fecha.getTime())) return;
    const clave = formatoClave(fecha);
    if (!mapa.has(clave)) {
      mapa.set(clave, []);
    }
    mapa.get(clave).push(incidencia);
  });
  return mapa;
}

function formatoClave(fecha) {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
