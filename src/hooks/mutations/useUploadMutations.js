// src/hooks/mutations/useUploadMutations.js
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { uploadFile } from '../utils/FileUploadService';
import { MUTATION_DEFAULTS } from '../config/queryConfig';
import { adminKeys } from '../queries/useAdminQueries';

// Mutation para subida masiva
const massiveUploadMutation = async ({ files, classifications }) => {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));
  
  const response = await axios.post('/api/classify-and-convert', formData);
  return response.data;
};

// Mutation para subir archivo individual
const uploadFileMutation = async ({ file, entityType, entityId, requiredDocumentId, companyId }) => {
  return await uploadFile({
    file,
    entityType,
    entityId,
    requiredDocumentId,
    companyId
  });
};

// Hook principal
export function useUploadMutations() {
  const queryClient = useQueryClient();

  const massiveUploadMutation = useMutation({
    mutationFn: massiveUploadMutation,
    onSuccess: () => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: adminKeys.pendingDocuments() });
      queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
    },
    ...MUTATION_DEFAULTS,
  });

  const uploadFileMutation = useMutation({
    mutationFn: uploadFileMutation,
    onSuccess: () => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: adminKeys.pendingDocuments() });
      queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
    },
    ...MUTATION_DEFAULTS,
  });

  return {
    // Massive upload operations
    massiveUpload: massiveUploadMutation.mutate,
    isMassiveUploading: massiveUploadMutation.isPending,
    massiveUploadError: massiveUploadMutation.error,

    // Single file upload operations
    uploadFile: uploadFileMutation.mutate,
    isUploading: uploadFileMutation.isPending,
    uploadError: uploadFileMutation.error,

    // Combined loading state
    isLoading: massiveUploadMutation.isPending || uploadFileMutation.isPending,
  };
}

