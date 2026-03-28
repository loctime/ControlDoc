// src/utils/FileUploadService.js
import { getAuth } from "firebase/auth";
import { uploadToControlFile, buildControlFilePath, deleteFromControlFile } from './ControlFileStorage';
import { getCurrentTenantId } from './tenantUtils';

const MAX_SIZE_MB = 400;
const MAX_SIZE = MAX_SIZE_MB * 1024 * 1024;

export const validateFile = (file) => {
  if (!file) throw new Error('No se seleccionó ningún archivo');
  if (file.size > MAX_SIZE) {
    throw new Error(`El archivo supera el límite de ${MAX_SIZE_MB}MB (máximo permitido por backup)`);
  }
  return Promise.resolve();
};

/**
 * Sube un archivo a ControlFile y registra el documento en el backend de ControlDoc.
 * @param {File} file
 * @param {string} folder  - ej. "empresas/abc123", "admin/folders/logos"
 * @param {Object} metadata
 * @param {{ onProgress?: (pct: number) => void }} [options]
 * @returns {Promise<{ fileId, fileName, docId }>}
 */
export const uploadFile = async (file, folder, metadata = {}, options = {}) => {
  await validateFile(file);

  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Debe iniciar sesión para subir archivos");

  const tenantId = getCurrentTenantId() || 'default';
  const path = buildControlFilePath(folder, tenantId);

  // Paso 1-3: Subir a ControlFile (presign → PUT → confirm)
  const { fileId, fileName } = await uploadToControlFile(file, path, {
    onProgress: options.onProgress,
  });

  // Paso 4: Registrar metadata en ControlDoc backend (Firestore, versionado)
  const cleanMetadata = Object.fromEntries(
    Object.entries(metadata).filter(([, v]) => v !== undefined)
  );

  const token = await user.getIdToken();
  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/register-document`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileId,
      fileName,
      fileType: file.type || '',
      fileSize: file.size,
      folder,
      metadata: cleanMetadata,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error registrando documento en el servidor');
  }

  const result = await response.json();
  // Retornar shape compatible con código existente que espera url/fileURL/docId
  return {
    fileId,
    fileName,
    docId: result.docId,
    // Aliases de compatibilidad (componentes que lean .url o .fileURL recibirán null/undefined
    // y deben usar fileId + useFileUrl para obtener la URL temporal)
    url: null,
    fileURL: null,
  };
};

/**
 * Elimina un archivo.
 * - Si tiene fileId (ControlFile): lo elimina vía ControlFile API.
 * - Si solo tiene fileURL (legacy Backblaze): llama al endpoint legacy /api/delete.
 *
 * @param {{ fileId?: string, fileURL?: string }} params
 */
export const deleteFile = async ({ fileId, fileURL } = {}) => {
  if (fileId) {
    await deleteFromControlFile(fileId);
    return true;
  }

  if (fileURL) {
    // Ruta legacy para archivos ya existentes en Backblaze
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) throw new Error("Debe iniciar sesión para eliminar archivos");

    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/delete`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await user.getIdToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileURL }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error al eliminar archivo: ${errorText}`);
    }
    return true;
  }

  throw new Error('deleteFile requiere fileId o fileURL');
};

/**
 * @deprecated Usar deleteFile({ fileURL }) en su lugar.
 * Alias de compatibilidad para código existente.
 */
export const deleteFileByURL = async (fileURL) => {
  return deleteFile({ fileURL });
};
