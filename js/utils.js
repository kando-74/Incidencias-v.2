// Utilidades comunes para fechas, CSV y helpers generales

/**
 * Convierte una marca de tiempo de Firestore o ISO en una cadena local.
 * @param {import("firebase/firestore").Timestamp | string | Date | null | undefined} value
 * @returns {string}
 */
export function formatDate(value) {
  if (!value) return "";
  try {
    if (typeof value === "string") {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString();
      }
    }
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }
    if (typeof value.toDate === "function") {
      return value.toDate().toLocaleDateString();
    }
  } catch (error) {
    console.error("No se pudo formatear la fecha", error);
  }
  return "";
}

/**
 * Normaliza un valor booleano.
 * @param {unknown} value
 * @returns {boolean}
 */
export function toBoolean(value) {
  return value === true || value === "true" || value === 1;
}

/**
 * Divide un texto por comas generando un array de etiquetas limpias.
 * @param {string} value
 * @returns {string[]}
 */
export function parseTags(value = "") {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/**
 * Genera un CSV con BOM para compatibilidad con Excel.
 * @param {string[]} headers
 * @param {Record<string, unknown>[]} rows
 * @returns {string}
 */
export function createCsvWithBom(headers, rows) {
  const csvRows = [headers.join(",")];
  for (const row of rows) {
    const values = headers.map((header) => {
      const cell = row[header] ?? "";
      const normalized = typeof cell === "string" ? cell : JSON.stringify(cell ?? "");
      const escaped = normalized.replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(","));
  }
  return "\ufeff" + csvRows.join("\n");
}

/**
 * Desencadena la descarga de un archivo de texto.
 * @param {string} filename
 * @param {string} content
 */
export function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

/**
 * Agrupa elementos por una clave.
 * @template T
 * @param {T[]} items
 * @param {(item: T) => string} keySelector
 * @returns {Record<string, T[]>}
 */
export function groupBy(items, keySelector) {
  return items.reduce((acc, item) => {
    const key = keySelector(item) || "otros";
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, /** @type {Record<string, T[]>} */ ({}));
}

/**
 * Ordena incidencias por prioridad y fecha límite.
 * @param {Array<{ prioridad?: string; fechaLimite?: string | Date }>} incidencias
 * @returns {typeof incidencias}
 */
export function sortIncidencias(incidencias) {
  const prioridadPeso = {
    critica: 0,
    alta: 1,
    media: 2,
    baja: 3,
  };
  return [...incidencias].sort((a, b) => {
    const pesoA = prioridadPeso[a.prioridad ?? "media"] ?? 2;
    const pesoB = prioridadPeso[b.prioridad ?? "media"] ?? 2;
    if (pesoA !== pesoB) {
      return pesoA - pesoB;
    }
    const fechaA = a.fechaLimite ? new Date(a.fechaLimite).getTime() : Infinity;
    const fechaB = b.fechaLimite ? new Date(b.fechaLimite).getTime() : Infinity;
    return fechaA - fechaB;
  });
}

/**
 * Crea un generador incremental simple.
 * @returns {() => number}
 */
export function createIdGenerator() {
  let counter = 0;
  return () => {
    counter += 1;
    return counter;
  };
}

/**
 * Normaliza etiquetas para mostrarlas.
 * @param {string[] | undefined} tags
 * @returns {string}
 */
export function stringifyTags(tags) {
  return (tags ?? []).join(", ");
}

/**
 * Convierte una incidencia Firestore a un objeto serializable.
 * @param {import("firebase/firestore").QueryDocumentSnapshot} doc
 */
export function mapIncidenciaDoc(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    fechaCreacion: data.fechaCreacion?.toDate?.().toISOString?.() ?? data.fechaCreacion ?? null,
    fechaCierre: data.fechaCierre?.toDate?.().toISOString?.() ?? data.fechaCierre ?? null,
    fechaLimite: data.fechaLimite?.toDate?.().toISOString?.() ?? data.fechaLimite ?? null,
  };
}

/**
 * Calcula un resumen de estados.
 * @param {Array<{ estado?: string }>} incidencias
 */
export function calcularResumen(incidencias) {
  return incidencias.reduce(
    (acc, incidencia) => {
      const estado = incidencia.estado ?? "abierta";
      acc.total += 1;
      if (estado === "abierta") acc.abiertas += 1;
      if (estado === "en_proceso") acc.enProceso += 1;
      if (estado === "cerrada") acc.cerradas += 1;
      return acc;
    },
    { total: 0, abiertas: 0, enProceso: 0, cerradas: 0 }
  );
}

/**
 * Devuelve true si la incidencia coincide con filtros.
 * @param {Record<string, any>} incidencia
 * @param {Record<string, any>} filtros
 */
export function filtrarIncidencia(incidencia, filtros) {
  if (filtros.busqueda) {
    const texto = `${incidencia.titulo ?? ""} ${incidencia.referenciaSiniestro ?? ""}`.toLowerCase();
    if (!texto.includes(filtros.busqueda.toLowerCase())) return false;
  }
  if (filtros.estado && incidencia.estado !== filtros.estado) return false;
  if (filtros.prioridad && incidencia.prioridad !== filtros.prioridad) return false;
  if (filtros.edificioId && incidencia.edificioId !== filtros.edificioId) return false;
  if (filtros.soloSiniestros && !toBoolean(incidencia.esSiniestro)) return false;
  if (filtros.etiquetas?.length) {
    const incidenciaEtiquetas = incidencia.etiquetas ?? [];
    const todasPresentes = filtros.etiquetas.every((tag) => incidenciaEtiquetas.includes(tag));
    if (!todasPresentes) return false;
  }
  if (filtros.desde) {
    const fecha = incidencia.fechaCreacion ? new Date(incidencia.fechaCreacion) : null;
    if (fecha && fecha < new Date(filtros.desde)) return false;
  }
  if (filtros.hasta) {
    const fecha = incidencia.fechaCreacion ? new Date(incidencia.fechaCreacion) : null;
    if (fecha && fecha > new Date(filtros.hasta)) return false;
  }
  return true;
}

/**
 * Limpia un formulario estableciendo valores por defecto.
 * @param {HTMLFormElement} form
 */
export function resetForm(form) {
  form.reset();
  form.querySelectorAll("[data-default]").forEach((el) => {
    const input = /** @type {HTMLInputElement} */ (el);
    input.value = input.dataset.default ?? "";
  });
}

/**
 * Devuelve una promesa que resuelve tras cierto tiempo.
 * @param {number} ms
 */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
