// src/server/hooks/useFileUploadWithConversion.js
// Server-only hook for file upload with conversion functionality
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadFileWithConversion } from '../utils/FileUploadWithConversion';
import { MUTATION_DEFAULTS } from '../../hooks/config/queryConfig';
import { adminKeys } from '../../hooks/queries/useAdminQueries';

// Mutation para subir archivo con conversión (server-only)
const uploadFileWithConversionMutation = async ({ file, folder, metadata = {}, convertToPdf = false, onProgress }) => {
  return await uploadFileWithConversion(file, folder, metadata, onProgress);
};

// Hook server-only para upload con conversión
export function useFileUploadWithConversion() {
  const queryClient = useQueryClient();

  const uploadFileWithConversionMutation = useMutation({
    mutationFn: uploadFileWithConversionMutation,
    onSuccess: () => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: adminKeys.pendingDocuments() });
      queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
    },
    ...MUTATION_DEFAULTS,
  });

  return {
    uploadFileWithConversion: uploadFileWithConversionMutation.mutate,
    isUploadingWithConversion: uploadFileWithConversionMutation.isPending,
    uploadWithConversionError: uploadFileWithConversionMutation.error,
    isLoading: uploadFileWithConversionMutation.isPending,
  };
}
