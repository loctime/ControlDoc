import React from 'react';
import { db } from '../firebaseconfig';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore';
import { getTenantCollectionPath, getTenantCollections } from '../utils/tenantUtils';

/**
 * Hook personalizado para operaciones de Firestore con soporte multi-tenant
 */
export function useTenantFirestore() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Obtener colección del tenant
  const getTenantCollection = useCallback((collectionName) => {
    const path = getTenantCollectionPath(collectionName);
    return collection(db, path);
  }, []);

  // Obtener documento del tenant
  const getTenantDoc = useCallback((collectionName, docId) => {
    const path = getTenantCollectionPath(collectionName);
    return doc(db, path, docId);
  }, []);

  // Crear documento en el tenant
  const createTenantDocument = useCallback(async (collectionName, data) => {
    setLoading(true);
    setError(null);
    
    try {
      const tenantCollection = getTenantCollection(collectionName);
      const docData = {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(tenantCollection, docData);
      return { id: docRef.id, ...docData };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getTenantCollection]);

  // Actualizar documento del tenant
  const updateTenantDocument = useCallback(async (collectionName, docId, data) => {
    setLoading(true);
    setError(null);
    
    try {
      const tenantDoc = getTenantDoc(collectionName, docId);
      const updateData = {
        ...data,
        updatedAt: serverTimestamp()
      };
      
      await updateDoc(tenantDoc, updateData);
      return { id: docId, ...updateData };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getTenantDoc]);

  // Eliminar documento del tenant
  const deleteTenantDocument = useCallback(async (collectionName, docId) => {
    setLoading(true);
    setError(null);
    
    try {
      const tenantDoc = getTenantDoc(collectionName, docId);
      await deleteDoc(tenantDoc);
      return true;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getTenantDoc]);

  // Obtener documento del tenant
  const getTenantDocument = useCallback(async (collectionName, docId) => {
    setLoading(true);
    setError(null);
    
    try {
      const tenantDoc = getTenantDoc(collectionName, docId);
      const docSnap = await getDoc(tenantDoc);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getTenantDoc]);

  // Obtener documentos del tenant con filtros
  const getTenantDocuments = useCallback(async (collectionName, filters = [], orderByField = null) => {
    setLoading(true);
    setError(null);
    
    try {
      const tenantCollection = getTenantCollection(collectionName);
      let q = tenantCollection;
      
      // Aplicar filtros
      filters.forEach(filter => {
        q = query(q, where(filter.field, filter.operator, filter.value));
      });
      
      // Aplicar ordenamiento
      if (orderByField) {
        q = query(q, orderBy(orderByField.field, orderByField.direction || 'asc'));
      }
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getTenantCollection]);

  // Hook para escuchar cambios en tiempo real
  const useTenantSnapshot = useCallback((collectionName, filters = [], callback) => {
    useEffect(() => {
      const tenantCollection = getTenantCollection(collectionName);
      let q = tenantCollection;
      
      // Aplicar filtros
      filters.forEach(filter => {
        q = query(q, where(filter.field, filter.operator, filter.value));
      });
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const documents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(documents);
      }, (err) => {
        console.error('Error en snapshot:', err);
        setError(err.message);
      });
      
      return () => unsubscribe();
    }, [collectionName, JSON.stringify(filters), callback]);
  }, [getTenantCollection]);

  return {
    loading,
    error,
    getTenantCollection,
    getTenantDoc,
    createTenantDocument,
    updateTenantDocument,
    deleteTenantDocument,
    getTenantDocument,
    getTenantDocuments,
    useTenantSnapshot
  };
}

/**
 * Hook específico para empresas del tenant
 */
export function useTenantCompanies() {
  const { getTenantDocuments, createTenantDocument, updateTenantDocument } = useTenantFirestore();
  
  const getCompanies = useCallback(async () => {
    return await getTenantDocuments('companies');
  }, [getTenantDocuments]);
  
  const createCompany = useCallback(async (companyData) => {
    return await createTenantDocument('companies', companyData);
  }, [createTenantDocument]);
  
  const updateCompany = useCallback(async (companyId, companyData) => {
    return await updateTenantDocument('companies', companyId, companyData);
  }, [updateTenantDocument]);
  
  return {
    getCompanies,
    createCompany,
    updateCompany
  };
}

/**
 * Hook específico para usuarios del tenant
 */
export function useTenantUsers() {
  const { getTenantDocuments, createTenantDocument, updateTenantDocument } = useTenantFirestore();
  
  const getUsers = useCallback(async (companyId = null) => {
    const filters = companyId ? [{ field: 'companyId', operator: '==', value: companyId }] : [];
    return await getTenantDocuments('users', filters);
  }, [getTenantDocuments]);
  
  const createUser = useCallback(async (userData) => {
    return await createTenantDocument('users', userData);
  }, [createTenantDocument]);
  
  const updateUser = useCallback(async (userId, userData) => {
    return await updateTenantDocument('users', userId, userData);
  }, [updateTenantDocument]);
  
  return {
    getUsers,
    createUser,
    updateUser
  };
}

/**
 * Hook específico para documentos del tenant
 */
export function useTenantDocuments() {
  const { 
    getTenantDocuments, 
    createTenantDocument, 
    updateTenantDocument,
    useTenantSnapshot 
  } = useTenantFirestore();
  
  const getDocuments = useCallback(async (companyId = null, entityType = null) => {
    const filters = [];
    if (companyId) filters.push({ field: 'companyId', operator: '==', value: companyId });
    if (entityType) filters.push({ field: 'entityType', operator: '==', value: entityType });
    
    return await getTenantDocuments('uploadedDocuments', filters, { field: 'createdAt', direction: 'desc' });
  }, [getTenantDocuments]);
  
  const createDocument = useCallback(async (documentData) => {
    return await createTenantDocument('uploadedDocuments', documentData);
  }, [createTenantDocument]);
  
  const updateDocument = useCallback(async (documentId, documentData) => {
    return await updateTenantDocument('uploadedDocuments', documentId, documentData);
  }, [updateTenantDocument]);
  
  const useDocumentsSnapshot = useCallback((companyId = null, callback) => {
    const filters = companyId ? [{ field: 'companyId', operator: '==', value: companyId }] : [];
    useTenantSnapshot('uploadedDocuments', filters, callback);
  }, [useTenantSnapshot]);
  
  return {
    getDocuments,
    createDocument,
    updateDocument,
    useDocumentsSnapshot
  };
}
