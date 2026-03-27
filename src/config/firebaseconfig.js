import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc, addDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getTenantCollectionPath } from '../utils/tenantUtils';

// ── ControlFile: Solo Auth ─────────────────────────────────────
const controlFileConfig = {
  apiKey: import.meta.env.VITE_CONTROLFILE_API_KEY,
  authDomain: import.meta.env.VITE_CONTROLFILE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_CONTROLFILE_PROJECT_ID,
  appId: import.meta.env.VITE_CONTROLFILE_APP_ID,
};

// ── ControlDoc: Solo Firestore ─────────────────────────────────
const controlDocConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Inicializar apps separadas (getApps evita duplicados en hot reload)
const controlFileApp = getApps().find(a => a.name === 'controlfile') || initializeApp(controlFileConfig, 'controlfile');
const controlDocApp  = getApps().find(a => a.name === 'controldoc')  || initializeApp(controlDocConfig,  'controldoc');

// Auth → ControlFile | Firestore → ControlDoc
const auth = getAuth(controlFileApp);
setPersistence(auth, browserLocalPersistence);
const db = getFirestore(controlDocApp);

// ── Constantes ─────────────────────────────────────────────────
const ADMIN_ROLE             = "DhHkVja";
const SUPER_ADMIN_ROLE       = "max";
const COMPANY_STATUS         = { PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected' };
const DOCUMENT_NAMES_COLLECTION = "DocumentNames";

// ── Helpers ────────────────────────────────────────────────────
async function isUserAdmin(userId) {
  try {
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

async function isCompanyApproved(companyId) {
  const companiesPath = getTenantCollectionPath('companies');
  const docSnap = await getDoc(doc(db, companiesPath, companyId));
  return docSnap.exists() && docSnap.data().status === COMPANY_STATUS.APPROVED;
}

async function getPendingCompanies() {
  const companiesPath = getTenantCollectionPath('companies');
  const q = query(collection(db, companiesPath), where("status", "==", COMPANY_STATUS.PENDING));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function updateCompanyStatus(companyId, status) {
  const companiesPath = getTenantCollectionPath('companies');
  await updateDoc(doc(db, companiesPath, companyId), { status, reviewedAt: new Date() });
}

async function getAllDocumentNames() {
  try {
    const tenantPath = getTenantCollectionPath('documentNames');
    const q = query(collection(db, tenantPath), orderBy('createdAt'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data().name);
  } catch (error) {
    console.error("Error al obtener nombres de documentos:", error);
    throw error;
  }
}

async function addDocumentName(name, userId) {
  try {
    const tenantPath = getTenantCollectionPath('documentNames');
    await addDoc(collection(db, tenantPath), {
      name: name.trim(),
      createdAt: new Date(),
      createdBy: userId
    });
  } catch (error) {
    console.error("Error al agregar nombre de documento:", error);
    throw error;
  }
}

async function removeDocumentName(name) {
  try {
    const tenantPath = getTenantCollectionPath('documentNames');
    const q = query(collection(db, tenantPath), where("name", "==", name));
    const snapshot = await getDocs(q);
    const deletePromises = [];
    snapshot.forEach((document) => {
      deletePromises.push(deleteDoc(doc(db, tenantPath, document.id)));
    });
    await Promise.all(deletePromises);
  } catch (error) {
    console.error("Error al eliminar nombre de documento:", error);
    throw error;
  }
}

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

async function loginWithGoogle() {
  try {
    console.log('Intentando iniciar sesión con Google');
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    console.log('Usuario de Google autenticado:', user.uid);

    let isAdmin = false;
    try {
      isAdmin = await isUserAdmin(user.uid);
      console.log('Es administrador (Google):', isAdmin);
    } catch (adminError) {
      console.error('Error al verificar rol de administrador (Google):', adminError);
      isAdmin = false;
    }

    return { user, isAdmin };
  } catch (error) {
    console.error('Error en función loginWithGoogle:', error);
    throw error;
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
