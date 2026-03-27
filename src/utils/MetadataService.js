//src/utils/MetadataService.js
import { addDoc, updateDoc, doc, collection, serverTimestamp, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../firebaseconfig";
import { cleanFirestoreData } from "./cleanFirestoreData";
import { getCompanyMainUserEmail } from "./getCompanyMainUserEmail";
import { getTenantCollectionPath } from "./tenantUtils";


// DECISIÓN: size se guarda siempre en bytes (entero) en todos los updates relevantes para mantener consistencia y evitar errores de presentación o cálculo.
// Marca archivos como backupeados en Firestore (obsoleta, usar marcarArchivosBackupConMetadata)
export const marcarArchivosComoBackupeados = async (files, backupFileName) => {
  const errors = [];
  for (const file of files) {
    if (!file.id) continue; // Necesita el ID del documento en Firestore
    try {
      // Usar la ruta multi-tenant correcta
      const documentosPath = getTenantCollectionPath('documentos');
      await updateDoc(doc(db, documentosPath, file.id), {
        backupFile: backupFileName,
        backupDate: new Date()
      });
    } catch (err) {
      errors.push({ id: file.id, error: err.message });
    }
  }
  return errors;
};

/**
 * Marca archivos con metadata de backup (generalBackup o selectedBackup) en requiredDocuments
 * @param {Object} params
 * @param {Array} params.files - Array de documentos (deben tener .id)
 * @param {"generalBackup"|"selectedBackup"} params.backupType
 * @param {string} params.backupURL - URL del ZIP generado
 * @param {string} params.backupId - ID generado del backup
 * @param {Object} params.user - Usuario que ejecuta el backup
 * Guarda:
 *   generalBackup: { uploadBy, createAt, backupURL, backupId }
 *   selectedBackup: { uploadBy, createAt, selectedBackupURL, selectedBackupId }
 */
export const marcarArchivosBackupConMetadata = async ({ files, backupType, backupURL, backupId, user }) => {
  console.log('[marcarArchivosBackupConMetadata] INICIO', { files, backupType, backupURL, backupId, user });
  const errors = [];
  for (const file of files) {
    const docId = file.id;
    console.log(`[marcarArchivosBackupConMetadata] Procesando archivo`, { docId, file });
    if (!docId) {
      console.warn('[marcarArchivosBackupConMetadata] FALTA file.id', file);
      errors.push({ id: null, error: 'Falta file.id' });
      continue;
    }

    try {
      let campoURL, campoId;
      if (backupType === 'generalBackup') {
        campoURL = 'backupURL';
        campoId = 'backupId';
      } else if (backupType === 'selectedBackup') {
        campoURL = 'selectedBackupURL';
        campoId = 'selectedBackupId';
      } else if (backupType === 'smartBackup') {
        campoURL = 'smartBackupURL';
        campoId = 'smartBackupId';
      } else {
        throw new Error(`Tipo de backup no soportado: ${backupType}`);
      }
      
      const updateData = {
        [backupType]: {
          uploadBy: user?.realemail || user?.email || '',
          createAt: new Date().toISOString(),
          [campoURL]: backupURL,
          [campoId]: backupId
        }
      };
      console.log(`[marcarArchivosBackupConMetadata] updateDoc(approvedDocuments/${docId})`, updateData);
      // Usar la ruta multi-tenant correcta
      const approvedDocumentsPath = getTenantCollectionPath('approvedDocuments');
      await updateDoc(doc(db, approvedDocumentsPath, docId), updateData);
      console.log(`[marcarArchivosBackupConMetadata] updateDoc OK para`, docId);
      await addDocumentLog(docId, "backup", user, `Documento incluido en backup (${backupType})`);
      console.log(`[marcarArchivosBackupConMetadata] addDocumentLog OK para`, docId);
    } catch (err) {
      console.error(`[marcarArchivosBackupConMetadata] ERROR para ${docId}:`, err);
      errors.push({ id: docId, error: err.message });
    }
  }
  console.log('[marcarArchivosBackupConMetadata] FIN. Errores:', errors);
  return errors;
};



// Helper para agregar un log a la subcolección 'logs'
const addDocumentLog = async (docId, type, user, description = '') => {
  if (!docId) {
    console.warn("No docId provided for logging.");
    return;
  }
  try {
    // Usar la ruta multi-tenant correcta
    const approvedDocumentsPath = getTenantCollectionPath('approvedDocuments');
    await addDoc(collection(db, `${approvedDocumentsPath}/${docId}/logs`), {
      type: type,
      fecha: new Date().toISOString(),
      user: {
        uid: user?.uid || "",
        email: user?.email || "",
      },
      description: description,
    });
  } catch (error) {
    console.error(`Error adding log for document ${docId}:`, error);
  }
};

/**
 * Crea un documento requerido con metadata inicial.
 */
export const createRequiredDocument = async ({ user, data, companyId }) => {
  // Buscar email principal de la empresa
  let companyEmail = await getCompanyMainUserEmail(companyId);
  if (!companyEmail) companyEmail = user?.email || "";

  const expirationDate = data.expirationDate ? new Date(data.expirationDate).toISOString() : null;

  const docData = {
    name: data.name,
    entityType: data.entityType,
    companyId,
    realemail: data.realemail || "",
    allowedFileTypes: data.allowedFileTypes || [".pdf", ".jpg", ".jpeg", ".png"],
    exampleImage: data.exampleImage,
    exampleComment: data.exampleComment,
    createdFor: {
      companyId: data.companyId || "",
      realemail: data.realemail || "",
      email: data.email || ""
    },
    createdBy: {
      uid: user?.uid || "",
      realemail: user?.realemail || "",
      email: user?.email || ""
    },
    createdAt: new Date().toISOString(),
    origen: "frontend",

    // Aplicación a empresa principal y/o clientes
    appliesTo: data.appliesTo || {
      main: true, // Por defecto aplica a empresa principal
      clients: null // null = todos los clientes, [] = ninguno, ["id1", "id2"] = específicos
    },

    // Metadata intermedia
    archivoSubido: false,
    uploadedAt: null,
    uploadedBy: data.uploadedBy || {
      uid: "",
      email: "",
      realemail: ""
    },
    fileName: "",
    fileURL: "",

    // Metadata final
    status: "Pendiente",
    aprobadoAt: null,
    aprobadoPor: {
      uid: "",
      email: "",
      realemail: ""
    },
    expirationDate: expirationDate,
    deadline: {
      date: expirationDate,
      status: expirationDate ? 'pending' : 'no-deadline'
    },
    version: 1
  };

  const cleanedDocData = cleanFirestoreData(docData);

  try {
    // Usar la ruta multi-tenant correcta
    const requiredDocumentsPath = getTenantCollectionPath('requiredDocuments');
    const docRef = await addDoc(collection(db, requiredDocumentsPath), cleanedDocData);
    await addDocumentLog(docRef.id, "creacion", user, "Documento requerido creado");
    
    // Analizar exampleImage si está presente y guardar metadata
    if (cleanedDocData.exampleImage) {
      try {
        await analyzeExampleImage(docRef.id, cleanedDocData.exampleImage, companyId);
      } catch (error) {
        console.warn("Error analizando exampleImage después de crear documento:", error);
        // No fallar la creación si el análisis falla
      }
    }
    
    return docRef;
  } catch (error) {
    console.error("Error creating required document:", error);
    throw error;
  }
};

/**
 * Analiza un exampleImage y guarda la metadata en el documento requerido
 */
export const analyzeExampleImage = async (documentId, exampleImageURL, companyId) => {
  if (!exampleImageURL || !documentId) return;
  
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      console.warn("No hay usuario autenticado para analizar exampleImage");
      return;
    }
    
    const token = await user.getIdToken();
    
    console.log(`🔍 Analizando exampleImage para documento ${documentId}...`);
    
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/required-documents/analyze-example`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        exampleImageURL,
        documentId,
        companyId
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al analizar exampleImage');
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ Metadata del exampleImage guardada para documento ${documentId}`);
    }
    
    return data;
  } catch (error) {
    console.error("Error analizando exampleImage:", error);
    throw error;
  }
};

/**
 * Actualiza la metadata cuando se sube un archivo.
 */
export const updateDocumentOnUpload = async ({ docId, file, user }) => {
  // Usar la ruta multi-tenant correcta
  const requiredDocumentsPath = getTenantCollectionPath('requiredDocuments');
  const docRef = doc(db, requiredDocumentsPath, docId);
  // Guardar size en bytes, valor entero
  const updateData = {
    archivoSubido: true,
    adminComment: user?.adminComment || "",
    companyComment: user?.companyComment || "",
    exampleComment: user?.exampleComment || "",
    uploadedAt: serverTimestamp(),
    uploadedBy: user?.uploadedBy || {
      uid: user?.uid || "",
      email: user?.email || "",
      realemail: user?.realemail || ""
    },
    fileName: file.name,
    fileExtension: file.name.split('.').pop(),
    fileURL: file.url,
    fileType: file.fileType, // Añadir el tipo de archivo
    size: typeof file.size === 'number' ? Math.round(file.size) : undefined, // size en bytes
    status: "Subido",
    version: file.version,
    subversion: file.subversion,
    versionString: file.versionString
  };

  const cleanedUpdateData = cleanFirestoreData(updateData);

  try {
    await updateDoc(docRef, cleanedUpdateData);
    // await addDocumentLog(docId, "subida", user, "Archivo asociado subido");
  } catch (error) {
    console.error(`Error updating document ${docId} on upload:`, error);
    throw error;
  }
};


/**
 * Aprueba el documento y actualiza la metadata final.
 */
export const approveDocument = async ({ docId, expirationDate, user, file }) => {
  // Usar la ruta multi-tenant correcta
  const requiredDocumentsPath = getTenantCollectionPath('requiredDocuments');
  const docRef = doc(db, requiredDocumentsPath, docId);
  // 1. Obtener versión actual
  const currentSnap = await getDoc(docRef);
  const currentData = currentSnap.exists() ? currentSnap.data() : {};
  const prevVersion = typeof currentData.version === 'number' ? currentData.version : 1;
  const newVersion = prevVersion + 1;

  // Mantener size si ya existe, o tomar de file si se provee
  const updateData = {
    status: "Aprobado",
    aprobadoAt: new Date().toISOString(),
    aprobadoPor: {
      uid: user?.uid || "",
      email: user?.email || "",
      realemail: user?.realemail || ""
    },
    companyComment: user?.companyComment || "",
    exampleComment: user?.exampleComment || "",
    adminComment: user?.adminComment || "",
    deadline: {
      date: expirationDate ? new Date(expirationDate).toISOString() : null,
      status: expirationDate ? 'pending' : 'no-deadline'
    },
    version: newVersion,
    subversion: 0,
    versionString: `${newVersion}.0`,
    size: typeof (file?.size) === 'number' ? Math.round(file.size) : (typeof currentData.size === 'number' ? Math.round(currentData.size) : undefined) // size en bytes
  };

  const cleanedUpdateData = cleanFirestoreData(updateData);

  try {
    await updateDoc(docRef, cleanedUpdateData);
    await addDocumentLog(docId, "aprobacion", user, "Documento aprobado");
  } catch (error) {
    console.error(`Error approving document ${docId}:`, error);
    throw error;
  }
};

/**
 * Rechaza el documento y actualiza la metadata final.
 * Estructura similar a approveDocument, pero para rechazo.
 */
export const rejectDocument = async ({ docId, user, reason, expirationDate, file }) => {
  // Usar la ruta multi-tenant correcta
  const requiredDocumentsPath = getTenantCollectionPath('requiredDocuments');
  const docRef = doc(db, requiredDocumentsPath, docId);
  // 1. Obtener versión actual
  const currentSnap = await getDoc(docRef);
  const currentData = currentSnap.exists() ? currentSnap.data() : {};
  const prevVersion = typeof currentData.version === 'number' ? currentData.version : 1;
  const prevSubversion = typeof currentData.subversion === 'number' ? currentData.subversion : 0;
  const newSubversion = prevSubversion + 1;

  // Mantener size si ya existe, o tomar de file si se provee
  const updateData = {
    status: "Rechazado",
    rechazadoAt: new Date().toISOString(),
    rechazadoPor: {
      uid: user?.uid || "",
      email: user?.email || "",
      realemail: user?.realemail || ""
    },
    companyComment: user?.companyComment || "",
    exampleComment: user?.exampleComment || "",
    adminComment: reason || user?.adminComment || "",
    deadline: {
      date: expirationDate ? new Date(expirationDate).toISOString() : null,
      status: expirationDate ? 'pending' : 'no-deadline'
    },
    version: prevVersion,
    subversion: newSubversion,
    versionString: `${prevVersion}.${newSubversion}`,
    size: typeof (file?.size) === 'number' ? Math.round(file.size) : (typeof currentData.size === 'number' ? Math.round(currentData.size) : undefined) // size en bytes
  };

  const cleanedUpdateData = cleanFirestoreData(updateData);

  try {
    await updateDoc(docRef, cleanedUpdateData);
    // await addDocumentLog(docId, "rechazo", user, reason || "Documento rechazado");
  } catch (error) {
    console.error(`Error rejecting document ${docId}:`, error);
    throw error;
  }
};
