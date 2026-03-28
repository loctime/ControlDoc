// src/utils/ControlFileStorage.js
// Utilidad centralizada para operaciones de storage en ControlFile.
// Upload: presign → PUT → confirm
// Download: presign-get (URL temporal TTL 5 min)
// Delete: /api/files/delete

import { getControlFileIdToken, getControlFileUser } from './ControlFileAuth';

const getBaseUrl = () =>
  import.meta.env.VITE_CONTROLFILE_BACKEND_URL ||
  import.meta.env.VITE_API_URL ||
  'https://controlfile.onrender.com';

/**
 * Convierte el string de carpeta de ControlDoc a un path array de ControlFile.
 * @param {string} folder  - ej. "empresas/abc123", "admin/folders/logos"
 * @param {string} tenantId
 * @returns {string[]}
 */
export function buildControlFilePath(folder, tenantId) {
  const tenant = tenantId || 'default';

  if (!folder) return ['controldoc', tenant, 'archivos'];

  if (folder.startsWith('empresas/')) {
    const companyId = folder.replace('empresas/', '');
    return ['controldoc', tenant, 'empresas', companyId];
  }
  if (folder.startsWith('admin/folders/')) {
    const folderName = folder.replace('admin/folders/', '');
    return ['controldoc', tenant, 'admin', folderName];
  }
  if (folder === 'admin/document_examples') {
    return ['controldoc', tenant, 'ejemplos'];
  }
  if (folder === 'ocr') {
    return ['controldoc', tenant, 'ocr'];
  }
  if (folder.startsWith('admin/')) {
    return ['controldoc', tenant, 'admin', folder.replace('admin/', '')];
  }

  return ['controldoc', tenant, folder];
}

/**
 * Sube un archivo a ControlFile usando el flujo presign → PUT → confirm.
 * @param {File|Blob} file
 * @param {string[]} path  - array de carpetas, ej. ['controldoc', 'tenant1', 'empresas', 'abc']
 * @param {{ onProgress?: (pct: number) => void }} [options]
 * @returns {Promise<{ fileId: string, fileName: string, fileSize: number }>}
 */
export async function uploadToControlFile(file, path, options = {}) {
  const currentUser = getControlFileUser();
  if (!currentUser?.uid) {
    throw new Error('Debe conectarse a ControlFile primero. Vaya a su perfil para conectar.');
  }

  const token = await getControlFileIdToken();
  const baseUrl = getBaseUrl();
  const fileName = file.name || `archivo_${Date.now()}`;

  // Paso 1: Presign
  const presignRes = await fetch(`${baseUrl}/api/uploads/presign`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: fileName,
      size: file.size,
      mime: file.type || 'application/octet-stream',
      path,
      userId: currentUser.uid,
    }),
  });

  if (!presignRes.ok) {
    const msg = await presignRes.text();
    throw new Error(`Error en presign (${presignRes.status}): ${msg}`);
  }

  const presignData = await presignRes.json();

  // Paso 2: Upload directo al storage (con progress)
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (options.onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) options.onProgress(Math.round((e.loaded / e.total) * 100));
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload al storage falló con status ${xhr.status}`));
    });
    xhr.addEventListener('error', () => reject(new Error('Error de red al subir archivo')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelado')));

    xhr.open(presignData.method || 'PUT', presignData.uploadUrl);
    const headers = presignData.headers || {};
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.send(file);
  });

  // Paso 3: Confirm
  const confirmRes = await fetch(`${baseUrl}/api/uploads/confirm`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uploadSessionId: presignData.uploadSessionId,
      key: presignData.fileKey,
      size: file.size,
      mime: file.type || 'application/octet-stream',
      name: fileName,
      path,
      userId: currentUser.uid,
    }),
  });

  if (!confirmRes.ok) {
    const msg = await confirmRes.text();
    throw new Error(`Error en confirm (${confirmRes.status}): ${msg}`);
  }

  const confirmData = await confirmRes.json();

  if (!confirmData.fileId) {
    throw new Error('ControlFile no devolvió fileId en la confirmación');
  }

  return {
    fileId: confirmData.fileId,
    fileName,
    fileSize: file.size,
  };
}

/**
 * Obtiene una URL de descarga temporal (TTL: 5 minutos) para un fileId de ControlFile.
 * @param {string} fileId
 * @returns {Promise<string>} downloadUrl
 */
export async function getDownloadUrl(fileId) {
  if (!fileId) throw new Error('fileId requerido para obtener URL de descarga');

  const token = await getControlFileIdToken();
  const baseUrl = getBaseUrl();

  const res = await fetch(`${baseUrl}/api/files/presign-get`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileId }),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Error obteniendo URL de descarga (${res.status}): ${msg}`);
  }

  const data = await res.json();
  return data.downloadUrl || data.url;
}

/**
 * Elimina un archivo de ControlFile por su fileId.
 * @param {string} fileId
 * @returns {Promise<void>}
 */
export async function deleteFromControlFile(fileId) {
  if (!fileId) throw new Error('fileId requerido para eliminar');

  const token = await getControlFileIdToken();
  const baseUrl = getBaseUrl();

  const res = await fetch(`${baseUrl}/api/files/delete`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileId }),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Error eliminando archivo de ControlFile (${res.status}): ${msg}`);
  }
}
