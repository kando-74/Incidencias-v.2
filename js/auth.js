import {
  auth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "./services.js";

/**
 * Inicializa los observadores de autenticación.
 * @param {(user: import("firebase/auth").User | null) => void} callback
 */
export function initAuth(callback) {
  return onAuthStateChanged(auth, (user) => {
    callback(user);
  });
}

/**
 * Intenta iniciar sesión con email y contraseña.
 * @param {string} email
 * @param {string} password
 */
export async function login(email, password) {
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    return user;
  } catch (error) {
    console.error("No se pudo iniciar sesión", error);
    throw error;
  }
}

/**
 * Cierra la sesión actual.
 */
export async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("No se pudo cerrar sesión", error);
    throw error;
  }
}
