// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut, browserLocalPersistence } from "firebase/auth";
import { getTenantCollectionPath } from "../utils/tenantUtils";

// Your web app's Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase - verificar si ya existe una instancia
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
auth.setPersistence(browserLocalPersistence);

// Constantes para roles y estados
const ADMIN_ROLE = "DhHkVja";
const COMPANY_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

/**
 * Verifica si un usuario es administrador basado en su rol
 * @param {string} userId - ID del usuario en Firebase Auth
 * @returns {Promise<boolean>} - True si el usuario es administrador, false en caso contrario
 */
async function isUserAdmin(userId) {
  try {
    // Usar la ruta multi-tenant correcta
    const companiesPath = getTenantCollectionPath('companies');
    const companyDoc = await getDoc(doc(db, companiesPath, userId));
    if (companyDoc.exists()) {
      return companyDoc.data().role === ADMIN_ROLE;
    }
    return false;
  } catch (error) {
    console.error("Error al verificar rol de administrador:", error);
    return false;
  }
}

/**
 * Verifica si una empresa está aprobada
 * @param {string} companyId - ID de la empresa
 * @returns {Promise<boolean>} - True si la empresa está aprobada
 */
async function isCompanyApproved(companyId) {
  // Usar la ruta multi-tenant correcta
  const companiesPath = getTenantCollectionPath('companies');
  const docSnap = await getDoc(doc(db, companiesPath, companyId));
  return docSnap.exists() && docSnap.data().status === COMPANY_STATUS.APPROVED;
}

/**
 * Obtiene empresas pendientes de aprobación
 * @returns {Promise<Array>} - Lista de empresas pendientes
 */
async function getPendingCompanies() {
  // Usar la ruta multi-tenant correcta
  const companiesPath = getTenantCollectionPath('companies');
  const q = query(
    collection(db, companiesPath),
    where("status", "==", COMPANY_STATUS.PENDING)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Actualiza el estado de una empresa
 * @param {string} companyId - ID de la empresa
 * @param {string} status - Nuevo estado (COMPANY_STATUS)
 * @returns {Promise<void>}
 */
async function updateCompanyStatus(companyId, status) {
  // Usar la ruta multi-tenant correcta
  const companiesPath = getTenantCollectionPath('companies');
  await updateDoc(doc(db, companiesPath, companyId), { 
    status,
    reviewedAt: new Date() 
  });
}

/**
 * Inicia sesión con email y contraseña y verifica permisos
 * @param {Object} credentials - Credenciales del usuario
 * @returns {Promise<Object>} - Objeto con información del usuario
 */
async function signIn(credentials) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
    const user = userCredential.user;
    
    const [isAdmin, isApproved] = await Promise.all([
      isUserAdmin(user.uid),
      isCompanyApproved(user.uid)
    ]);

    if (!isAdmin && !isApproved) {
      throw new Error("Su empresa aún no ha sido aprobada por el administrador");
    }

    return { user, isAdmin };
  } catch (error) {
    console.error('Error en signIn:', error);
    throw error;
  }
}

/**
 * Inicia sesión con Google y verifica si es administrador
 * @returns {Promise<Object>} - Objeto con información del usuario y si es admin
 */
async function loginWithGoogle() {
  try {
    console.log('Intentando iniciar sesión con Google');
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    console.log('Usuario de Google autenticado:', user.uid);
    
    // Intentar verificar si es administrador, pero no fallar si hay problemas
    let isAdmin = false;
    try {
      isAdmin = await isUserAdmin(user.uid);
      console.log('Es administrador (Google):', isAdmin);
    } catch (adminError) {
      console.error('Error al verificar rol de administrador (Google):', adminError);
      // Si hay error al verificar el rol, asumimos que no es admin pero permitimos continuar
      isAdmin = false;
    }
    
    return {
      user,
      isAdmin
    };
  } catch (error) {
    console.error('Error en función loginWithGoogle:', error);
    throw error; // Re-lanzamos el error para que pueda ser manejado por el componente
  }
}

export { 
  db, 
  auth, 
  ADMIN_ROLE, 
  COMPANY_STATUS,
  isUserAdmin, 
  isCompanyApproved,
  getPendingCompanies,
  updateCompanyStatus,
  signIn, 
  loginWithGoogle, 
  firebaseSignOut 
};