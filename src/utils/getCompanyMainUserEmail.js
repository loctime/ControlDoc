import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../config/firebaseconfig";
import { getTenantCollectionPath } from "./tenantUtils";

/**
 * Obtiene el email del usuario principal (owner) de una empresa a partir de companyId (CUIT).
 * Si no hay owner, toma el primer usuario encontrado para esa empresa.
 * @param {string} companyId
 * @returns {Promise<string|null>} Email del usuario o null si no se encuentra
 */
export async function getCompanyMainUserEmail(companyId) {
  if (!companyId) return null;
  try {
    // Buscar usuario con companyId y status activo o pendiente
    // Usar la ruta multi-tenant correcta
    const usersPath = getTenantCollectionPath('users');
    const usersRef = collection(db, usersPath);
    const q = query(usersRef, where("companyId", "==", companyId));
    const snap = await getDocs(q);
    console.log("[getCompanyMainUserEmail] Usuarios encontrados para companyId:", companyId, snap.docs.map(doc => doc.data()));
    if (snap.empty) return null;

    // Buscar owner primero
    const owner = snap.docs.find(doc => doc.data().role === "owner" || doc.data().role === "admin");
    if (owner) {
      console.log("[getCompanyMainUserEmail] Se encontró owner/admin:", owner.data());
      return owner.data().email || null;
    }

    // Si no hay owner/admin, devolver el primer usuario
    if (snap.docs[0]) {
      console.log("[getCompanyMainUserEmail] No hay owner/admin, usando primer usuario:", snap.docs[0].data());
      return snap.docs[0].data().email || null;
    }
    return null;
  } catch (err) {
    console.error("Error obteniendo email del usuario principal de la empresa:", err);
    return null;
  }
}
