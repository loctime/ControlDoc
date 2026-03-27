// Cliente liviano para la API de ControlFile (folders y uploads)
import { getControlFileIdToken } from './ControlFileAuth';

const BASE_URL = import.meta.env.VITE_CONTROLFILE_BACKEND_URL || import.meta.env.VITE_APP_BACKEND_URL || 'https://controlfile.onrender.com';
const APP_DISPLAY_NAME = import.meta.env.VITE_CONTROLFILE_APP_DISPLAY_NAME || 'ControlDoc';

async function authFetch(path, options = {}) {
  const token = await getControlFileIdToken();
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Error ${res.status} ${path}: ${text}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

export async function getRootFolder() {
  return authFetch('/api/folders/root');
}

export async function createFolder({ name, parentId, icon, color, id }) {
  return authFetch('/api/folders/create', {
    method: 'POST',
    body: JSON.stringify({ name, parentId: parentId ?? null, icon, color, id }),
  });
}

export async function pinTaskbarFolder(folderId, label = APP_DISPLAY_NAME) {
  return authFetch('/api/user/taskbar', {
    method: 'POST',
    body: JSON.stringify({ items: [{ type: 'folder', id: folderId, label }] }),
  });
}

// Funciones obsoletas eliminadas:
// - getOrCreateAppFolder: Ya no se necesita, el SDK maneja carpetas automáticamente con paths
// - presignUpload con parentId: Reemplazado por SDK uploadFile con paths
// - saveFileToControlFile con parentId: Reemplazado por SDK uploadFile con paths
// - proxyUpload y confirmUploadSimple: Ahora manejados internamente por el SDK

export { BASE_URL, APP_DISPLAY_NAME };


