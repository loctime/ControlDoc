// src/hooks/useTenantFirestoreQuery.js
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config/firebaseconfig';
import { getTenantCollectionPath, getTenantCollections } from '../utils/tenantUtils';
import { MUTATION_DEFAULTS } from '../config/queryConfig';

// Query keys
export const tenantFirestoreKeys = {
  all: ['tenantFirestore'],
  collection: (collectionName) => ['tenantFirestore', 'collection', collectionName],
  document: (collectionName, docId) => ['tenantFirestore', 'document', collectionName, docId],
};

// Helper functions
const getTenantCollection = (collectionName) => {
  const path = getTenantCollectionPath(collectionName);
  return collection(db, path);
};

const getTenantDoc = (collectionName, docId) => {
  const path = getTenantCollectionPath(collectionName);
  return doc(db, path, docId);
};

// Mutations
const createTenantDocument = async ({ collectionName, data }) => {
  const tenantCollection = getTenantCollection(collectionName);
  const docData = {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  
  const docRef = await addDoc(tenantCollection, docData);
  return { id: docRef.id, ...docData };
};

const updateTenantDocument = async ({ collectionName, docId, data }) => {
  const docRef = getTenantDoc(collectionName, docId);
  const updateData = {
    ...data,
    updatedAt: serverTimestamp()
  };
  
  await updateDoc(docRef, updateData);
  return { id: docId, ...updateData };
};

const deleteTenantDocument = async ({ collectionName, docId }) => {
  const docRef = getTenantDoc(collectionName, docId);
  await deleteDoc(docRef);
  return docId;
};

const getTenantDocument = async ({ collectionName, docId }) => {
  const docRef = getTenantDoc(collectionName, docId);
  const snap = await getDoc(docRef);
  
  if (!snap.exists()) {
    throw new Error('Document not found');
  }
  
  return { id: snap.id, ...snap.data() };
};

const getTenantDocuments = async ({ collectionName, filters = [], orderByField = null }) => {
  const tenantCollection = getTenantCollection(collectionName);
  let q = tenantCollection;
  
  if (filters.length > 0) {
    q = query(tenantCollection, ...filters);
  }
  
  if (orderByField) {
    q = query(q, orderBy(orderByField));
  }
  
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Hook principal
export function useTenantFirestoreQuery() {
  const queryClient = useQueryClient();

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createTenantDocument,
    onSuccess: (data, variables) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({
        queryKey: tenantFirestoreKeys.collection(variables.collectionName)
      });
    },
    ...MUTATION_DEFAULTS,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: updateTenantDocument,
    onSuccess: (data, variables) => {
      // Actualizar cache optimísticamente
      queryClient.setQueryData(
        tenantFirestoreKeys.document(variables.collectionName, variables.docId),
        data
      );
      // Invalidar queries de colección
      queryClient.invalidateQueries({
        queryKey: tenantFirestoreKeys.collection(variables.collectionName)
      });
    },
    ...MUTATION_DEFAULTS,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteTenantDocument,
    onSuccess: (docId, variables) => {
      // Remover del cache
      queryClient.removeQueries({
        queryKey: tenantFirestoreKeys.document(variables.collectionName, docId)
      });
      // Invalidar queries de colección
      queryClient.invalidateQueries({
        queryKey: tenantFirestoreKeys.collection(variables.collectionName)
      });
    },
    ...MUTATION_DEFAULTS,
  });

  // Get single document mutation (para casos donde no se quiere cache)
  const getDocumentMutation = useMutation({
    mutationFn: getTenantDocument,
    ...MUTATION_DEFAULTS,
  });

  // Get multiple documents mutation
  const getDocumentsMutation = useMutation({
    mutationFn: getTenantDocuments,
    ...MUTATION_DEFAULTS,
  });

  return {
    // Create operations
    createDocument: createMutation.mutate,
    isCreating: createMutation.isPending,
    createError: createMutation.error,

    // Update operations
    updateDocument: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error,

    // Delete operations
    deleteDocument: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    deleteError: deleteMutation.error,

    // Get operations
    getDocument: getDocumentMutation.mutate,
    isGettingDocument: getDocumentMutation.isPending,
    getDocumentError: getDocumentMutation.error,

    getDocuments: getDocumentsMutation.mutate,
    isGettingDocuments: getDocumentsMutation.isPending,
    getDocumentsError: getDocumentsMutation.error,

    // Helper functions
    getTenantCollection,
    getTenantDoc,
  };
}

