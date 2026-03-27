import {
  doc,
  updateDoc,
  addDoc,
  collection,
  getDoc,
  Timestamp,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { getTenantCollectionPath } from "../../utils/tenantUtils";

const ACTIONS = {
  APROBAR: "APROBAR",
  RECHAZAR: "RECHAZAR",
  PONER_EN_PROCESO: "PONER_EN_PROCESO",
  AJUSTAR_FECHA: "AJUSTAR_FECHA"
};

/**
 * Parsea fecha string (YYYY-MM-DD o DD/MM/YYYY) o Date a Date.
 * @param {string|Date|null} dateInput
 * @returns {Date|null}
 */
function parseDate(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) return dateInput;
  if (typeof dateInput !== "string") return null;
  if (dateInput.includes("/")) {
    const [d, m, y] = dateInput.split("/");
    if (d && m && y) return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
  }
  if (dateInput.length >= 10) return new Date(dateInput);
  return null;
}

/**
 * Convierte fecha a Firestore Timestamp. Si falla, usa 1 año desde hoy.
 * @param {string|Date} dateInput
 * @returns {import("firebase/firestore").Timestamp}
 */
function toSafeTimestamp(dateInput) {
  const date = parseDate(dateInput);
  if (date && !isNaN(date.getTime())) {
    const min = new Date("1970-01-01");
    const max = new Date("2100-12-31");
    if (date >= min && date <= max) return Timestamp.fromDate(date);
  }
  const fallback = new Date();
  fallback.setFullYear(fallback.getFullYear() + 1);
  return Timestamp.fromDate(fallback);
}

/**
 * Obtiene la siguiente versión para approvedDocuments (por companyId + entityId + requiredDocumentId).
 * @param {import("firebase/firestore").Firestore} db
 * @param {string} approvedPath
 * @param {object} data
 * @returns {Promise<number>}
 */
async function getNextVersion(db, approvedPath, data) {
  const companyId = data.companyId || data.company;
  const entityId = data.entityId || companyId;
  const requiredDocumentId = data.requiredDocumentId || "";
  const clientId = data.clientId ?? null;

  const q = query(
    collection(db, approvedPath),
    where("companyId", "==", companyId),
    where("entityId", "==", entityId),
    where("requiredDocumentId", "==", requiredDocumentId)
  );
  const snap = await getDocs(q);
  let maxVersion = 0;
  snap.docs.forEach((d) => {
    const docData = d.data();
    if (docData.clientId !== clientId) return;
    const v = docData.versionNumber ?? docData.version ?? 0;
    if (v > maxVersion) maxVersion = v;
  });
  return maxVersion + 1;
}

/**
 * Ejecuta la acción de revisión y devuelve el documento actualizado.
 *
 * @param {object} params
 * @param {import("firebase/firestore").Firestore} params.db - Instancia de Firestore
 * @param {object} params.document - Documento a revisar (debe tener .id y datos en uploadedDocuments)
 * @param {string} params.action - "APROBAR" | "RECHAZAR" | "PONER_EN_PROCESO" | "AJUSTAR_FECHA"
 * @param {string} [params.newExpirationDate] - Fecha de vencimiento (para APROBAR / AJUSTAR_FECHA)
 * @param {string} [params.adminComment] - Comentario del admin (para RECHAZAR / PONER_EN_PROCESO, y opcional en APROBAR)
 * @param {object} [params.user] - Usuario que revisa (se usa user.email para reviewedBy)
 * @returns {Promise<object>} Documento actualizado { id, ...data }
 */
export async function handleApproveOrReject({
  db,
  document,
  action,
  newExpirationDate,
  adminComment,
  user
}) {
  const docId = document?.id;
  if (!docId) throw new Error("handleApproveOrReject: document.id es requerido");

  const uploadedPath = getTenantCollectionPath("uploadedDocuments");
  const approvedPath = getTenantCollectionPath("approvedDocuments");

  const docRef = doc(db, uploadedPath, docId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error(`Documento no encontrado: ${docId}`);

  const data = snap.data();
  const reviewedBy = user?.email ?? user?.displayName ?? "Administrador";
  const now = Timestamp.now();

  const actionUpper = String(action).toUpperCase().replace(/\s+/g, "_");

  if (actionUpper === ACTIONS.APROBAR) {
    if (!newExpirationDate?.trim()) throw new Error("APROBAR requiere newExpirationDate");

    const expirationTimestamp = toSafeTimestamp(newExpirationDate);
    const version = await getNextVersion(db, approvedPath, data);
    const versionString = `${version}.0`;

    const updateFields = {
      status: "Aprobado",
      reviewedBy,
      reviewedAt: now,
      expirationDate: expirationTimestamp,
      adminComment: adminComment?.trim() || null,
      version,
      subversion: 0,
      versionString,
      versionNumber: version
    };

    await updateDoc(docRef, updateFields);

    // Obtener companyName de forma segura
    const companiesPath = getTenantCollectionPath('companies');
    console.log('🔍 [handleApproveOrReject] Buscando empresa con companyId:', data.companyId);
    const companySnap = await getDoc(doc(db, companiesPath, data.companyId));
    
    if (companySnap.exists()) {
      const companyData = companySnap.data();
      console.log('🔍 [handleApproveOrReject] Datos de empresa encontrados:', {
        id: companySnap.id,
        companyName: companyData.companyName,
        name: companyData.name,
        cuit: companyData.cuit,
        realemail: companyData.realemail
      });
    } else {
      console.log('🔍 [handleApproveOrReject] Empresa no encontrada con ID:', data.companyId);
    }
    
    const companyName = companySnap.exists()
      ? companySnap.data().name || companySnap.data().companyName || `Empresa ${data.companyId}`
      : `Empresa ${data.companyId}`;

    const approvedData = {
      ...data,
      ...updateFields,
      originalId: docId,
      copiedAt: now,
      // Corregir mapeo de tamaño
      size: data.fileSize || 0,
      fileSize: data.fileSize || 0,
      // Asegurar companyName
      companyId: data.companyId,
      companyName: companyName
    };
    await addDoc(collection(db, approvedPath), approvedData);

    const updatedSnap = await getDoc(docRef);
    return { id: docId, ...updatedSnap.data() };
  }

  if (actionUpper === ACTIONS.RECHAZAR) {
    const updateFields = {
      status: "Rechazado",
      reviewedBy,
      reviewedAt: now,
      adminComment: adminComment?.trim() || null
    };
    await updateDoc(docRef, updateFields);
    const updatedSnap = await getDoc(docRef);
    return { id: docId, ...updatedSnap.data() };
  }

  if (actionUpper === ACTIONS.PONER_EN_PROCESO) {
    const currentVersion = data.versionNumber ?? data.version ?? 1;
    const currentSub = data.subversion ?? 0;
    const newSub = currentSub + 1;
    const versionString = `${currentVersion}.${newSub}`;

    const updateFields = {
      status: "En proceso",
      reviewedBy,
      reviewedAt: now,
      adminComment: adminComment?.trim() || "Documento enviado a tercero para aprobación",
      subversion: newSub,
      versionString,
      versionNumber: currentVersion
    };
    await updateDoc(docRef, updateFields);
    const updatedSnap = await getDoc(docRef);
    return { id: docId, ...updatedSnap.data() };
  }

  if (actionUpper === ACTIONS.AJUSTAR_FECHA) {
    if (!newExpirationDate?.trim()) throw new Error("AJUSTAR_FECHA requiere newExpirationDate");
    const expirationTimestamp = toSafeTimestamp(newExpirationDate);
    const updateFields = {
      expirationDate: expirationTimestamp,
      reviewedAt: now,
      reviewedBy
    };
    await updateDoc(docRef, updateFields);
    const updatedSnap = await getDoc(docRef);
    return { id: docId, ...updatedSnap.data() };
  }

  throw new Error(`Acción no válida: ${action}`);
}

export default handleApproveOrReject;
