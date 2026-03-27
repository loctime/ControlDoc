// src/utils/FileUploadService.js
import { getAuth } from "firebase/auth";

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/svg+xml'];
const MAX_SIZE_MB = 400;
const MAX_SIZE = MAX_SIZE_MB * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 2000;

export const validateFile = (file) => {
  if (!file) throw new Error('No se seleccionó ningún archivo');
  if (file.size > MAX_SIZE) {
    throw new Error(`El archivo supera el límite de ${MAX_SIZE_MB}MB (máximo permitido por backup)`);
  }

  // Ya no validamos el tipo MIME ni dimensiones de imagen
  return Promise.resolve();
};

export const uploadFile = async (file, folder, metadata = {}) => {
  try {
    await validateFile(file);
    
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) throw new Error("Debe iniciar sesión para subir archivos");

    const formData = new FormData();
    formData.append("file", file, file.name);
    formData.append("folder", folder);
    
    // Filtrar metadata para evitar undefined
    const cleanMetadata = Object.fromEntries(
      Object.entries(metadata).filter(([_, v]) => v !== undefined)
    );
    formData.append("metadata", JSON.stringify(cleanMetadata));

    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/upload`, {
      method: "POST",
      headers: { 
        'Authorization': `Bearer ${await user.getIdToken()}` 
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Error en el servidor");
    }
    
    return await response.json();
  } catch (error) {
    console.error("[FileUpload] Error:", error);
    throw error;
  }
};
export const deleteFileByURL = async (fileURL) => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Debe iniciar sesión para eliminar archivos");

  // Log para depuración
  console.log('[deleteFileByURL] Intentando borrar:', fileURL);

  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/delete`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await user.getIdToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fileURL })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.warn(`[deleteFileByURL] Error al eliminar archivo:`, errorText);
    throw new Error(`Error al eliminar archivo: ${errorText}`);
  }

  console.log('[deleteFileByURL] Archivo eliminado exitosamente:', fileURL);
  return true;
};
