// backend/Firebase
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc, addDoc, deleteDoc, orderBy } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut, browserLocalPersistence } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA_EVoSRWGl_y6xbA2pl7WTaGKLFXfmpt0",
  authDomain: "control-doc-demo.firebaseapp.com",
  projectId: "control-doc-demo",
  storageBucket: "control-doc-demo.firebasestorage.app",
  messagingSenderId: "889671750593",
  appId: "1:889671750593:web:32f5589a4865c86a3cd540"
};

// Initialize Firebase - verificar si ya existe una instancia
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
auth.setPersistence(browserLocalPersistence);

// Constantes para roles y estados
const ADMIN_ROLE = "DhHkVja";
const SUPER_ADMIN_ROLE = "max"; // Nuevo rol superadmin
const COMPANY_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

// Colecciones de Firestore
const DOCUMENT_NAMES_COLLECTION = "DocumentNames";

/**
 * Verifica si un usuario es administrador basado en su rol
 * @param {string} userId - ID del usuario en Firebase Auth
 * @returns {Promise<boolean>} - True si el usuario es administrador, false en caso contrario
 */
async function isUserAdmin(userId) {
  try {
    // Usar la ruta multi-tenant correcta
    const { getTenantCollectionPath } = await import('./utils/tenantUtils');
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
  const { getTenantCollectionPath } = await import('./utils/tenantUtils');
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
  const { getTenantCollectionPath } = await import('./utils/tenantUtils');
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
  const { getTenantCollectionPath } = await import('./utils/tenantUtils');
  const companiesPath = getTenantCollectionPath('companies');
  
  await updateDoc(doc(db, companiesPath, companyId), { 
    status,
    reviewedAt: new Date() 
  });
}

/**
 * Obtiene todos los nombres de documentos ordenados - USANDO ESTRUCTURA MULTI-TENANT
 * @returns {Promise<Array>} - Lista de nombres de documentos
 */
async function getAllDocumentNames() {
  try {
    // Importar la función para obtener la ruta del tenant
    const { getTenantCollectionPath } = await import('./utils/tenantUtils');
    const tenantCollectionPath = getTenantCollectionPath('documentNames');
    
    const q = query(
      collection(db, tenantCollectionPath),
      orderBy('createdAt')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data().name);
  } catch (error) {
    console.error("Error al obtener nombres de documentos:", error);
    throw error;
  }
}

/**
 * Agrega un nuevo nombre de documento - USANDO ESTRUCTURA MULTI-TENANT
 * @param {string} name - Nombre del documento
 * @param {string} userId - ID del usuario que lo crea
 * @returns {Promise<void>}
 */
async function addDocumentName(name, userId) {
  try {
    // Importar la función para obtener la ruta del tenant
    const { getTenantCollectionPath } = await import('./utils/tenantUtils');
    const tenantCollectionPath = getTenantCollectionPath('documentNames');
    
    await addDoc(collection(db, tenantCollectionPath), {
      name: name.trim(),
      createdAt: new Date(),
      createdBy: userId
    });
  } catch (error) {
    console.error("Error al agregar nombre de documento:", error);
    throw error;
  }
}

/**
 * Elimina un nombre de documento - USANDO ESTRUCTURA MULTI-TENANT
 * @param {string} name - Nombre del documento a eliminar
 * @returns {Promise<void>}
 */
async function removeDocumentName(name) {
  try {
    // Importar la función para obtener la ruta del tenant
    const { getTenantCollectionPath } = await import('./utils/tenantUtils');
    const tenantCollectionPath = getTenantCollectionPath('documentNames');
    
    const q = query(
      collection(db, tenantCollectionPath),
      where("name", "==", name)
    );
    const snapshot = await getDocs(q);
    
    const deletePromises = [];
    snapshot.forEach((document) => {
      deletePromises.push(deleteDoc(doc(db, tenantCollectionPath, document.id)));
    });
    
    await Promise.all(deletePromises);
  } catch (error) {
    console.error("Error al eliminar nombre de documento:", error);
    throw error;
  }
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
  SUPER_ADMIN_ROLE,
  COMPANY_STATUS,
  DOCUMENT_NAMES_COLLECTION,
  isUserAdmin, 
  isCompanyApproved,
  getPendingCompanies,
  updateCompanyStatus,
  getAllDocumentNames,
  addDocumentName,
  removeDocumentName,
  signIn, 
  loginWithGoogle, 
  firebaseSignOut 
};