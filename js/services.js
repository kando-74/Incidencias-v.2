import { firebaseConfig } from "../firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  listAll,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { mapIncidenciaDoc } from "./utils.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage, onAuthStateChanged, signInWithEmailAndPassword, signOut };

/**
 * Suscribe a los cambios de incidencias.
 * @param {(incidencias: any[]) => void} callback
 * @returns {import("firebase/firestore").Unsubscribe}
 */
export function suscribirIncidencias(callback) {
  const q = query(collection(db, "incidencias"), orderBy("fechaCreacion", "desc"));
  return onSnapshot(
    q,
    (snapshot) => {
      const incidencias = snapshot.docs.map(mapIncidenciaDoc);
      callback(incidencias);
    },
    (error) => {
      console.error("Error en suscripción de incidencias", error);
    }
  );
}

/**
 * Crea o actualiza una incidencia.
 * @param {Record<string, any>} incidencia
 */
export async function guardarIncidencia(incidencia) {
  const { id, ...resto } = incidencia;
  const base = {
    ...resto,
    fechaActualizacion: serverTimestamp(),
  };
  if (!incidencia.titulo) {
    throw new Error("El título es obligatorio");
  }
  try {
    if (id) {
      const refDoc = doc(db, "incidencias", id);
      await updateDoc(refDoc, base);
      return id;
    }
    const nueva = {
      ...base,
      fechaCreacion: serverTimestamp(),
    };
    const docRef = await addDoc(collection(db, "incidencias"), nueva);
    return docRef.id;
  } catch (error) {
    console.error("No se pudo guardar la incidencia", error);
    throw error;
  }
}

/**
 * Actualiza el estado de una incidencia.
 * @param {string} id
 * @param {string} estado
 */
export async function actualizarEstadoIncidencia(id, estado) {
  try {
    const refDoc = doc(db, "incidencias", id);
    await updateDoc(refDoc, {
      estado,
      fechaActualizacion: serverTimestamp(),
      fechaCierre: estado === "cerrada" ? serverTimestamp() : null,
    });
  } catch (error) {
    console.error("No se pudo actualizar el estado", error);
    throw error;
  }
}

/**
 * Obtiene un catálogo plano de una colección.
 * @param {"edificios" | "reparadores" | "polizas_seguros"} nombre
 */
export async function obtenerCatalogo(nombre) {
  try {
    const snapshot = await getDocs(collection(db, nombre));
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error(`No se pudo obtener catálogo ${nombre}`, error);
    throw error;
  }
}

/**
 * Actualiza el listado de archivos almacenado en la incidencia.
 * @param {string} incidenciaId
 * @param {Array<Record<string, any>>} archivos
 */
export async function actualizarArchivosIncidencia(incidenciaId, archivos) {
  try {
    const refDoc = doc(db, "incidencias", incidenciaId);
    await updateDoc(refDoc, {
      archivos,
      fechaActualizacion: serverTimestamp(),
    });
  } catch (error) {
    console.error("No se pudieron actualizar los archivos", error);
    throw error;
  }
}

/**
 * Sube archivos a Storage bajo la incidencia indicada.
 * @param {string} incidenciaId
 * @param {FileList | File[]} archivos
 */
export async function subirArchivosIncidencia(incidenciaId, archivos) {
  const files = Array.from(archivos ?? []);
  const resultados = [];
  for (const file of files) {
    const path = `incidencias/${incidenciaId}/${Date.now()}-${file.name}`;
    const referencia = ref(storage, path);
    try {
      const snapshot = await uploadBytes(referencia, file);
      const url = await getDownloadURL(snapshot.ref);
      resultados.push({ nombre: file.name, url, path });
    } catch (error) {
      console.error("No se pudo subir el archivo", error);
      throw error;
    }
  }
  return resultados;
}

/**
 * Recupera los archivos de una incidencia.
 * @param {string} incidenciaId
 */
export async function obtenerArchivosIncidencia(incidenciaId) {
  try {
    const carpeta = ref(storage, `incidencias/${incidenciaId}`);
    const listado = await listAll(carpeta);
    const archivos = await Promise.all(
      listado.items.map(async (itemRef) => {
        const url = await getDownloadURL(itemRef);
        return { nombre: itemRef.name, url, path: itemRef.fullPath };
      })
    );
    return archivos;
  } catch (error) {
    console.error("No se pudieron obtener los archivos", error);
    throw error;
  }
}

export async function eliminarArchivoStorage(path) {
  try {
    const archivoRef = ref(storage, path);
    await deleteObject(archivoRef);
  } catch (error) {
    console.error("No se pudo eliminar el archivo", error);
    throw error;
  }
}

export async function eliminarIncidencia(id) {
  try {
    const refDoc = doc(db, "incidencias", id);
    await deleteDoc(refDoc);
    const carpeta = ref(storage, `incidencias/${id}`);
    try {
      const listado = await listAll(carpeta);
      await Promise.all(listado.items.map((item) => deleteObject(item)));
    } catch (errorStorage) {
      if (typeof errorStorage !== "object" || !errorStorage || !("code" in errorStorage)) {
        throw errorStorage;
      }
      const codigo = /** @type {{ code?: string }} */ (errorStorage).code;
      if (codigo !== "storage/object-not-found") {
        throw errorStorage;
      }
    }
  } catch (error) {
    console.error("No se pudo eliminar la incidencia", error);
    throw error;
  }
}
