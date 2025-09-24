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
  obtenerFiltrosGuardados,
  guardarFiltroGuardado,
  eliminarFiltroGuardado,
  obtenerComunicaciones,
  agregarComunicacion,
  crearEdificio,
  actualizarEdificio,
  eliminarEdificio,
  crearReparador,
  actualizarReparador,
  eliminarReparador,
  crearPoliza,
  actualizarPoliza,
  eliminarPoliza,
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
  actualizarResumenDiario,
  renderAgenda,
  renderFiltrosRapidos,
} from "./ui.js";
import {
  parseTags,
  createCsvWithBom,
  downloadTextFile,
  filtrarIncidencia,
  calcularResumen,
  formatDate,
  calcularResumenDiario,
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
  filtrosGuardados: [],
  filtroActivoId: null,
  detalle: {
    comunicaciones: [],
  },
  detalleActualId: null,
  edificioEditandoId: null,
  reparadorEditandoId: null,
  polizaEditandoId: null,
};

let unsubscribeIncidencias = null;

const refs = {};

const recordatoriosMostrados = new Set();

const PRIORIDAD_LABELS = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  critica: "Crítica",
};

const ESTADO_LABELS = {
  abierta: "Abierta",
  en_proceso: "En proceso",
  cerrada: "Cerrada",
};

/**
 * Inicializa la aplicación al cargar el documento.
 */
document.addEventListener("DOMContentLoaded", () => {
  cacheDom();
  setupModales();
  setupEventListeners();
  renderDetalle(null, state.detalle);
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
  refs.modalEdificios = document.getElementById("modal-edificios");
  refs.modalReparadores = document.getElementById("modal-reparadores");
  refs.modalPolizas = document.getElementById("modal-polizas");
  refs.errorIncidencia = document.getElementById("incidencia-error");
  refs.btnToggleVista = document.getElementById("btn-toggle-vista");
  refs.btnExportar = document.getElementById("btn-exportar");
  refs.btnImprimir = document.getElementById("btn-imprimir");
  refs.btnAbrirArchivos = document.getElementById("btn-abrir-archivos");
  refs.btnEditarIncidencia = document.getElementById("btn-editar-incidencia");
  refs.btnLimpiarFiltros = document.getElementById("btn-limpiar-filtros");
  refs.btnGuardarFiltro = document.getElementById("btn-guardar-filtro");
  refs.filtroNombre = document.getElementById("filtro-nombre-rapido");
  refs.filtrosRapidos = document.getElementById("filtros-rapidos");
  refs.agenda = document.getElementById("agenda-calendario");
  refs.formComunicacion = document.getElementById("form-comunicacion");
  refs.comunicacionError = document.getElementById("comunicacion-error");
  refs.comunicacionesLista = document.getElementById("comunicaciones-lista");
  refs.btnImprimirDetalle = document.getElementById("btn-imprimir-detalle");
  refs.printResumen = document.getElementById("print-resumen");
  refs.printDetalle = document.getElementById("print-detalle");
  refs.formEdificio = document.getElementById("form-edificio");
  refs.listaEdificios = document.getElementById("lista-edificios");
  refs.errorEdificio = document.getElementById("edificio-error");
  refs.btnCancelarEdificio = document.getElementById("btn-cancelar-edificio");
  refs.formEdificioTitulo = document.getElementById("modal-edificios-form-titulo");
  refs.btnGuardarEdificio = document.getElementById("btn-guardar-edificio");
  refs.formReparador = document.getElementById("form-reparador");
  refs.listaReparadores = document.getElementById("lista-reparadores");
  refs.errorReparador = document.getElementById("reparador-error");
  refs.btnCancelarReparador = document.getElementById("btn-cancelar-reparador");
  refs.formReparadorTitulo = document.getElementById("modal-reparadores-form-titulo");
  refs.btnGuardarReparador = document.getElementById("btn-guardar-reparador");
  refs.formPoliza = document.getElementById("form-poliza");
  refs.listaPolizas = document.getElementById("lista-polizas");
  refs.errorPoliza = document.getElementById("poliza-error");
  refs.btnCancelarPoliza = document.getElementById("btn-cancelar-poliza");
  refs.formPolizaTitulo = document.getElementById("modal-polizas-form-titulo");
  refs.btnGuardarPoliza = document.getElementById("btn-guardar-poliza");
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

    const triggerIncidencia = target.closest('[data-modal-target="modal-incidencia"]');
    if (triggerIncidencia) {
      const mode = triggerIncidencia.getAttribute("data-modal-mode") ?? "create";
      if (refs.modalIncidencia) {
        refs.modalIncidencia.dataset.mode = mode;
      }
      actualizarTituloModalIncidencia(mode);
      if (mode === "create") {
        refs.formIncidencia?.reset();
        refs.errorIncidencia.textContent = "";
        const idField = refs.formIncidencia?.querySelector("#incidencia-id");
        if (idField instanceof HTMLInputElement) {
          idField.value = "";
        }
      }
    }

    const triggerEdificios = target.closest('[data-modal-target="modal-edificios"]');
    if (triggerEdificios) {
      prepararModalEdificios();
    }

    const triggerReparadores = target.closest('[data-modal-target="modal-reparadores"]');
    if (triggerReparadores) {
      prepararModalReparadores();
    }

    const triggerPolizas = target.closest('[data-modal-target="modal-polizas"]');
    if (triggerPolizas) {
      prepararModalPolizas();
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

  refs.listaIncidencias?.addEventListener("click", handleMoveIncidencia);
  refs.listaIncidencias?.addEventListener("click", handleSelectIncidencia);
  refs.listaIncidencias?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      const target = event.target;
      if (target instanceof HTMLElement) {
        if (target.closest('[data-action="move-incidencia"]')) {
          return;
        }
        const tarjeta = target.closest(".tarjeta-incidencia");
        if (tarjeta) {
          event.preventDefault();
          abrirModalEdicionIncidencia(tarjeta.dataset.id);
        }
      }
    }
  });

  refs.kanbanBoard?.addEventListener("click", handleMoveIncidencia);
  refs.kanbanBoard?.addEventListener("click", handleSelectIncidencia);
  refs.kanbanBoard?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      const target = event.target;
      if (target instanceof HTMLElement) {
        if (target.closest('[data-action="move-incidencia"]')) {
          return;
        }
        const tarjeta = target.closest(".tarjeta-incidencia");
        if (tarjeta) {
          event.preventDefault();
          abrirModalEdicionIncidencia(tarjeta.dataset.id);
        }
      }
    }
  });

  refs.formEdificio?.addEventListener("submit", handleSubmitEdificio);
  refs.btnCancelarEdificio?.addEventListener("click", () => prepararFormularioEdificio(null));
  refs.listaEdificios?.addEventListener("click", handleAccionEdificio);
  refs.formReparador?.addEventListener("submit", handleSubmitReparador);
  refs.btnCancelarReparador?.addEventListener("click", () => prepararFormularioReparador(null));
  refs.listaReparadores?.addEventListener("click", handleAccionReparador);
  refs.formPoliza?.addEventListener("submit", handleSubmitPoliza);
  refs.btnCancelarPoliza?.addEventListener("click", () => prepararFormularioPoliza(null));
  refs.listaPolizas?.addEventListener("click", handleAccionPoliza);

  refs.busquedaInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      state.filtros.busqueda = refs.busquedaInput.value.trim();
      state.filtroActivoId = null;
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
    document.body.dataset.printMode = "listado";
    window.print();
  });

  refs.btnImprimirDetalle?.addEventListener("click", async () => {
    if (!state.seleccion) return;
    document.body.dataset.printMode = "detalle";
    await prepararDetalleExtra(state.seleccion, { force: true });
    const incidencia = enriquecerIncidencia(state.seleccion);
    renderDetalleImpresion(incidencia, state.detalle.comunicaciones);
    window.print();
  });

  refs.formIncidencia?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!refs.formIncidencia) return;
    const data = new FormData(refs.formIncidencia);
    const incidencia = formDataToIncidencia(data);
    const archivosInput = refs.formIncidencia.querySelector("#incidencia-archivo");
    const archivosSeleccionados =
      archivosInput instanceof HTMLInputElement && archivosInput.files
        ? Array.from(archivosInput.files)
        : [];
    const erroresValidacion = validarIncidencia(incidencia, archivosSeleccionados);
    if (erroresValidacion.length) {
      const mensaje = erroresValidacion[0];
      if (refs.errorIncidencia) {
        refs.errorIncidencia.textContent = mensaje;
      }
      showToast(mensaje, "error");
      return;
    }
    if (refs.errorIncidencia) {
      refs.errorIncidencia.textContent = "";
    }
    try {
      const id = await guardarIncidencia(incidencia);
      if (archivosSeleccionados.length) {
        const nuevos = await subirArchivosIncidencia(id, archivosSeleccionados);
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

  const incidenciaEdificio = refs.formIncidencia?.querySelector("#incidencia-edificio");
  if (incidenciaEdificio instanceof HTMLSelectElement) {
    incidenciaEdificio.addEventListener("change", () => autoAsignarPolizaPorEdificio({ force: true }));
  }
  const incidenciaSiniestro = refs.formIncidencia?.querySelector("#incidencia-siniestro");
  if (incidenciaSiniestro instanceof HTMLInputElement) {
    incidenciaSiniestro.addEventListener("change", () => {
      if (incidenciaSiniestro.checked) {
        autoAsignarPolizaPorEdificio({ force: true });
      } else {
        autoAsignarPolizaPorEdificio({ clear: true });
      }
    });
  }

  refs.formFiltros?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!refs.formFiltros) return;
    const data = new FormData(refs.formFiltros);
    const filtrosFormulario = construirFiltrosDesdeFormulario(data);
    const busquedaActual = refs.busquedaInput?.value.trim() ?? state.filtros.busqueda ?? "";
    state.filtros = { ...filtrosFormulario, busqueda: busquedaActual };
    state.filtroActivoId = null;
    closeModal(refs.modalFiltros);
    refrescarUI();
  });

  refs.btnLimpiarFiltros?.addEventListener("click", () => {
    state.filtros = {};
    state.filtroActivoId = null;
    if (refs.busquedaInput) refs.busquedaInput.value = "";
    refs.formFiltros?.reset();
    refrescarUI();
  });

  refs.btnGuardarFiltro?.addEventListener("click", async (event) => {
    event.preventDefault();
    if (!refs.formFiltros || !state.user) return;
    const nombre = refs.filtroNombre?.value.trim() ?? "";
    if (!nombre) {
      showToast("Indica un nombre para el filtro", "error");
      return;
    }
    const data = new FormData(refs.formFiltros);
    const criterios = {
      ...construirFiltrosDesdeFormulario(data),
      busqueda: refs.busquedaInput?.value.trim() ?? state.filtros.busqueda ?? "",
    };
    try {
      await guardarFiltroGuardado(state.user.uid, { nombre, criterios });
      showToast("Filtro guardado", "success");
      if (refs.filtroNombre) refs.filtroNombre.value = "";
      await cargarFiltrosGuardados();
    } catch (error) {
      console.error(error);
      showToast("No se pudo guardar el filtro", "error");
    }
  });

  refs.filtrosRapidos?.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const chip = target.closest(".chip");
    if (!chip) return;
    const filtroId = chip.dataset.id ?? "";
    if (!filtroId) return;
    const action = target.dataset.action;
    if (action === "delete") {
      if (!state.user) return;
      const confirmar = window.confirm("¿Eliminar este filtro rápido?");
      if (!confirmar) return;
      try {
        await eliminarFiltroGuardado(state.user.uid, filtroId);
        if (state.filtroActivoId === filtroId) {
          state.filtroActivoId = null;
        }
        await cargarFiltrosGuardados();
        showToast("Filtro eliminado", "success");
      } catch (error) {
        console.error(error);
        showToast("No se pudo eliminar el filtro", "error");
      }
      return;
    }
    if (action === "apply") {
      const filtro = state.filtrosGuardados.find((item) => item.id === filtroId);
      if (!filtro) return;
      aplicarFiltroGuardado(filtro);
    }
  });

  refs.formComunicacion?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!refs.formComunicacion || !state.seleccion || !state.user) return;
    const data = new FormData(refs.formComunicacion);
    const mensaje = String(data.get("mensaje") ?? "").trim();
    const tipo = String(data.get("tipo") ?? "nota");
    if (!mensaje) {
      if (refs.comunicacionError) {
        refs.comunicacionError.textContent = "El detalle es obligatorio";
      }
      return;
    }
    if (refs.comunicacionError) refs.comunicacionError.textContent = "";
    try {
      const autor = state.user.displayName ?? state.user.email ?? "Equipo";
      await agregarComunicacion(state.seleccion.id, { tipo, mensaje, autor });
      refs.formComunicacion.reset();
      await prepararDetalleExtra(state.seleccion, { force: true });
      showToast("Comunicación registrada", "success");
    } catch (error) {
      console.error(error);
      if (refs.comunicacionError) {
        refs.comunicacionError.textContent = traducirError(error);
      }
    }
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
      renderDetalle(enriquecerIncidencia(actualizada), state.detalle);
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
    if (!(accion instanceof HTMLButtonElement) || !state.seleccion) return;
    const path = accion.dataset.deletePath ?? "";
    if (!path) return;
    const confirmar = window.confirm("¿Eliminar este archivo adjunto?");
    if (!confirmar) return;
    const textoOriginal = accion.textContent;
    accion.textContent = "Eliminando...";
    accion.disabled = true;
    accion.setAttribute("aria-busy", "true");
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
      renderDetalle(enriquecerIncidencia(state.seleccion), state.detalle);
      showToast("Archivo eliminado", "success");
    } catch (error) {
      console.error(error);
      showToast("No se pudo eliminar el archivo", "error");
    } finally {
      accion.textContent = textoOriginal ?? "Eliminar";
      accion.disabled = false;
      accion.removeAttribute("aria-busy");
    }
  });

  refs.btnEditarIncidencia?.addEventListener("click", () => {
    if (!state.seleccion) return;
    prepararFormularioIncidencia(state.seleccion);
    if (refs.modalIncidencia) {
      refs.modalIncidencia.dataset.mode = "edit";
    }
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
      state.detalle = { comunicaciones: [] };
      state.detalleActualId = null;
      renderDetalle(null, state.detalle);
      refrescarUI();
    } catch (error) {
      console.error(error);
      showToast("No se pudo eliminar la incidencia", "error");
    }
  });

  setupDragAndDrop();

  window.addEventListener("afterprint", () => {
    delete document.body.dataset.printMode;
    if (refs.printDetalle) {
      refs.printDetalle.innerHTML = "";
    }
  });
}

function handleAuthState(user) {
  state.user = user;
  if (user) {
    mostrarApp();
    iniciarSuscripciones();
    cargarCatalogos();
    cargarFiltrosGuardados();
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
  state.filtros = {};
  state.filtrosGuardados = [];
  state.filtroActivoId = null;
  state.detalle = { comunicaciones: [] };
  state.detalleActualId = null;
  state.catalogos = { edificios: [], reparadores: [], polizas: [] };
  state.edificioEditandoId = null;
  state.reparadorEditandoId = null;
  state.polizaEditandoId = null;
  recordatoriosMostrados.clear();
  renderFiltrosRapidos(refs.filtrosRapidos, [], null);
  if (refs.agenda) refs.agenda.innerHTML = "";
  renderDetalle(null, state.detalle);
  renderListadoEdificios();
  renderListadoReparadores();
  renderListadoPolizas();
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
    actualizarSelectsEdificio(edificios);
    actualizarSelectsReparador(reparadores);
    actualizarSelectsPoliza(polizas);
    renderListadoEdificios();
    renderListadoReparadores();
    renderListadoPolizas();
    refrescarUI();
    autoAsignarPolizaPorEdificio();
  } catch (error) {
    console.error("No se pudieron cargar los catálogos", error);
    showToast("No se pudieron cargar los catálogos. Inténtalo de nuevo.", "error");
  }
}

function refrescarUI() {
  if (!refs.listaIncidencias || !refs.listaWrapper || !refs.kanbanBoard) return;
  const filtradas = obtenerIncidenciasFiltradas();
  if (state.seleccion && !filtradas.some((item) => item.id === state.seleccion.id)) {
    state.seleccion = null;
  }

  if (!state.seleccion) {
    state.detalle = { comunicaciones: [] };
    state.detalleActualId = null;
  } else if (state.detalleActualId !== state.seleccion.id) {
    state.detalle.comunicaciones = [];
    state.detalleActualId = state.seleccion.id;
    prepararDetalleExtra(state.seleccion);
  }

  const seleccionId = state.seleccion?.id;
  const incidenciasFiltradas = enriquecerIncidencias(filtradas);
  renderListaIncidencias(refs.listaIncidencias, incidenciasFiltradas, seleccionId);
  renderKanban(refs.columnasKanban, incidenciasFiltradas, seleccionId);
  const detalleActual = state.seleccion ? enriquecerIncidencia(state.seleccion) : null;
  renderDetalle(detalleActual, state.detalle);

  const resumen = calcularResumen(filtradas);
  actualizarResumen(resumen);

  const resumenDiario = calcularResumenDiario(state.incidencias);
  actualizarResumenDiario(resumenDiario);

  renderFiltrosRapidos(refs.filtrosRapidos, state.filtrosGuardados, state.filtroActivoId);

  const todasEnriquecidas = enriquecerIncidencias(state.incidencias);
  renderAgenda(refs.agenda, todasEnriquecidas);

  actualizarResumenFiltrosImpresion(state.filtros);

  toggleVista(refs.listaWrapper, refs.kanbanBoard, state.vista);
  if (refs.btnToggleVista) {
    refs.btnToggleVista.textContent = state.vista === "kanban" ? "Ver lista" : "Ver Kanban";
  }

  gestionarRecordatorios(state.incidencias);
}

function obtenerIncidenciasFiltradas() {
  return state.incidencias.filter((incidencia) => filtrarIncidencia(incidencia, state.filtros));
}

function handleSelectIncidencia(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.closest('[data-action="move-incidencia"]')) return;
  const tarjeta = target.closest(".tarjeta-incidencia");
  if (!tarjeta) return;
  event.preventDefault();
  abrirModalEdicionIncidencia(tarjeta.dataset.id);
}

async function handleMoveIncidencia(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const accion = target.closest('[data-action="move-incidencia"]');
  if (!(accion instanceof HTMLElement)) return;
  const tarjeta = accion.closest(".tarjeta-incidencia");
  if (!tarjeta) return;
  event.preventDefault();
  event.stopPropagation();
  const id = tarjeta.dataset.id ?? "";
  const estado = accion.getAttribute("data-estado") ?? "";
  if (!id || !estado) return;
  if (state.seleccion?.id === id && state.seleccion.estado === estado) {
    return;
  }
  accion.setAttribute("aria-busy", "true");
  accion.setAttribute("disabled", "true");
  try {
    await actualizarEstadoIncidencia(id, estado);
    showToast("Estado actualizado", "success");
  } catch (error) {
    console.error(error);
    showToast("No se pudo actualizar el estado", "error");
  } finally {
    accion.removeAttribute("aria-busy");
    accion.removeAttribute("disabled");
  }
}

function abrirModalEdicionIncidencia(id) {
  if (!id) return;
  seleccionarIncidencia(id);
  if (!state.seleccion) return;
  prepararFormularioIncidencia(state.seleccion);
  actualizarTituloModalIncidencia("edit");
  if (refs.modalIncidencia instanceof HTMLDialogElement) {
    refs.modalIncidencia.dataset.mode = "edit";
    openModal(refs.modalIncidencia);
  }
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

function validarIncidencia(incidencia, archivos) {
  const errores = [];
  const descripcion = incidencia.descripcion?.trim() ?? "";
  if (descripcion.length < 15) {
    errores.push("La descripción debe incluir al menos 15 caracteres.");
  }
  if (incidencia.esSiniestro && !(incidencia.referenciaSiniestro ?? "").trim()) {
    errores.push("Indica la referencia del siniestro.");
  }
  const fechaLimite = incidencia.fechaLimite ? new Date(incidencia.fechaLimite) : null;
  if (fechaLimite && Number.isNaN(fechaLimite.getTime())) {
    errores.push("La fecha límite no es válida.");
  } else if (fechaLimite) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    if (!incidencia.id && fechaLimite < hoy) {
      errores.push("La fecha límite no puede ser anterior a hoy.");
    }
    if (incidencia.id) {
      const original = state.incidencias.find((item) => item.id === incidencia.id);
      const originalCreacion = original?.fechaCreacion ? new Date(original.fechaCreacion) : null;
      if (originalCreacion && !Number.isNaN(originalCreacion.getTime()) && fechaLimite < originalCreacion) {
        errores.push("La fecha límite no puede ser anterior a la fecha de creación.");
      }
    }
  }
  const tiposPermitidos = [
    "image/",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  const maxSize = 10 * 1024 * 1024;
  const limiteMb = Math.round(maxSize / (1024 * 1024));
  archivos.forEach((archivo) => {
    const permitido = tiposPermitidos.some((tipo) =>
      tipo.endsWith("/") ? archivo.type.startsWith(tipo) : archivo.type === tipo
    );
    if (!permitido) {
      errores.push(`El archivo ${archivo.name} no tiene un formato permitido.`);
    }
    if (archivo.size > maxSize) {
      errores.push(`El archivo ${archivo.name} supera los ${limiteMb} MB permitidos.`);
    }
  });
  return errores;
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
  autoAsignarPolizaPorEdificio();
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

function prepararModalEdificios() {
  prepararFormularioEdificio(null);
  renderListadoEdificios();
  window.requestAnimationFrame(() => {
    const nombre = refs.formEdificio?.querySelector("#edificio-nombre");
    if (nombre instanceof HTMLInputElement) {
      nombre.focus();
    }
  });
}

function prepararFormularioEdificio(edificio) {
  if (!refs.formEdificio) return;
  const esEdicion = Boolean(edificio && edificio.id);
  state.edificioEditandoId = esEdicion ? String(edificio.id) : null;
  if (refs.formEdificioTitulo) {
    refs.formEdificioTitulo.textContent = esEdicion ? "Editar edificio" : "Añadir edificio";
  }
  if (refs.btnGuardarEdificio instanceof HTMLButtonElement) {
    refs.btnGuardarEdificio.textContent = esEdicion ? "Actualizar edificio" : "Guardar edificio";
  }
  refs.formEdificio.dataset.mode = esEdicion ? "edit" : "create";
  if (refs.errorEdificio) {
    refs.errorEdificio.textContent = "";
  }
  refs.formEdificio.reset();
  actualizarSelectsPoliza(state.catalogos.polizas);
  const idField = refs.formEdificio.querySelector("#edificio-id");
  if (idField instanceof HTMLInputElement) {
    idField.value = esEdicion ? String(edificio.id) : "";
  }
  const selectPoliza = refs.formEdificio.querySelector("#edificio-poliza");
  if (selectPoliza instanceof HTMLSelectElement) {
    const seleccion = esEdicion ? obtenerPolizaAsignadaEdificio(edificio) : "";
    selectPoliza.value = seleccion;
  }
  const asignar = (selector, valor) => {
    const field = refs.formEdificio?.querySelector(selector);
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      field.value = valor ?? "";
    }
  };
  if (esEdicion && edificio) {
    const nombre =
      (typeof edificio.nombre === "string" && edificio.nombre.trim())
        ? edificio.nombre.trim()
        : typeof edificio.razonSocial === "string" && edificio.razonSocial.trim()
        ? edificio.razonSocial.trim()
        : "";
    asignar("#edificio-nombre", nombre);
    asignar("#edificio-direccion", edificio.direccion ?? edificio.direccionCompleta ?? "");
    asignar(
      "#edificio-contacto",
      edificio.contacto ?? edificio.personaContacto ?? edificio.telefono ?? ""
    );
    asignar("#edificio-notas", edificio.notas ?? edificio.observaciones ?? "");
  }
  window.requestAnimationFrame(() => {
    const nombre = refs.formEdificio?.querySelector("#edificio-nombre");
    if (nombre instanceof HTMLInputElement) {
      nombre.focus();
      if (esEdicion) {
        nombre.select();
      }
    }
  });
}

async function handleSubmitEdificio(event) {
  event.preventDefault();
  if (!refs.formEdificio) return;
  const datos = new FormData(refs.formEdificio);
  const payload = {
    nombre: String(datos.get("nombre") ?? "").trim(),
    direccion: String(datos.get("direccion") ?? "").trim(),
    contacto: String(datos.get("contacto") ?? "").trim(),
    notas: String(datos.get("notas") ?? "").trim(),
    defaultPolizaId: String(datos.get("defaultPolizaId") ?? "").trim(),
  };
  if (!payload.nombre) {
    if (refs.errorEdificio) {
      refs.errorEdificio.textContent = "El nombre es obligatorio";
    }
    return;
  }
  if (refs.errorEdificio) {
    refs.errorEdificio.textContent = "";
  }
  const botonGuardar = refs.btnGuardarEdificio;
  const textoOriginal = botonGuardar?.textContent ?? "";
  if (botonGuardar instanceof HTMLButtonElement) {
    botonGuardar.disabled = true;
    botonGuardar.setAttribute("aria-busy", "true");
    botonGuardar.textContent = state.edificioEditandoId ? "Actualizando..." : "Guardando...";
  }
  let exito = false;
  try {
    if (state.edificioEditandoId) {
      await actualizarEdificio(state.edificioEditandoId, payload);
      showToast("Edificio actualizado", "success");
    } else {
      await crearEdificio(payload);
      showToast("Edificio creado", "success");
    }
    exito = true;
    await recargarEdificios();
    prepararFormularioEdificio(null);
  } catch (error) {
    console.error(error);
    if (refs.errorEdificio) {
      refs.errorEdificio.textContent = traducirError(error);
    }
  } finally {
    if (botonGuardar instanceof HTMLButtonElement) {
      botonGuardar.disabled = false;
      botonGuardar.removeAttribute("aria-busy");
      if (!exito) {
        botonGuardar.textContent = textoOriginal || (state.edificioEditandoId ? "Actualizar edificio" : "Guardar edificio");
      }
    }
  }
}

async function recargarEdificios() {
  try {
    const edificios = await obtenerCatalogo("edificios");
    state.catalogos = { ...state.catalogos, edificios };
    actualizarSelectsEdificio(edificios);
    renderListadoEdificios();
    refrescarUI();
    autoAsignarPolizaPorEdificio();
  } catch (error) {
    console.error("No se pudieron cargar los edificios", error);
    showToast("No se pudieron cargar los edificios", "error");
  }
}

function actualizarSelectsEdificio(edificios) {
  const selectIncidencia = /** @type {HTMLSelectElement | null} */ (
    document.getElementById("incidencia-edificio")
  );
  if (selectIncidencia) {
    const valorActual = selectIncidencia.value;
    poblarSelect(selectIncidencia, edificios, "Selecciona un edificio");
    selectIncidencia.value = valorActual;
  }
  const selectFiltro = /** @type {HTMLSelectElement | null} */ (
    document.getElementById("filtro-edificio")
  );
  if (selectFiltro) {
    const valorFiltro = selectFiltro.value;
    poblarSelect(selectFiltro, edificios, "Todos");
    selectFiltro.value = valorFiltro;
  }
}

function renderListadoEdificios() {
  if (!refs.listaEdificios) return;
  const edificios = Array.isArray(state.catalogos.edificios)
    ? [...state.catalogos.edificios]
    : [];
  refs.listaEdificios.innerHTML = "";
  if (!edificios.length) {
    const vacio = document.createElement("li");
    vacio.className = "hint";
    vacio.textContent = "No hay edificios registrados.";
    refs.listaEdificios.appendChild(vacio);
    return;
  }
  edificios.sort((a, b) =>
    obtenerNombreEdificio(a).localeCompare(obtenerNombreEdificio(b), "es", { sensitivity: "base" })
  );
  const fragment = document.createDocumentFragment();
  edificios.forEach((edificio) => {
    const item = document.createElement("li");
    item.className = "edificio-item";
    item.dataset.id = edificio.id ?? "";

    const header = document.createElement("header");
    const titulo = document.createElement("h4");
    titulo.className = "edificio-item-titulo";
    const nombre = obtenerNombreEdificio(edificio) || "(Sin nombre)";
    titulo.textContent = nombre;

    const acciones = document.createElement("div");
    acciones.className = "edificio-item-acciones";
    const btnEditar = document.createElement("button");
    btnEditar.type = "button";
    btnEditar.className = "btn secondary";
    btnEditar.dataset.action = "edit";
    btnEditar.dataset.id = edificio.id ?? "";
    btnEditar.textContent = "Editar";
    const btnEliminar = document.createElement("button");
    btnEliminar.type = "button";
    btnEliminar.className = "btn danger";
    btnEliminar.dataset.action = "delete";
    btnEliminar.dataset.id = edificio.id ?? "";
    btnEliminar.textContent = "Eliminar";
    acciones.append(btnEditar, btnEliminar);
    header.append(titulo, acciones);
    item.appendChild(header);

    const meta = document.createElement("div");
    meta.className = "edificio-item-meta";
    const direccion = edificio.direccion ?? edificio.direccionCompleta ?? "";
    if (direccion) {
      const p = document.createElement("p");
      p.textContent = direccion;
      meta.appendChild(p);
    }
    const contacto = edificio.contacto ?? edificio.personaContacto ?? edificio.telefono ?? "";
    if (contacto) {
      const p = document.createElement("p");
      p.textContent = `Contacto: ${contacto}`;
      meta.appendChild(p);
    }
    const polizaAsignada = obtenerPolizaAsignadaEdificio(edificio);
    if (polizaAsignada) {
      const poliza = state.catalogos.polizas.find((item) => item.id === polizaAsignada);
      const nombrePoliza = obtenerNombrePoliza(poliza) || polizaAsignada;
      const p = document.createElement("p");
      p.textContent = `Póliza: ${nombrePoliza}`;
      meta.appendChild(p);
    }
    const notas = edificio.notas ?? edificio.observaciones ?? "";
    if (notas) {
      const p = document.createElement("p");
      p.textContent = notas;
      meta.appendChild(p);
    }
    if (meta.childElementCount > 0) {
      item.appendChild(meta);
    }
    fragment.appendChild(item);
  });
  refs.listaEdificios.appendChild(fragment);
}

async function handleAccionEdificio(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const accion = target.closest("[data-action]");
  if (!(accion instanceof HTMLElement)) return;
  const id = accion.dataset.id ?? "";
  if (!id) return;
  event.preventDefault();

  const tipo = accion.dataset.action;
  if (tipo === "edit") {
    const edificio = state.catalogos.edificios.find((item) => item.id === id);
    if (edificio) {
      prepararFormularioEdificio(edificio);
    }
    return;
  }

  if (tipo === "delete") {
    const confirmar = window.confirm("¿Eliminar este edificio?");
    if (!confirmar) return;
    const boton = accion instanceof HTMLButtonElement ? accion : null;
    const textoOriginal = boton?.textContent ?? "";
    if (boton) {
      boton.disabled = true;
      boton.setAttribute("aria-busy", "true");
      boton.textContent = "Eliminando...";
    }
    try {
      await eliminarEdificio(id);
      showToast("Edificio eliminado", "success");
      if (state.edificioEditandoId === id) {
        prepararFormularioEdificio(null);
      }
      await recargarEdificios();
    } catch (error) {
      console.error(error);
      showToast("No se pudo eliminar el edificio", "error");
    } finally {
      if (boton) {
        boton.disabled = false;
        boton.removeAttribute("aria-busy");
        boton.textContent = textoOriginal || "Eliminar";
      }
    }
  }
}

function prepararModalPolizas() {
  prepararFormularioPoliza(null);
  renderListadoPolizas();
  window.requestAnimationFrame(() => {
    const nombre = refs.formPoliza?.querySelector("#poliza-nombre");
    if (nombre instanceof HTMLInputElement) {
      nombre.focus();
    }
  });
}

function prepararFormularioPoliza(poliza) {
  if (!refs.formPoliza) return;
  const esEdicion = Boolean(poliza && poliza.id);
  state.polizaEditandoId = esEdicion ? String(poliza.id) : null;
  if (refs.formPolizaTitulo) {
    refs.formPolizaTitulo.textContent = esEdicion ? "Editar póliza" : "Añadir póliza";
  }
  if (refs.btnGuardarPoliza instanceof HTMLButtonElement) {
    refs.btnGuardarPoliza.textContent = esEdicion ? "Actualizar póliza" : "Guardar póliza";
  }
  refs.formPoliza.dataset.mode = esEdicion ? "edit" : "create";
  if (refs.errorPoliza) {
    refs.errorPoliza.textContent = "";
  }
  refs.formPoliza.reset();
  const idField = refs.formPoliza.querySelector("#poliza-id");
  if (idField instanceof HTMLInputElement) {
    idField.value = esEdicion ? String(poliza.id) : "";
  }
  const asignar = (selector, valor) => {
    const field = refs.formPoliza?.querySelector(selector);
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      field.value = valor ?? "";
    }
  };
  if (esEdicion && poliza) {
    asignar("#poliza-nombre", obtenerNombrePoliza(poliza));
    asignar("#poliza-numero", poliza.numero ?? poliza.referencia ?? "");
    asignar("#poliza-compania", poliza.compania ?? poliza.aseguradora ?? "");
    asignar("#poliza-telefono", poliza.telefono ?? poliza.telefonoContacto ?? "");
    asignar("#poliza-email", poliza.email ?? poliza.correo ?? "");
    asignar("#poliza-notas", poliza.notas ?? poliza.observaciones ?? "");
  }
  window.requestAnimationFrame(() => {
    const nombre = refs.formPoliza?.querySelector("#poliza-nombre");
    if (nombre instanceof HTMLInputElement) {
      nombre.focus();
      if (esEdicion) {
        nombre.select();
      }
    }
  });
}

async function handleSubmitPoliza(event) {
  event.preventDefault();
  if (!refs.formPoliza) return;
  const datos = new FormData(refs.formPoliza);
  const payload = {
    nombre: String(datos.get("nombre") ?? "").trim(),
    numero: String(datos.get("numero") ?? "").trim(),
    compania: String(datos.get("compania") ?? "").trim(),
    telefono: String(datos.get("telefono") ?? "").trim(),
    email: String(datos.get("email") ?? "").trim(),
    notas: String(datos.get("notas") ?? "").trim(),
  };
  if (!payload.nombre) {
    if (refs.errorPoliza) {
      refs.errorPoliza.textContent = "El nombre es obligatorio";
    }
    return;
  }
  if (refs.errorPoliza) {
    refs.errorPoliza.textContent = "";
  }
  const botonGuardar = refs.btnGuardarPoliza;
  const textoOriginal = botonGuardar?.textContent ?? "";
  if (botonGuardar instanceof HTMLButtonElement) {
    botonGuardar.disabled = true;
    botonGuardar.setAttribute("aria-busy", "true");
    botonGuardar.textContent = state.polizaEditandoId ? "Actualizando..." : "Guardando...";
  }
  let exito = false;
  try {
    if (state.polizaEditandoId) {
      await actualizarPoliza(state.polizaEditandoId, payload);
      showToast("Póliza actualizada", "success");
    } else {
      await crearPoliza(payload);
      showToast("Póliza creada", "success");
    }
    exito = true;
    await recargarPolizas();
    prepararFormularioPoliza(null);
  } catch (error) {
    console.error(error);
    if (refs.errorPoliza) {
      refs.errorPoliza.textContent = traducirError(error);
    }
  } finally {
    if (botonGuardar instanceof HTMLButtonElement) {
      botonGuardar.disabled = false;
      botonGuardar.removeAttribute("aria-busy");
      if (!exito) {
        botonGuardar.textContent = textoOriginal || (state.polizaEditandoId ? "Actualizar póliza" : "Guardar póliza");
      }
    }
  }
}

async function recargarPolizas() {
  try {
    const polizas = await obtenerCatalogo("polizas_seguros");
    state.catalogos = { ...state.catalogos, polizas };
    actualizarSelectsPoliza(polizas);
    renderListadoPolizas();
    renderListadoEdificios();
    refrescarUI();
    autoAsignarPolizaPorEdificio();
  } catch (error) {
    console.error("No se pudieron cargar las pólizas", error);
    showToast("No se pudieron cargar las pólizas", "error");
  }
}

function actualizarSelectsPoliza(polizas) {
  const listado = Array.isArray(polizas) ? polizas : [];
  const selectIncidencia = /** @type {HTMLSelectElement | null} */ (
    document.getElementById("incidencia-poliza")
  );
  if (selectIncidencia) {
    const valorActual = selectIncidencia.value;
    poblarSelect(selectIncidencia, listado, "Selecciona una póliza");
    const opciones = Array.from(selectIncidencia.options).map((option) => option.value);
    if (opciones.includes(valorActual)) {
      selectIncidencia.value = valorActual;
    } else {
      selectIncidencia.value = "";
    }
  }
  const selectEdificio = /** @type {HTMLSelectElement | null} */ (
    document.getElementById("edificio-poliza")
  );
  if (selectEdificio) {
    const valorActual = selectEdificio.value;
    poblarSelect(selectEdificio, listado, "Sin póliza asignada");
    const opciones = Array.from(selectEdificio.options).map((option) => option.value);
    if (opciones.includes(valorActual)) {
      selectEdificio.value = valorActual;
    } else {
      selectEdificio.value = "";
    }
  }
}

function renderListadoPolizas() {
  if (!refs.listaPolizas) return;
  const polizas = Array.isArray(state.catalogos.polizas)
    ? [...state.catalogos.polizas]
    : [];
  refs.listaPolizas.innerHTML = "";
  if (!polizas.length) {
    const vacio = document.createElement("li");
    vacio.className = "hint";
    vacio.textContent = "No hay pólizas registradas.";
    refs.listaPolizas.appendChild(vacio);
    return;
  }
  polizas.sort((a, b) =>
    obtenerNombrePoliza(a).localeCompare(obtenerNombrePoliza(b), "es", { sensitivity: "base" })
  );
  const fragment = document.createDocumentFragment();
  polizas.forEach((poliza) => {
    const item = document.createElement("li");
    item.className = "poliza-item";
    item.dataset.id = poliza.id ?? "";

    const header = document.createElement("header");
    const titulo = document.createElement("h4");
    titulo.className = "poliza-item-titulo";
    const nombre = obtenerNombrePoliza(poliza) || "(Sin nombre)";
    titulo.textContent = nombre;

    const acciones = document.createElement("div");
    acciones.className = "poliza-item-acciones";
    const btnEditar = document.createElement("button");
    btnEditar.type = "button";
    btnEditar.className = "btn secondary";
    btnEditar.dataset.action = "edit";
    btnEditar.dataset.id = poliza.id ?? "";
    btnEditar.textContent = "Editar";
    const btnEliminar = document.createElement("button");
    btnEliminar.type = "button";
    btnEliminar.className = "btn danger";
    btnEliminar.dataset.action = "delete";
    btnEliminar.dataset.id = poliza.id ?? "";
    btnEliminar.textContent = "Eliminar";
    acciones.append(btnEditar, btnEliminar);
    header.append(titulo, acciones);
    item.appendChild(header);

    const meta = document.createElement("div");
    meta.className = "poliza-item-meta";
    const numero = typeof poliza.numero === "string" ? poliza.numero.trim() : "";
    if (numero) {
      const p = document.createElement("p");
      p.textContent = `Número: ${numero}`;
      meta.appendChild(p);
    }
    const compania = typeof poliza.compania === "string"
      ? poliza.compania.trim()
      : typeof poliza.aseguradora === "string"
      ? poliza.aseguradora.trim()
      : "";
    if (compania) {
      const p = document.createElement("p");
      p.textContent = `Compañía: ${compania}`;
      meta.appendChild(p);
    }
    const telefono = typeof poliza.telefono === "string"
      ? poliza.telefono.trim()
      : typeof poliza.telefonoContacto === "string"
      ? poliza.telefonoContacto.trim()
      : "";
    if (telefono) {
      const p = document.createElement("p");
      p.textContent = `Teléfono: ${telefono}`;
      meta.appendChild(p);
    }
    const email = typeof poliza.email === "string"
      ? poliza.email.trim()
      : typeof poliza.correo === "string"
      ? poliza.correo.trim()
      : "";
    if (email) {
      const p = document.createElement("p");
      p.textContent = `Correo: ${email}`;
      meta.appendChild(p);
    }
    const notas = typeof poliza.notas === "string"
      ? poliza.notas.trim()
      : typeof poliza.observaciones === "string"
      ? poliza.observaciones.trim()
      : "";
    if (notas) {
      const p = document.createElement("p");
      p.textContent = notas;
      meta.appendChild(p);
    }
    if (meta.childElementCount > 0) {
      item.appendChild(meta);
    }
    fragment.appendChild(item);
  });
  refs.listaPolizas.appendChild(fragment);
}

async function handleAccionPoliza(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const accion = target.closest("[data-action]");
  if (!(accion instanceof HTMLElement)) return;
  const id = accion.dataset.id ?? "";
  if (!id) return;
  event.preventDefault();

  const tipo = accion.dataset.action;
  if (tipo === "edit") {
    const poliza = state.catalogos.polizas.find((item) => item.id === id);
    if (poliza) {
      prepararFormularioPoliza(poliza);
    }
    return;
  }

  if (tipo === "delete") {
    const confirmar = window.confirm("¿Eliminar esta póliza?");
    if (!confirmar) return;
    const boton = accion instanceof HTMLButtonElement ? accion : null;
    const textoOriginal = boton?.textContent ?? "";
    if (boton) {
      boton.disabled = true;
      boton.setAttribute("aria-busy", "true");
      boton.textContent = "Eliminando...";
    }
    try {
      await eliminarPoliza(id);
      showToast("Póliza eliminada", "success");
      if (state.polizaEditandoId === id) {
        prepararFormularioPoliza(null);
      }
      await recargarPolizas();
    } catch (error) {
      console.error(error);
      showToast("No se pudo eliminar la póliza", "error");
    } finally {
      if (boton) {
        boton.disabled = false;
        boton.removeAttribute("aria-busy");
        boton.textContent = textoOriginal || "Eliminar";
      }
    }
  }
}

function obtenerPolizaAsignadaEdificio(edificio) {
  if (!edificio) return "";
  const posibles = [edificio.defaultPolizaId, edificio.polizaId];
  for (const valor of posibles) {
    if (typeof valor === "string" && valor.trim()) {
      return valor.trim();
    }
  }
  return "";
}

function obtenerNombrePoliza(poliza) {
  if (!poliza) return "";
  const posibles = [poliza.nombre, poliza.numero, poliza.referencia, poliza.label];
  for (const valor of posibles) {
    if (typeof valor === "string" && valor.trim()) {
      return valor.trim();
    }
  }
  if (typeof poliza.id === "string" && poliza.id.trim()) {
    return poliza.id.trim();
  }
  return "";
}

function autoAsignarPolizaPorEdificio(options = {}) {
  if (!refs.formIncidencia) return;
  const { force = false, clear = false } = options;
  const edificioSelect = refs.formIncidencia.querySelector("#incidencia-edificio");
  const siniestroCheckbox = refs.formIncidencia.querySelector("#incidencia-siniestro");
  const polizaSelect = refs.formIncidencia.querySelector("#incidencia-poliza");
  if (
    !(edificioSelect instanceof HTMLSelectElement) ||
    !(siniestroCheckbox instanceof HTMLInputElement) ||
    !(polizaSelect instanceof HTMLSelectElement)
  ) {
    return;
  }
  const siniestroActivo = siniestroCheckbox.checked;
  const edificioId = edificioSelect.value.trim();
  const edificio = state.catalogos.edificios.find((item) => item.id === edificioId);
  const polizaPredeterminada = obtenerPolizaAsignadaEdificio(edificio);

  if (!siniestroActivo) {
    if (clear) {
      if (!polizaPredeterminada || polizaSelect.value === polizaPredeterminada) {
        polizaSelect.value = "";
      }
    }
    return;
  }

  if (!edificioId) {
    if (force) {
      polizaSelect.value = "";
    }
    return;
  }

  if (!polizaPredeterminada) {
    if (force) {
      polizaSelect.value = "";
    }
    return;
  }

  const opciones = Array.from(polizaSelect.options).map((option) => option.value);
  if (!opciones.includes(polizaPredeterminada)) {
    if (force) {
      polizaSelect.value = "";
    }
    return;
  }

  if (force || !polizaSelect.value) {
    polizaSelect.value = polizaPredeterminada;
  }
}

function obtenerNombreEdificio(edificio) {
  if (!edificio) return "";
  const posibles = [edificio.nombre, edificio.razonSocial, edificio.label];
  for (const valor of posibles) {
    if (typeof valor === "string" && valor.trim()) {
      return valor.trim();
    }
  }
  if (typeof edificio.id === "string" && edificio.id.trim()) {
    return edificio.id.trim();
  }
  return "";
}

function prepararModalReparadores() {
  prepararFormularioReparador(null);
  renderListadoReparadores();
  window.requestAnimationFrame(() => {
    const nombre = refs.formReparador?.querySelector("#reparador-nombre");
    if (nombre instanceof HTMLInputElement) {
      nombre.focus();
    }
  });
}

function prepararFormularioReparador(reparador) {
  if (!refs.formReparador) return;
  const esEdicion = Boolean(reparador && reparador.id);
  state.reparadorEditandoId = esEdicion ? String(reparador.id) : null;
  if (refs.formReparadorTitulo) {
    refs.formReparadorTitulo.textContent = esEdicion ? "Editar reparador" : "Añadir reparador";
  }
  if (refs.btnGuardarReparador instanceof HTMLButtonElement) {
    refs.btnGuardarReparador.textContent = esEdicion ? "Actualizar reparador" : "Guardar reparador";
  }
  refs.formReparador.dataset.mode = esEdicion ? "edit" : "create";
  if (refs.errorReparador) {
    refs.errorReparador.textContent = "";
  }
  refs.formReparador.reset();
  const idField = refs.formReparador.querySelector("#reparador-id");
  if (idField instanceof HTMLInputElement) {
    idField.value = esEdicion ? String(reparador.id) : "";
  }
  const asignar = (selector, valor) => {
    const field = refs.formReparador?.querySelector(selector);
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      field.value = valor ?? "";
    }
  };
  if (esEdicion && reparador) {
    asignar("#reparador-nombre", obtenerNombreReparador(reparador));
    asignar("#reparador-especialidad", reparador.especialidad ?? "");
    asignar("#reparador-telefono", reparador.telefono ?? reparador.contacto ?? "");
    asignar("#reparador-email", reparador.email ?? reparador.correo ?? "");
    asignar("#reparador-notas", reparador.notas ?? reparador.observaciones ?? "");
  }
  window.requestAnimationFrame(() => {
    const nombre = refs.formReparador?.querySelector("#reparador-nombre");
    if (nombre instanceof HTMLInputElement) {
      nombre.focus();
      if (esEdicion) {
        nombre.select();
      }
    }
  });
}

async function handleSubmitReparador(event) {
  event.preventDefault();
  if (!refs.formReparador) return;
  const datos = new FormData(refs.formReparador);
  const payload = {
    nombre: String(datos.get("nombre") ?? "").trim(),
    especialidad: String(datos.get("especialidad") ?? "").trim(),
    telefono: String(datos.get("telefono") ?? "").trim(),
    email: String(datos.get("email") ?? "").trim(),
    notas: String(datos.get("notas") ?? "").trim(),
  };
  if (!payload.nombre) {
    if (refs.errorReparador) {
      refs.errorReparador.textContent = "El nombre es obligatorio";
    }
    return;
  }
  if (refs.errorReparador) {
    refs.errorReparador.textContent = "";
  }
  const botonGuardar = refs.btnGuardarReparador;
  const textoOriginal = botonGuardar?.textContent ?? "";
  if (botonGuardar instanceof HTMLButtonElement) {
    botonGuardar.disabled = true;
    botonGuardar.setAttribute("aria-busy", "true");
    botonGuardar.textContent = state.reparadorEditandoId ? "Actualizando..." : "Guardando...";
  }
  let exito = false;
  try {
    if (state.reparadorEditandoId) {
      await actualizarReparador(state.reparadorEditandoId, payload);
      showToast("Reparador actualizado", "success");
    } else {
      await crearReparador(payload);
      showToast("Reparador creado", "success");
    }
    exito = true;
    await recargarReparadores();
    prepararFormularioReparador(null);
  } catch (error) {
    console.error(error);
    if (refs.errorReparador) {
      refs.errorReparador.textContent = traducirError(error);
    }
  } finally {
    if (botonGuardar instanceof HTMLButtonElement) {
      botonGuardar.disabled = false;
      botonGuardar.removeAttribute("aria-busy");
      if (!exito) {
        botonGuardar.textContent = textoOriginal || (state.reparadorEditandoId ? "Actualizar reparador" : "Guardar reparador");
      }
    }
  }
}

async function recargarReparadores() {
  try {
    const reparadores = await obtenerCatalogo("reparadores");
    state.catalogos = { ...state.catalogos, reparadores };
    actualizarSelectsReparador(reparadores);
    renderListadoReparadores();
    refrescarUI();
  } catch (error) {
    console.error("No se pudieron cargar los reparadores", error);
    showToast("No se pudieron cargar los reparadores", "error");
  }
}

function actualizarSelectsReparador(reparadores) {
  const selectIncidencia = /** @type {HTMLSelectElement | null} */ (
    document.getElementById("incidencia-reparador")
  );
  if (selectIncidencia) {
    const valorActual = selectIncidencia.value;
    poblarSelect(selectIncidencia, reparadores, "Selecciona un reparador");
    selectIncidencia.value = valorActual;
  }
  const selectFiltro = /** @type {HTMLSelectElement | null} */ (
    document.getElementById("filtro-reparador")
  );
  if (selectFiltro) {
    const valorFiltro = selectFiltro.value;
    poblarSelect(selectFiltro, reparadores, "Todos");
    selectFiltro.value = valorFiltro;
  }
}

function renderListadoReparadores() {
  if (!refs.listaReparadores) return;
  const reparadores = Array.isArray(state.catalogos.reparadores)
    ? [...state.catalogos.reparadores]
    : [];
  refs.listaReparadores.innerHTML = "";
  if (!reparadores.length) {
    const vacio = document.createElement("li");
    vacio.className = "hint";
    vacio.textContent = "No hay reparadores registrados.";
    refs.listaReparadores.appendChild(vacio);
    return;
  }
  reparadores.sort((a, b) =>
    obtenerNombreReparador(a).localeCompare(obtenerNombreReparador(b), "es", { sensitivity: "base" })
  );
  const fragment = document.createDocumentFragment();
  reparadores.forEach((reparador) => {
    const item = document.createElement("li");
    item.className = "reparador-item";
    item.dataset.id = reparador.id ?? "";

    const header = document.createElement("header");
    const titulo = document.createElement("h4");
    titulo.className = "reparador-item-titulo";
    const nombre = obtenerNombreReparador(reparador) || "(Sin nombre)";
    titulo.textContent = nombre;

    const acciones = document.createElement("div");
    acciones.className = "reparador-item-acciones";
    const btnEditar = document.createElement("button");
    btnEditar.type = "button";
    btnEditar.className = "btn secondary";
    btnEditar.dataset.action = "edit";
    btnEditar.dataset.id = reparador.id ?? "";
    btnEditar.textContent = "Editar";
    const btnEliminar = document.createElement("button");
    btnEliminar.type = "button";
    btnEliminar.className = "btn danger";
    btnEliminar.dataset.action = "delete";
    btnEliminar.dataset.id = reparador.id ?? "";
    btnEliminar.textContent = "Eliminar";
    acciones.append(btnEditar, btnEliminar);
    header.append(titulo, acciones);
    item.appendChild(header);

    const meta = document.createElement("div");
    meta.className = "reparador-item-meta";
    const especialidad =
      typeof reparador.especialidad === "string" ? reparador.especialidad.trim() : "";
    if (especialidad) {
      const p = document.createElement("p");
      p.textContent = `Especialidad: ${especialidad}`;
      meta.appendChild(p);
    }
    const telefono =
      typeof reparador.telefono === "string"
        ? reparador.telefono.trim()
        : typeof reparador.contacto === "string"
        ? reparador.contacto.trim()
        : "";
    if (telefono) {
      const p = document.createElement("p");
      p.textContent = `Teléfono: ${telefono}`;
      meta.appendChild(p);
    }
    const email =
      typeof reparador.email === "string"
        ? reparador.email.trim()
        : typeof reparador.correo === "string"
        ? reparador.correo.trim()
        : "";
    if (email) {
      const p = document.createElement("p");
      p.textContent = `Correo: ${email}`;
      meta.appendChild(p);
    }
    const notas =
      typeof reparador.notas === "string"
        ? reparador.notas.trim()
        : typeof reparador.observaciones === "string"
        ? reparador.observaciones.trim()
        : "";
    if (notas) {
      const p = document.createElement("p");
      p.textContent = notas;
      meta.appendChild(p);
    }
    if (meta.childElementCount > 0) {
      item.appendChild(meta);
    }
    fragment.appendChild(item);
  });
  refs.listaReparadores.appendChild(fragment);
}

async function handleAccionReparador(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const accion = target.closest("[data-action]");
  if (!(accion instanceof HTMLElement)) return;
  const id = accion.dataset.id ?? "";
  if (!id) return;
  event.preventDefault();

  const tipo = accion.dataset.action;
  if (tipo === "edit") {
    const reparador = state.catalogos.reparadores.find((item) => item.id === id);
    if (reparador) {
      prepararFormularioReparador(reparador);
    }
    return;
  }

  if (tipo === "delete") {
    const confirmar = window.confirm("¿Eliminar este reparador?");
    if (!confirmar) return;
    const boton = accion instanceof HTMLButtonElement ? accion : null;
    const textoOriginal = boton?.textContent ?? "";
    if (boton) {
      boton.disabled = true;
      boton.setAttribute("aria-busy", "true");
      boton.textContent = "Eliminando...";
    }
    try {
      await eliminarReparador(id);
      showToast("Reparador eliminado", "success");
      if (state.reparadorEditandoId === id) {
        prepararFormularioReparador(null);
      }
      await recargarReparadores();
    } catch (error) {
      console.error(error);
      showToast("No se pudo eliminar el reparador", "error");
    } finally {
      if (boton) {
        boton.disabled = false;
        boton.removeAttribute("aria-busy");
        boton.textContent = textoOriginal || "Eliminar";
      }
    }
  }
}

function obtenerNombreReparador(reparador) {
  if (!reparador) return "";
  const posibles = [reparador.nombre, reparador.razonSocial, reparador.label];
  for (const valor of posibles) {
    if (typeof valor === "string" && valor.trim()) {
      return valor.trim();
    }
  }
  if (typeof reparador.id === "string" && reparador.id.trim()) {
    return reparador.id.trim();
  }
  return "";
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
    edificioNombre: obtenerNombreEdificio(edificio) || incidencia.edificioId || "",
    reparadorNombre: obtenerNombreReparador(reparador) || incidencia.reparadorId || "",
    polizaNombre: poliza?.nombre ?? poliza?.referencia ?? incidencia.polizaId ?? "",
  };
}

function construirFiltrosDesdeFormulario(data) {
  return {
    edificioId: data.get("edificioId") ? String(data.get("edificioId")) : "",
    prioridad: data.get("prioridad") ? String(data.get("prioridad")) : "",
    estado: data.get("estado") ? String(data.get("estado")) : "",
    reparadorId: data.get("reparadorId") ? String(data.get("reparadorId")) : "",
    desde: data.get("desde") ? String(data.get("desde")) : "",
    hasta: data.get("hasta") ? String(data.get("hasta")) : "",
    etiquetas: parseTags(String(data.get("etiquetas") ?? "")),
    soloSiniestros: data.get("soloSiniestros") === "on",
  };
}

function normalizarFiltros(criterios = {}) {
  const etiquetas = Array.isArray(criterios.etiquetas)
    ? criterios.etiquetas
    : parseTags(String(criterios.etiquetas ?? ""));
  return {
    edificioId: criterios.edificioId ?? "",
    prioridad: criterios.prioridad ?? "",
    estado: criterios.estado ?? "",
    reparadorId: criterios.reparadorId ?? "",
    desde: criterios.desde ?? "",
    hasta: criterios.hasta ?? "",
    etiquetas,
    soloSiniestros: Boolean(criterios.soloSiniestros),
    busqueda: criterios.busqueda ?? "",
  };
}

async function cargarFiltrosGuardados() {
  if (!state.user) {
    state.filtrosGuardados = [];
    renderFiltrosRapidos(refs.filtrosRapidos, [], state.filtroActivoId);
    return;
  }
  try {
    const filtros = await obtenerFiltrosGuardados(state.user.uid);
    state.filtrosGuardados = filtros.map((item) => ({
      id: item.id,
      nombre: item.nombre ?? "Sin nombre",
      criterios: normalizarFiltros(item.criterios ?? {}),
    }));
    renderFiltrosRapidos(refs.filtrosRapidos, state.filtrosGuardados, state.filtroActivoId);
  } catch (error) {
    console.error("No se pudieron cargar los filtros guardados", error);
  }
}

function aplicarFiltroGuardado(filtro) {
  const criterios = normalizarFiltros(filtro.criterios ?? {});
  state.filtros = criterios;
  state.filtroActivoId = filtro.id;
  sincronizarFormularioFiltros(criterios);
  refrescarUI();
  showToast(`Filtro "${filtro.nombre}" aplicado`, "success");
}

function sincronizarFormularioFiltros(filtros) {
  if (refs.busquedaInput) {
    refs.busquedaInput.value = filtros.busqueda ?? "";
  }
  if (!refs.formFiltros) return;
  const assign = (selector, value) => {
    const field = refs.formFiltros?.querySelector(selector);
    if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
      field.value = value ?? "";
    }
  };
  assign("[name=\"edificioId\"]", filtros.edificioId ?? "");
  assign("[name=\"prioridad\"]", filtros.prioridad ?? "");
  assign("[name=\"estado\"]", filtros.estado ?? "");
  assign("[name=\"reparadorId\"]", filtros.reparadorId ?? "");
  assign("[name=\"desde\"]", filtros.desde ?? "");
  assign("[name=\"hasta\"]", filtros.hasta ?? "");
  const etiquetasInput = refs.formFiltros.querySelector("#filtro-etiquetas");
  if (etiquetasInput instanceof HTMLInputElement) {
    etiquetasInput.value = Array.isArray(filtros.etiquetas)
      ? filtros.etiquetas.join(", ")
      : String(filtros.etiquetas ?? "");
  }
  const soloSiniestros = refs.formFiltros.querySelector("#filtro-solo-siniestros");
  if (soloSiniestros instanceof HTMLInputElement) {
    soloSiniestros.checked = Boolean(filtros.soloSiniestros);
  }
}

async function prepararDetalleExtra(incidencia, options = {}) {
  if (!incidencia) return;
  const { force = false } = options;
  if (!force && state.detalleActualId === incidencia.id && state.detalle.comunicaciones.length) {
    return;
  }
  state.detalleActualId = incidencia.id;
  try {
    const comunicaciones = await obtenerComunicaciones(incidencia.id);
    state.detalle.comunicaciones = comunicaciones;
    if (state.seleccion && state.seleccion.id === incidencia.id) {
      renderDetalle(enriquecerIncidencia(state.seleccion), state.detalle);
    }
  } catch (error) {
    console.error("No se pudieron cargar las comunicaciones", error);
  }
}

function actualizarResumenFiltrosImpresion(filtros = {}) {
  if (!refs.printResumen) return;
  const container = refs.printResumen;
  container.innerHTML = "";

  const titulo = document.createElement("p");
  titulo.className = "print-resumen__titulo";
  titulo.textContent = "Incidencias";
  container.appendChild(titulo);

  const elementos = [];
  if (filtros.edificioId) {
    const edificio = state.catalogos.edificios.find((item) => item.id === filtros.edificioId);
    const nombreEdificio = obtenerNombreEdificio(edificio) || filtros.edificioId;
    elementos.push(`Edificio = ${nombreEdificio}`);
  }
  if (filtros.reparadorId) {
    const reparador = state.catalogos.reparadores.find((item) => item.id === filtros.reparadorId);
    const nombreReparador = obtenerNombreReparador(reparador) || filtros.reparadorId;
    elementos.push(`Reparador = ${nombreReparador}`);
  }
  if (filtros.prioridad) {
    const prioridadLabel = PRIORIDAD_LABELS[filtros.prioridad] ?? filtros.prioridad;
    elementos.push(`Prioridad = ${prioridadLabel}`);
  }
  if (filtros.estado) {
    const estadoLabel = ESTADO_LABELS[filtros.estado] ?? filtros.estado;
    elementos.push(`Estado = ${estadoLabel}`);
  }
  if (filtros.busqueda) {
    elementos.push(`Búsqueda = ${filtros.busqueda}`);
  }
  const etiquetas = Array.isArray(filtros.etiquetas)
    ? filtros.etiquetas
    : typeof filtros.etiquetas === "string"
    ? filtros.etiquetas
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];
  if (etiquetas.length) {
    elementos.push(`Etiquetas = ${etiquetas.join(", ")}`);
  }
  if (filtros.soloSiniestros) {
    elementos.push("Solo siniestros");
  }

  const fechaDesde = filtros.desde ? formatDate(filtros.desde) : "";
  const fechaHasta = filtros.hasta ? formatDate(filtros.hasta) : "";

  if (elementos.length) {
    const lista = document.createElement("ul");
    lista.className = "print-resumen__lista";
    elementos.forEach((texto) => {
      const li = document.createElement("li");
      li.textContent = texto;
      lista.appendChild(li);
    });
    container.appendChild(lista);
  }

  if (fechaDesde || fechaHasta) {
    const rango = document.createElement("p");
    rango.className = "print-resumen__rango";
    if (fechaDesde && fechaHasta) {
      rango.textContent = `Desde ${fechaDesde} a ${fechaHasta}`;
    } else if (fechaDesde) {
      rango.textContent = `Desde ${fechaDesde}`;
    } else {
      rango.textContent = `Hasta ${fechaHasta}`;
    }
    container.appendChild(rango);
  }

  if (!elementos.length && !(fechaDesde || fechaHasta)) {
    const sinFiltros = document.createElement("p");
    sinFiltros.className = "print-resumen__texto";
    sinFiltros.textContent = "Sin filtros aplicados.";
    container.appendChild(sinFiltros);
  }
}

function renderDetalleImpresion(incidencia, comunicaciones = []) {
  if (!refs.printDetalle) return;
  refs.printDetalle.innerHTML = "";
  if (!incidencia) return;

  const wrapper = document.createElement("div");
  wrapper.className = "print-detalle__wrapper";

  const titulo = document.createElement("h2");
  titulo.className = "print-detalle__titulo";
  titulo.textContent = incidencia.titulo?.trim() || "(Sin título)";
  wrapper.appendChild(titulo);

  const metaPartes = [];
  if (incidencia.id) {
    metaPartes.push(`ID: ${incidencia.id}`);
  }
  const fechaAlta = incidencia.fechaCreacion ? formatDate(incidencia.fechaCreacion) : "";
  if (fechaAlta) {
    metaPartes.push(`Creada: ${fechaAlta}`);
  }
  if (metaPartes.length) {
    const meta = document.createElement("p");
    meta.className = "print-detalle__meta";
    meta.textContent = metaPartes.join(" · ");
    wrapper.appendChild(meta);
  }

  const descripcionTexto = incidencia.descripcion?.trim();
  const descripcionSeccion = document.createElement("section");
  descripcionSeccion.className = "print-detalle__descripcion";
  const descripcionTitulo = document.createElement("h3");
  descripcionTitulo.textContent = "Descripción";
  const descripcionParrafo = document.createElement("p");
  descripcionParrafo.textContent = descripcionTexto || "Sin descripción.";
  descripcionSeccion.append(descripcionTitulo, descripcionParrafo);
  wrapper.appendChild(descripcionSeccion);

  const datos = document.createElement("dl");
  datos.className = "print-detalle__datos";

  const appendDato = (etiqueta, valor) => {
    const dt = document.createElement("dt");
    dt.textContent = etiqueta;
    const dd = document.createElement("dd");
    dd.textContent = valor || "—";
    datos.append(dt, dd);
  };

  appendDato("Edificio", incidencia.edificioNombre || incidencia.edificioId || "—");
  appendDato("Asignado / Seguro", obtenerTextoAsignacion(incidencia));
  const estadoLabel = ESTADO_LABELS[incidencia.estado] ?? incidencia.estado ?? "—";
  appendDato("Estado", estadoLabel);
  const prioridadLabel = PRIORIDAD_LABELS[incidencia.prioridad] ?? incidencia.prioridad ?? "—";
  appendDato("Prioridad", prioridadLabel);
  appendDato("Fecha de alta", fechaAlta || "—");
  const fechaLimite = incidencia.fechaLimite ? formatDate(incidencia.fechaLimite) : "";
  appendDato("Fecha límite", fechaLimite || "—");
  const fechaCierre = incidencia.fechaCierre ? formatDate(incidencia.fechaCierre) : "";
  if (fechaCierre) {
    appendDato("Fecha de cierre", fechaCierre);
  }
  appendDato("Siniestro", incidencia.esSiniestro ? "Sí" : "No");
  if (incidencia.esSiniestro) {
    appendDato("Compañía", incidencia.polizaNombre || incidencia.polizaId || "—");
    if (incidencia.referenciaSiniestro) {
      appendDato("Nº siniestro", incidencia.referenciaSiniestro);
    }
  } else if (incidencia.reparadorNombre) {
    appendDato("Reparador", incidencia.reparadorNombre);
  }
  const etiquetasIncidencia = Array.isArray(incidencia.etiquetas) ? incidencia.etiquetas : [];
  if (etiquetasIncidencia.length) {
    appendDato("Etiquetas", etiquetasIncidencia.join(", "));
  }
  const archivos = Array.isArray(incidencia.archivos) ? incidencia.archivos : [];
  if (archivos.length) {
    const nombres = archivos.map((archivo) => archivo.nombre ?? archivo.path ?? "Archivo");
    appendDato("Archivos", nombres.join(", "));
  } else {
    appendDato("Archivos", "—");
  }

  wrapper.appendChild(datos);

  const historial = document.createElement("section");
  historial.className = "print-detalle__historial";
  const historialTitulo = document.createElement("h3");
  historialTitulo.textContent = "Historial de anotaciones";
  historial.appendChild(historialTitulo);
  const lista = document.createElement("ul");
  lista.className = "print-detalle__historial-lista";
  if (!comunicaciones.length) {
    const vacio = document.createElement("li");
    vacio.className = "print-detalle__historial-item--vacio";
    vacio.textContent = "Sin registros de comunicación.";
    lista.appendChild(vacio);
  } else {
    comunicaciones.forEach((item) => {
      const li = document.createElement("li");
      li.className = "print-detalle__historial-item";
      const tipo = document.createElement("span");
      tipo.className = "print-detalle__historial-tipo";
      tipo.textContent = (item.tipo ?? "nota").toUpperCase();
      const mensaje = document.createElement("p");
      mensaje.className = "print-detalle__historial-mensaje";
      mensaje.textContent = item.mensaje ?? "";
      const meta = document.createElement("span");
      meta.className = "print-detalle__historial-meta";
      const autor = item.autor ?? "Equipo";
      const fecha = item.fecha ? formatDate(item.fecha) : "";
      meta.textContent = fecha ? `${autor} · ${fecha}` : autor;
      li.append(tipo, mensaje, meta);
      lista.appendChild(li);
    });
  }
  historial.appendChild(lista);
  wrapper.appendChild(historial);

  refs.printDetalle.appendChild(wrapper);
}

function obtenerTextoAsignacion(incidencia) {
  if (!incidencia) return "—";
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
  return incidencia.reparadorNombre?.trim() || "Sin asignar";
}

function gestionarRecordatorios(incidencias) {
  const ahora = new Date();
  const limite = new Date(ahora.getTime() + 48 * 60 * 60 * 1000);
  incidencias.forEach((incidencia) => {
    if (!incidencia?.id || !incidencia.fechaLimite || incidencia.estado === "cerrada") return;
    const fecha = new Date(incidencia.fechaLimite);
    if (Number.isNaN(fecha.getTime())) return;
    if (fecha >= ahora && fecha <= limite && !recordatoriosMostrados.has(incidencia.id)) {
      recordatoriosMostrados.add(incidencia.id);
      const fechaTexto = formatDate(incidencia.fechaLimite) || fecha.toLocaleDateString();
      showToast(`Recordatorio: "${incidencia.titulo ?? "Incidencia"}" vence el ${fechaTexto}.`, "success");
    }
  });
}
