import { initAuth, login, logout } from "./auth.js";
import {
  suscribirIncidencias,
  guardarIncidencia,
  obtenerCatalogo,
  subirArchivosIncidencia,
  obtenerArchivosIncidencia,
  actualizarEstadoIncidencia,
  actualizarArchivosIncidencia,
  eliminarArchivoStorage,
  eliminarIncidencia,
} from "./services.js";
import {
  setupModales,
  closeModal,
  renderListaIncidencias,
  renderKanban,
  renderDetalle,
  poblarSelect,
  renderArchivos,
  toggleVista,
  actualizarResumen,
  showToast,
  openModal,
} from "./ui.js";
import {
  parseTags,
  createCsvWithBom,
  downloadTextFile,
  filtrarIncidencia,
  calcularResumen,
  formatDate,
} from "./utils.js";

const state = {
  user: null,
  incidencias: [],
  filtros: {},
  seleccion: null,
  vista: "lista",
  catalogos: {
    edificios: [],
    reparadores: [],
    polizas: [],
  },
};

let unsubscribeIncidencias = null;

const refs = {};

/**
 * Inicializa la aplicación al cargar el documento.
 */
document.addEventListener("DOMContentLoaded", () => {
  cacheDom();
  setupModales();
  setupEventListeners();
  renderDetalle(null);
  initAuth(handleAuthState);
});

function cacheDom() {
  refs.loginView = document.getElementById("login-view");
  refs.appView = document.getElementById("app-view");
  refs.loginForm = document.getElementById("login-form");
  refs.loginError = document.getElementById("login-error");
  refs.logoutButton = document.getElementById("btn-logout");
  refs.listaIncidencias = document.getElementById("lista-incidencias");
  refs.kanbanBoard = document.getElementById("kanban-board");
  refs.listaWrapper = document.querySelector(".listado");
  refs.busquedaInput = document.getElementById("filtro-busqueda");
  refs.formIncidencia = document.getElementById("form-incidencia");
  refs.formFiltros = document.getElementById("form-filtros");
  refs.modalIncidencia = document.getElementById("modal-incidencia");
  refs.modalFiltros = document.getElementById("modal-filtros");
  refs.modalArchivos = document.getElementById("modal-archivos");
  refs.errorIncidencia = document.getElementById("incidencia-error");
  refs.btnToggleVista = document.getElementById("btn-toggle-vista");
  refs.btnExportar = document.getElementById("btn-exportar");
  refs.btnImprimir = document.getElementById("btn-imprimir");
  refs.btnAbrirArchivos = document.getElementById("btn-abrir-archivos");
  refs.btnEditarIncidencia = document.getElementById("btn-editar-incidencia");
  refs.btnLimpiarFiltros = document.getElementById("btn-limpiar-filtros");
  refs.columnasKanban = {
    abierta: document.getElementById("kanban-abierta"),
    en_proceso: document.getElementById("kanban-en-proceso"),
    cerrada: document.getElementById("kanban-cerrada"),
  };
}

function setupEventListeners() {
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const trigger = target.closest('[data-modal-target="modal-incidencia"]');
    if (!trigger) return;
    const mode = trigger.getAttribute("data-modal-mode") ?? "create";
    actualizarTituloModalIncidencia(mode);
    if (mode === "create") {
      refs.formIncidencia?.reset();
      refs.errorIncidencia.textContent = "";
      const idField = refs.formIncidencia?.querySelector("#incidencia-id");
      if (idField instanceof HTMLInputElement) {
        idField.value = "";
      }
    }
  });

  refs.loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(refs.loginForm);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    if (!email || !password) {
      refs.loginError.textContent = "Introduce correo y contraseña";
      return;
    }
    refs.loginError.textContent = "";
    try {
      await login(email, password);
      refs.loginForm.reset();
    } catch (error) {
      refs.loginError.textContent = traducirError(error);
    }
  });

  refs.logoutButton?.addEventListener("click", async () => {
    try {
      await logout();
      showToast("Sesión cerrada", "success");
    } catch (error) {
      console.error(error);
    }
  });

  refs.listaIncidencias?.addEventListener("click", handleSelectIncidencia);
  refs.listaIncidencias?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tarjeta = target.closest(".tarjeta-incidencia");
        if (tarjeta) {
          event.preventDefault();
          seleccionarIncidencia(tarjeta.dataset.id);
        }
      }
    }
  });

  refs.kanbanBoard?.addEventListener("click", handleSelectIncidencia);
  refs.kanbanBoard?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tarjeta = target.closest(".tarjeta-incidencia");
        if (tarjeta) {
          event.preventDefault();
          seleccionarIncidencia(tarjeta.dataset.id);
        }
      }
    }
  });

  refs.busquedaInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      state.filtros.busqueda = refs.busquedaInput.value.trim();
      refrescarUI();
    }
  });

  refs.btnToggleVista?.addEventListener("click", () => {
    state.vista = state.vista === "lista" ? "kanban" : "lista";
    const label = state.vista === "kanban" ? "Ver lista" : "Ver Kanban";
    refs.btnToggleVista.textContent = label;
    toggleVista(refs.listaWrapper, refs.kanbanBoard, state.vista);
  });

  refs.btnExportar?.addEventListener("click", () => {
    const filtradas = obtenerIncidenciasFiltradas();
    const headers = [
      "id",
      "titulo",
      "descripcion",
      "estado",
      "prioridad",
      "edificioId",
      "reparadorId",
      "fechaCreacion",
      "fechaLimite",
      "esSiniestro",
      "referenciaSiniestro",
    ];
    const rows = filtradas.map((item) => ({
      id: item.id,
      titulo: item.titulo ?? "",
      descripcion: item.descripcion ?? "",
      estado: item.estado ?? "",
      prioridad: item.prioridad ?? "",
      edificioId: item.edificioId ?? "",
      reparadorId: item.reparadorId ?? "",
      fechaCreacion: item.fechaCreacion ? formatDate(item.fechaCreacion) : "",
      fechaLimite: item.fechaLimite ? formatDate(item.fechaLimite) : "",
      esSiniestro: item.esSiniestro ? "Sí" : "No",
      referenciaSiniestro: item.referenciaSiniestro ?? "",
    }));
    const csv = createCsvWithBom(headers, rows);
    downloadTextFile(`incidencias-${new Date().toISOString()}.csv`, csv);
  });

  refs.btnImprimir?.addEventListener("click", () => {
    window.print();
  });

  refs.formIncidencia?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!refs.formIncidencia) return;
    const data = new FormData(refs.formIncidencia);
    const incidencia = formDataToIncidencia(data);
    try {
      const id = await guardarIncidencia(incidencia);
      const archivos = data.getAll("archivos").filter((valor) => valor instanceof File);
      if (archivos.length) {
        const nuevos = await subirArchivosIncidencia(id, archivos);
        const existente = state.incidencias.find((item) => item.id === id)?.archivos ?? [];
        const actualizados = [...existente, ...nuevos];
        await actualizarArchivosIncidencia(id, actualizados);
      }
      showToast("Incidencia guardada", "success");
      closeModal(refs.modalIncidencia);
      refs.formIncidencia.reset();
    } catch (error) {
      console.error(error);
      refs.errorIncidencia.textContent = traducirError(error);
    }
  });

  refs.formFiltros?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!refs.formFiltros) return;
    const data = new FormData(refs.formFiltros);
    state.filtros = {
      ...state.filtros,
      edificioId: data.get("edificioId") ? String(data.get("edificioId")) : "",
      prioridad: data.get("prioridad") ? String(data.get("prioridad")) : "",
      estado: data.get("estado") ? String(data.get("estado")) : "",
      reparadorId: data.get("reparadorId") ? String(data.get("reparadorId")) : "",
      desde: data.get("desde") ? String(data.get("desde")) : "",
      hasta: data.get("hasta") ? String(data.get("hasta")) : "",
      etiquetas: parseTags(String(data.get("etiquetas") ?? "")),
      soloSiniestros: data.get("soloSiniestros") === "on",
    };
    closeModal(refs.modalFiltros);
    refrescarUI();
  });

  refs.btnLimpiarFiltros?.addEventListener("click", () => {
    state.filtros = {};
    if (refs.busquedaInput) refs.busquedaInput.value = "";
    refs.formFiltros?.reset();
    refrescarUI();
  });

  refs.btnAbrirArchivos?.addEventListener("click", async () => {
    if (!state.seleccion) return;
    try {
      const archivos = await obtenerArchivosIncidencia(state.seleccion.id);
      const actualizada = { ...state.seleccion, archivos };
      state.seleccion = actualizada;
      state.incidencias = state.incidencias.map((item) =>
        item.id === actualizada.id ? { ...item, archivos } : item
      );
      renderArchivos(archivos);
      renderDetalle(enriquecerIncidencia(actualizada));
      if (refs.modalArchivos instanceof HTMLDialogElement) {
        openModal(refs.modalArchivos);
      }
    } catch (error) {
      console.error(error);
      showToast("No se pudieron cargar los archivos", "error");
    }
  });

  refs.modalArchivos?.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const accion = target.closest("[data-delete-path]");
    if (!accion || !state.seleccion) return;
    const path = accion.getAttribute("data-delete-path") ?? "";
    if (!path) return;
    try {
      await eliminarArchivoStorage(path);
      const restantes = (state.seleccion.archivos ?? []).filter((item) => item.path !== path);
      await actualizarArchivosIncidencia(state.seleccion.id, restantes);
      const id = state.seleccion.id;
      state.seleccion = { ...state.seleccion, archivos: restantes };
      state.incidencias = state.incidencias.map((item) =>
        item.id === id ? { ...item, archivos: restantes } : item
      );
      renderArchivos(restantes);
      renderDetalle(enriquecerIncidencia(state.seleccion));
      showToast("Archivo eliminado", "success");
    } catch (error) {
      console.error(error);
      showToast("No se pudo eliminar el archivo", "error");
    }
  });

  refs.btnEditarIncidencia?.addEventListener("click", () => {
    if (!state.seleccion) return;
    prepararFormularioIncidencia(state.seleccion);
    if (refs.modalIncidencia instanceof HTMLDialogElement) {
      openModal(refs.modalIncidencia);
    }
  });

  const btnEliminar = document.getElementById("btn-eliminar-incidencia");
  btnEliminar?.addEventListener("click", async () => {
    if (!state.seleccion) return;
    const confirmar = window.confirm("¿Eliminar la incidencia seleccionada?");
    if (!confirmar) return;
    try {
      const id = state.seleccion.id;
      await eliminarIncidencia(id);
      showToast("Incidencia eliminada", "success");
      state.incidencias = state.incidencias.filter((item) => item.id !== id);
      state.seleccion = null;
      renderDetalle(null);
      refrescarUI();
    } catch (error) {
      console.error(error);
      showToast("No se pudo eliminar la incidencia", "error");
    }
  });

  setupDragAndDrop();
}

function handleAuthState(user) {
  state.user = user;
  if (user) {
    mostrarApp();
    iniciarSuscripciones();
    cargarCatalogos();
  } else {
    ocultarApp();
  }
}

function mostrarApp() {
  refs.loginView?.setAttribute("hidden", "true");
  refs.loginView?.classList.add("hidden");
  refs.appView?.removeAttribute("hidden");
  refs.appView?.classList.remove("hidden");
  refs.logoutButton?.removeAttribute("hidden");
}

function ocultarApp() {
  refs.loginView?.removeAttribute("hidden");
  refs.loginView?.classList.remove("hidden");
  refs.appView?.setAttribute("hidden", "true");
  refs.appView?.classList.add("hidden");
  refs.logoutButton?.setAttribute("hidden", "true");
  unsubscribeIncidencias?.();
  unsubscribeIncidencias = null;
  state.incidencias = [];
  state.seleccion = null;
  renderDetalle(null);
  refrescarUI();
}

function iniciarSuscripciones() {
  unsubscribeIncidencias?.();
  unsubscribeIncidencias = suscribirIncidencias((incidencias) => {
    state.incidencias = incidencias;
    if (state.seleccion) {
      state.seleccion = incidencias.find((item) => item.id === state.seleccion.id) ?? null;
    }
    refrescarUI();
  });
}

async function cargarCatalogos() {
  try {
    const [edificios, reparadores, polizas] = await Promise.all([
      obtenerCatalogo("edificios"),
      obtenerCatalogo("reparadores"),
      obtenerCatalogo("polizas_seguros"),
    ]);
    state.catalogos = { edificios, reparadores, polizas };
    poblarSelect(
      /** @type {HTMLSelectElement} */ (document.getElementById("incidencia-edificio")),
      edificios,
      "Selecciona un edificio"
    );
    poblarSelect(
      /** @type {HTMLSelectElement} */ (document.getElementById("incidencia-reparador")),
      reparadores,
      "Selecciona un reparador"
    );
    poblarSelect(
      /** @type {HTMLSelectElement} */ (document.getElementById("incidencia-poliza")),
      polizas,
      "Selecciona una póliza"
    );
    poblarSelect(
      /** @type {HTMLSelectElement} */ (document.getElementById("filtro-edificio")),
      edificios,
      "Todos"
    );
    poblarSelect(
      /** @type {HTMLSelectElement} */ (document.getElementById("filtro-reparador")),
      reparadores,
      "Todos"
    );
    refrescarUI();
  } catch (error) {
    console.error("No se pudieron cargar los catálogos", error);
  }
}

function refrescarUI() {
  if (!refs.listaIncidencias || !refs.listaWrapper || !refs.kanbanBoard) return;
  const filtradas = obtenerIncidenciasFiltradas();
  if (state.seleccion && !filtradas.some((item) => item.id === state.seleccion.id)) {
    state.seleccion = filtradas[0] ?? null;
  }
  if (!state.seleccion && filtradas.length) {
    state.seleccion = filtradas[0];
  }
  const seleccionId = state.seleccion?.id;
  const enriquecidas = enriquecerIncidencias(filtradas);
  renderListaIncidencias(refs.listaIncidencias, enriquecidas, seleccionId);
  renderKanban(refs.columnasKanban, enriquecidas, seleccionId);
  renderDetalle(state.seleccion ? enriquecerIncidencia(state.seleccion) : null);
  const resumen = calcularResumen(filtradas);
  actualizarResumen(resumen);
  toggleVista(refs.listaWrapper, refs.kanbanBoard, state.vista);
  if (refs.btnToggleVista) {
    refs.btnToggleVista.textContent = state.vista === "kanban" ? "Ver lista" : "Ver Kanban";
  }
}

function obtenerIncidenciasFiltradas() {
  return state.incidencias.filter((incidencia) => filtrarIncidencia(incidencia, state.filtros));
}

function handleSelectIncidencia(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const tarjeta = target.closest(".tarjeta-incidencia");
  if (!tarjeta) return;
  event.preventDefault();
  seleccionarIncidencia(tarjeta.dataset.id);
}

function seleccionarIncidencia(id) {
  if (!id) return;
  const incidencia = state.incidencias.find((item) => item.id === id);
  if (!incidencia) return;
  state.seleccion = incidencia;
  refrescarUI();
}

function formDataToIncidencia(data) {
  const etiquetas = parseTags(String(data.get("etiquetas") ?? ""));
  const payload = {
    id: data.get("id") ? String(data.get("id")) : undefined,
    titulo: String(data.get("titulo") ?? "").trim(),
    descripcion: String(data.get("descripcion") ?? ""),
    estado: String(data.get("estado") ?? "abierta"),
    prioridad: String(data.get("prioridad") ?? "media"),
    edificioId: data.get("edificioId") ? String(data.get("edificioId")) : "",
    reparadorId: data.get("reparadorId") ? String(data.get("reparadorId")) : "",
    etiquetas,
    esSiniestro: data.get("esSiniestro") === "on",
    polizaId: data.get("polizaId") ? String(data.get("polizaId")) : "",
    referenciaSiniestro: String(data.get("referenciaSiniestro") ?? ""),
    fechaLimite: data.get("fechaLimite") ? String(data.get("fechaLimite")) : "",
  };
  if (!payload.titulo) {
    throw new Error("El título es obligatorio");
  }
  return payload;
}

function prepararFormularioIncidencia(incidencia) {
  if (!refs.formIncidencia) return;
  refs.formIncidencia.reset();
  setFieldValue("#incidencia-id", incidencia.id ?? "");
  setFieldValue("#incidencia-titulo", incidencia.titulo ?? "");
  setFieldValue("#incidencia-descripcion", incidencia.descripcion ?? "");
  setFieldValue("#incidencia-estado", incidencia.estado ?? "abierta");
  setFieldValue("#incidencia-prioridad", incidencia.prioridad ?? "media");
  setFieldValue("#incidencia-edificio", incidencia.edificioId ?? "");
  setFieldValue("#incidencia-reparador", incidencia.reparadorId ?? "");
  setFieldValue("#incidencia-etiquetas", (incidencia.etiquetas ?? []).join(", "));
  setFieldChecked("#incidencia-siniestro", Boolean(incidencia.esSiniestro));
  setFieldValue("#incidencia-poliza", incidencia.polizaId ?? "");
  setFieldValue("#incidencia-referencia", incidencia.referenciaSiniestro ?? "");
  const fecha = incidencia.fechaLimite ? String(incidencia.fechaLimite).slice(0, 10) : "";
  setFieldValue("#incidencia-fecha-limite", fecha);
  refs.errorIncidencia.textContent = "";
  actualizarTituloModalIncidencia("edit");
}

function setupDragAndDrop() {
  document.addEventListener("dragstart", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.classList.contains("tarjeta-incidencia")) {
      event.dataTransfer?.setData("text/plain", target.dataset.id ?? "");
      event.dataTransfer?.setDragImage(target, 20, 20);
    }
  });

  document.addEventListener("dragover", (event) => {
    const target = event.target;
    const lista = target instanceof HTMLElement ? target.closest(".kanban-list") : null;
    if (lista instanceof HTMLElement) {
      event.preventDefault();
      lista.classList.add("drag-over");
    }
  });

  document.addEventListener("dragleave", (event) => {
    const target = event.target;
    const lista = target instanceof HTMLElement ? target.closest(".kanban-list") : null;
    if (lista instanceof HTMLElement) {
      lista.classList.remove("drag-over");
    }
  });

  document.addEventListener("drop", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const lista = target.closest(".kanban-list");
    if (!lista) return;
    event.preventDefault();
    lista.classList.remove("drag-over");
    const id = event.dataTransfer?.getData("text/plain");
    if (!id) return;
    const estado = lista.parentElement?.getAttribute("data-estado") ?? "abierta";
    try {
      await actualizarEstadoIncidencia(id, estado);
      showToast("Estado actualizado", "success");
    } catch (error) {
      console.error(error);
      showToast("No se pudo actualizar el estado", "error");
    }
  });
}

function traducirError(error) {
  if (!error) return "Ha ocurrido un error";
  const mensaje = typeof error === "string" ? error : error.message ?? "Ha ocurrido un error";
  if (mensaje.includes("auth/user-not-found")) return "Usuario no encontrado";
  if (mensaje.includes("auth/wrong-password")) return "Contraseña incorrecta";
  if (mensaje.includes("auth/invalid-email")) return "Email inválido";
  return mensaje;
}

function actualizarTituloModalIncidencia(modo) {
  if (!refs.modalIncidencia) return;
  const titulo = refs.modalIncidencia.querySelector("#modal-incidencia-titulo");
  if (titulo) {
    titulo.textContent = modo === "edit" ? "Editar incidencia" : "Nueva incidencia";
  }
}

function setFieldValue(selector, value) {
  if (!refs.formIncidencia) return;
  const field = refs.formIncidencia.querySelector(selector);
  if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
    field.value = value ?? "";
  }
}

function setFieldChecked(selector, checked) {
  if (!refs.formIncidencia) return;
  const field = refs.formIncidencia.querySelector(selector);
  if (field instanceof HTMLInputElement) {
    field.checked = checked;
  }
}

function enriquecerIncidencias(incidencias) {
  return incidencias.map(enriquecerIncidencia);
}

function enriquecerIncidencia(incidencia) {
  const edificio = state.catalogos.edificios.find((item) => item.id === incidencia.edificioId);
  const reparador = state.catalogos.reparadores.find((item) => item.id === incidencia.reparadorId);
  const poliza = state.catalogos.polizas.find((item) => item.id === incidencia.polizaId);
  return {
    ...incidencia,
    edificioNombre: edificio?.nombre ?? edificio?.razonSocial ?? incidencia.edificioId ?? "",
    reparadorNombre: reparador?.nombre ?? reparador?.razonSocial ?? incidencia.reparadorId ?? "",
    polizaNombre: poliza?.nombre ?? poliza?.referencia ?? incidencia.polizaId ?? "",
  };
}
