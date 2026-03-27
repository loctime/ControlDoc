// src/hooks/mutations/useFileUploadMutations.js
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadFile, validateFile } from '../utils/FileUploadService';
import { MUTATION_DEFAULTS } from '../config/queryConfig';
import { adminKeys } from '../queries/useAdminQueries';

// Mutation para subir archivo
const uploadFileMutation = async ({ file, folder, metadata = {} }) => {
  await validateFile(file);
  return await uploadFile(file, folder, metadata);
};

// Hook principal
export function useFileUploadMutations() {
  const queryClient = useQueryClient();

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
    // Basic upload operations only
    uploadFile: uploadFileMutation.mutate,
    isUploading: uploadFileMutation.isPending,
    uploadError: uploadFileMutation.error,
    isLoading: uploadFileMutation.isPending,
  };
}

