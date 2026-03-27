// src/hooks/mutations/useAdminMutations.js
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, addDoc, updateDoc, deleteDoc, collection } from 'firebase/firestore';
import { db } from '../../config/firebaseconfig';
import { getTenantCollectionPath } from '../../utils/tenantUtils';
import { MUTATION_DEFAULTS } from '../../config/queryConfig';
import { adminKeys } from '../queries/useAdminQueries';

// Mutations para administradores
const createAdmin = async ({ email, role, companyId, name }) => {
  const adminsPath = getTenantCollectionPath('admins');
  const adminData = {
    email,
    role,
    companyId,
    name,
    createdAt: new Date(),
    active: true,
  };
  
  const docRef = await addDoc(collection(db, adminsPath), adminData);
  return { id: docRef.id, ...adminData };
};

const updateAdmin = async ({ adminId, updates }) => {
  const adminsPath = getTenantCollectionPath('admins');
  const adminRef = doc(db, adminsPath, adminId);
  await updateDoc(adminRef, { ...updates, updatedAt: new Date() });
  return { id: adminId, ...updates };
};

const deleteAdmin = async (adminId) => {
  const adminsPath = getTenantCollectionPath('admins');
  const adminRef = doc(db, adminsPath, adminId);
  await deleteDoc(adminRef);
  return adminId;
};

// Mutations para empresas
const createCompany = async (companyData) => {
  const companiesPath = getTenantCollectionPath('companies');
  const docRef = await addDoc(collection(db, companiesPath), {
    ...companyData,
    createdAt: new Date(),
    status: 'pending',
  });
  return { id: docRef.id, ...companyData };
};

const updateCompany = async ({ companyId, updates }) => {
  const companiesPath = getTenantCollectionPath('companies');
  const companyRef = doc(db, companiesPath, companyId);
  await updateDoc(companyRef, { ...updates, updatedAt: new Date() });
  return { id: companyId, ...updates };
};

const deleteCompany = async (companyId) => {
  const companiesPath = getTenantCollectionPath('companies');
  const companyRef = doc(db, companiesPath, companyId);
  await deleteDoc(companyRef);
  return companyId;
};

// Mutations para documentos
const approveDocument = async ({ documentId, adminId, comments }) => {
  const uploadedDocsPath = getTenantCollectionPath('uploadedDocuments');
  const docRef = doc(db, uploadedDocsPath, documentId);
  await updateDoc(docRef, {
    status: 'Aprobado',
    approvedBy: adminId,
    approvedAt: new Date(),
    comments: comments || '',
  });
  return { id: documentId, status: 'Aprobado' };
};

const rejectDocument = async ({ documentId, adminId, comments }) => {
  const uploadedDocsPath = getTenantCollectionPath('uploadedDocuments');
  const docRef = doc(db, uploadedDocsPath, documentId);
  await updateDoc(docRef, {
    status: 'Rechazado',
    rejectedBy: adminId,
    rejectedAt: new Date(),
    comments: comments || '',
  });
  return { id: documentId, status: 'Rechazado' };
};

const batchApproveDocuments = async ({ documentIds, adminId, comments }) => {
  const uploadedDocsPath = getTenantCollectionPath('uploadedDocuments');
  const updatePromises = documentIds.map(documentId => {
    const docRef = doc(db, uploadedDocsPath, documentId);
    return updateDoc(docRef, {
      status: 'Aprobado',
      approvedBy: adminId,
      approvedAt: new Date(),
      comments: comments || '',
    });
  });
  
  await Promise.all(updatePromises);
  return documentIds.map(id => ({ id, status: 'Aprobado' }));
};

const batchRejectDocuments = async ({ documentIds, adminId, comments }) => {
  const uploadedDocsPath = getTenantCollectionPath('uploadedDocuments');
  const updatePromises = documentIds.map(documentId => {
    const docRef = doc(db, uploadedDocsPath, documentId);
    return updateDoc(docRef, {
      status: 'Rechazado',
      rejectedBy: adminId,
      rejectedAt: new Date(),
      comments: comments || '',
    });
  });
  
  await Promise.all(updatePromises);
  return documentIds.map(id => ({ id, status: 'Rechazado' }));
};

// Hooks
export function useAdminMutations() {
  const queryClient = useQueryClient();

  // Admin mutations
  const createAdminMutation = useMutation({
    mutationFn: createAdmin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.admins() });
    },
    ...MUTATION_DEFAULTS,
  });

  const updateAdminMutation = useMutation({
    mutationFn: updateAdmin,
    onSuccess: (data) => {
      queryClient.setQueryData(adminKeys.admin(data.id), data);
      queryClient.invalidateQueries({ queryKey: adminKeys.admins() });
    },
    ...MUTATION_DEFAULTS,
  });

  const deleteAdminMutation = useMutation({
    mutationFn: deleteAdmin,
    onSuccess: (adminId) => {
      queryClient.removeQueries({ queryKey: adminKeys.admin(adminId) });
      queryClient.invalidateQueries({ queryKey: adminKeys.admins() });
    },
    ...MUTATION_DEFAULTS,
  });

  // Company mutations
  const createCompanyMutation = useMutation({
    mutationFn: createCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.companies() });
      queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
    },
    ...MUTATION_DEFAULTS,
  });

  const updateCompanyMutation = useMutation({
    mutationFn: updateCompany,
    onSuccess: (data) => {
      queryClient.setQueryData(adminKeys.company(data.id), data);
      queryClient.invalidateQueries({ queryKey: adminKeys.companies() });
    },
    ...MUTATION_DEFAULTS,
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: deleteCompany,
    onSuccess: (companyId) => {
      queryClient.removeQueries({ queryKey: adminKeys.company(companyId) });
      queryClient.invalidateQueries({ queryKey: adminKeys.companies() });
      queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
    },
    ...MUTATION_DEFAULTS,
  });

  // Document mutations
  const approveDocumentMutation = useMutation({
    mutationFn: approveDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.pendingDocuments() });
      queryClient.invalidateQueries({ queryKey: adminKeys.historyDocuments() });
      queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
    },
    ...MUTATION_DEFAULTS,
  });

  const rejectDocumentMutation = useMutation({
    mutationFn: rejectDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.pendingDocuments() });
      queryClient.invalidateQueries({ queryKey: adminKeys.historyDocuments() });
      queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
    },
    ...MUTATION_DEFAULTS,
  });

  const batchApproveMutation = useMutation({
    mutationFn: batchApproveDocuments,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.pendingDocuments() });
      queryClient.invalidateQueries({ queryKey: adminKeys.historyDocuments() });
      queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
    },
    ...MUTATION_DEFAULTS,
  });

  const batchRejectMutation = useMutation({
    mutationFn: batchRejectDocuments,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.pendingDocuments() });
      queryClient.invalidateQueries({ queryKey: adminKeys.historyDocuments() });
      queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
    },
    ...MUTATION_DEFAULTS,
  });

  return {
    // Admin operations
    createAdmin: createAdminMutation.mutate,
    updateAdmin: updateAdminMutation.mutate,
    deleteAdmin: deleteAdminMutation.mutate,
    isCreatingAdmin: createAdminMutation.isPending,
    isUpdatingAdmin: updateAdminMutation.isPending,
    isDeletingAdmin: deleteAdminMutation.isPending,
    adminError: createAdminMutation.error || updateAdminMutation.error || deleteAdminMutation.error,

    // Company operations
    createCompany: createCompanyMutation.mutate,
    updateCompany: updateCompanyMutation.mutate,
    deleteCompany: deleteCompanyMutation.mutate,
    isCreatingCompany: createCompanyMutation.isPending,
    isUpdatingCompany: updateCompanyMutation.isPending,
    isDeletingCompany: deleteCompanyMutation.isPending,
    companyError: createCompanyMutation.error || updateCompanyMutation.error || deleteCompanyMutation.error,

    // Document operations
    approveDocument: approveDocumentMutation.mutate,
    rejectDocument: rejectDocumentMutation.mutate,
    batchApprove: batchApproveMutation.mutate,
    batchReject: batchRejectMutation.mutate,
    isApproving: approveDocumentMutation.isPending,
    isRejecting: rejectDocumentMutation.isPending,
    isBatchApproving: batchApproveMutation.isPending,
    isBatchRejecting: batchRejectMutation.isPending,
    documentError: approveDocumentMutation.error || rejectDocumentMutation.error || batchApproveMutation.error || batchRejectMutation.error,
  };
}

