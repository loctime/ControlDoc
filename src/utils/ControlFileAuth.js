// Autenticación secundaria para ControlFile (no interfiere con la app principal)
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';

const CF_CONFIG = {
  apiKey: import.meta.env.VITE_CONTROLFILE_API_KEY,
  authDomain: import.meta.env.VITE_CONTROLFILE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_CONTROLFILE_PROJECT_ID,
  appId: import.meta.env.VITE_CONTROLFILE_APP_ID,
};

let cachedApp; 
let cachedAuth;

function assertConfigPresent() {
  const missing = Object.entries(CF_CONFIG)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(`Faltan variables de entorno de ControlFile: ${missing.join(', ')}`);
  }
}

export function getControlFileFirebaseApp() {
  if (cachedApp) return cachedApp;
  assertConfigPresent();
  // Reusar app si ya fue inicializada (ej: por firebaseconfig.js)
  const existing = getApps().find(app => app.name === 'controlfile');
  cachedApp = existing || initializeApp(CF_CONFIG, 'controlfile');
  return cachedApp;
}

export function getControlFileAuth() {
  if (cachedAuth) return cachedAuth;
  const app = getControlFileFirebaseApp();
  cachedAuth = getAuth(app);
  // Persistencia local para mantener la sesión entre recargas de página
  setPersistence(cachedAuth, browserLocalPersistence);
  return cachedAuth;
}

export async function connectControlFileWithGoogle() {
  const auth = getControlFileAuth();
  const provider = new GoogleAuthProvider();
  
  try {
    // Intentar popup primero
    await signInWithPopup(auth, provider);
    return auth.currentUser;
  } catch (error) {
    // Si falla popup (bloqueado), usar redirect
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
      console.log('Popup bloqueado, usando redirect...');
      await signInWithRedirect(auth, provider);
      // El redirect manejará la autenticación, no return aquí
      return null;
    }
    throw error; // Re-lanzar otros errores
  }
}

export async function handleRedirectResult() {
  const auth = getControlFileAuth();
  try {
    const result = await getRedirectResult(auth);
    return result?.user || null;
  } catch (error) {
    console.error('Error en redirect result:', error);
    throw error;
  }
}

export async function getControlFileIdToken(forceRefresh = false) {
  const auth = getControlFileAuth();
  if (!auth.currentUser) throw new Error('No conectado a ControlFile');
  return auth.currentUser.getIdToken(forceRefresh);
}

export function getControlFileUser() {
  const auth = getControlFileAuth();
  return auth.currentUser;
}

export async function disconnectControlFile() {
  const auth = getControlFileAuth();
  await auth.signOut();
}


