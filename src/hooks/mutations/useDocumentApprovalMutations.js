// src/hooks/mutations/useDocumentApprovalMutations.js
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  doc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
  getDoc,
  Timestamp,
  deleteDoc,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { db, auth } from '../../config/firebaseconfig';
import axios from 'axios';
import { approveDocument, rejectDocument } from "../../utils/MetadataService";
import { cleanFileName } from '../../utils/cleanFileName';
import { enviarEmailDocumento } from '../../utils/EmailService';
import { getTenantCollectionPath } from '../../utils/tenantUtils';
import { MUTATION_DEFAULTS } from '../../config/queryConfig';
import { adminKeys } from '../queries/useAdminQueries';

// Mutation para aprobar documento
const approveDocumentMutation = async ({
  docId,
  documents,
  user,
  newExpirationDates,
  adminComment,
  companyComment,
  exampleComment,
  forcedCompanyId,
}) => {
  const currentUser = user || auth.currentUser;
  const isAprobando = true;

  try {
    // Obtener datos del documento
    const uploadedDocumentsPath = 'uploadedDocuments';
    const docRef = doc(db, uploadedDocumentsPath, docId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      throw new Error('Documento no encontrado');
    }

    const docData = docSnap.data();
    const companyId = forcedCompanyId || docData.companyId;

    // Actualizar documento en uploadedDocuments
    const updateData = {
      status: 'Aprobado',
      approvedBy: currentUser.uid,
      approvedAt: serverTimestamp(),
      adminComment: adminComment || '',
      companyComment: companyComment || '',
      exampleComment: exampleComment || '',
      updatedAt: serverTimestamp(),
    };

    // Agregar fecha de vencimiento si se proporciona
    if (newExpirationDates && newExpirationDates[docId]) {
      const expirationDate = newExpirationDates[docId];
      updateData.expirationDate = Timestamp.fromDate(new Date(expirationDate));
    }

    await updateDoc(docRef, updateData);

    // Copiar a biblioteca si se aprueba
    if (isAprobando) {
      const libraryPath = getTenantCollectionPath('documentLibrary');
      const libraryData = {
        ...docData,
        ...updateData,
        originalDocumentId: docId,
        copiedAt: serverTimestamp(),
        copiedBy: currentUser.uid,
      };

      await addDoc(collection(db, libraryPath), libraryData);
    }

    // Enviar email de notificación
    try {
      await enviarEmailDocumento({
        companyId,
        documentName: docData.name || 'Documento',
        status: 'Aprobado',
        adminComment: adminComment || '',
        companyComment: companyComment || '',
      });
    } catch (emailError) {
      console.warn('Error enviando email:', emailError);
    }

    return {
      id: docId,
      status: 'Aprobado',
      approvedBy: currentUser.uid,
      approvedAt: new Date(),
    };
  } catch (error) {
    console.error('Error aprobando documento:', error);
    throw error;
  }
};

// Mutation para rechazar documento
const rejectDocumentMutation = async ({
  docId,
  documents,
  user,
  adminComment,
  companyComment,
  exampleComment,
  forcedCompanyId,
}) => {
  const currentUser = user || auth.currentUser;

  try {
    // Obtener datos del documento
    const uploadedDocumentsPath = 'uploadedDocuments';
    const docRef = doc(db, uploadedDocumentsPath, docId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      throw new Error('Documento no encontrado');
    }

    const docData = docSnap.data();
    const companyId = forcedCompanyId || docData.companyId;

    // Actualizar documento en uploadedDocuments
    const updateData = {
      status: 'Rechazado',
      rejectedBy: currentUser.uid,
      rejectedAt: serverTimestamp(),
      adminComment: adminComment || '',
      companyComment: companyComment || '',
      exampleComment: exampleComment || '',
      updatedAt: serverTimestamp(),
    };

    await updateDoc(docRef, updateData);

    // Enviar email de notificación
    try {
      await enviarEmailDocumento({
        companyId,
        documentName: docData.name || 'Documento',
        status: 'Rechazado',
        adminComment: adminComment || '',
        companyComment: companyComment || '',
      });
    } catch (emailError) {
      console.warn('Error enviando email:', emailError);
    }

    return {
      id: docId,
      status: 'Rechazado',
      rejectedBy: currentUser.uid,
      rejectedAt: new Date(),
    };
  } catch (error) {
    console.error('Error rechazando documento:', error);
    throw error;
  }
};

// Mutation para poner en proceso
const setInProcessMutation = async ({
  docId,
  user,
  adminComment,
  forcedCompanyId,
}) => {
  const currentUser = user || auth.currentUser;

  try {
    const uploadedDocumentsPath = 'uploadedDocuments';
    const docRef = doc(db, uploadedDocumentsPath, docId);
    
    const updateData = {
      status: 'En proceso',
      processedBy: currentUser.uid,
      processedAt: serverTimestamp(),
      adminComment: adminComment || '',
      updatedAt: serverTimestamp(),
    };

    await updateDoc(docRef, updateData);

    return {
      id: docId,
      status: 'En proceso',
      processedBy: currentUser.uid,
      processedAt: new Date(),
    };
  } catch (error) {
    console.error('Error poniendo en proceso:', error);
    throw error;
  }
};

// Hook principal
export function useDocumentApprovalMutations() {
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: approveDocumentMutation,
    onSuccess: (data) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: adminKeys.pendingDocuments() });
      queryClient.invalidateQueries({ queryKey: adminKeys.historyDocuments() });
      queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
    },
    ...MUTATION_DEFAULTS,
  });

  const rejectMutation = useMutation({
    mutationFn: rejectDocumentMutation,
    onSuccess: (data) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: adminKeys.pendingDocuments() });
      queryClient.invalidateQueries({ queryKey: adminKeys.historyDocuments() });
      queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
    },
    ...MUTATION_DEFAULTS,
  });

  const setInProcessMutation = useMutation({
    mutationFn: setInProcessMutation,
    onSuccess: (data) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: adminKeys.pendingDocuments() });
      queryClient.invalidateQueries({ queryKey: adminKeys.inProgressDocuments() });
      queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
    },
    ...MUTATION_DEFAULTS,
  });

  return {
    // Approve operations
    approveDocument: approveMutation.mutate,
    isApproving: approveMutation.isPending,
    approveError: approveMutation.error,

    // Reject operations
    rejectDocument: rejectMutation.mutate,
    isRejecting: rejectMutation.isPending,
    rejectError: rejectMutation.error,

    // Process operations
    setInProcess: setInProcessMutation.mutate,
    isSettingInProcess: setInProcessMutation.isPending,
    processError: setInProcessMutation.error,

    // Combined loading state
    isLoading: approveMutation.isPending || rejectMutation.isPending || setInProcessMutation.isPending,
  };
}

