// src/utils/queryUtils.js
import { useQueryClient } from '@tanstack/react-query';

// Common query keys
export const queryKeys = {
  // Dashboard
  dashboard: {
    all: ['dashboard'],
    company: (companyId) => ['dashboard', 'company', companyId],
    requiredDocuments: (companyId) => ['dashboard', 'requiredDocuments', companyId],
    uploadedDocuments: (companyId) => ['dashboard', 'uploadedDocuments', companyId],
    personal: (companyId) => ['dashboard', 'personal', companyId],
    vehiculos: (companyId) => ['dashboard', 'vehiculos', companyId],
  },
  
  // ControlFile
  controlFile: {
    all: ['controlFile'],
    user: () => ['controlFile', 'user'],
    folder: () => ['controlFile', 'folder'],
  },
  
  // File Analysis
  fileAnalysis: {
    all: ['fileAnalysis'],
    result: (fileURL) => ['fileAnalysis', fileURL],
  },
  
  // Companies
  companies: {
    all: ['companies'],
    list: () => ['companies', 'list'],
    detail: (companyId) => ['companies', 'detail', companyId],
  },
  
  // Documents
  documents: {
    all: ['documents'],
    required: (companyId) => ['documents', 'required', companyId],
    uploaded: (companyId) => ['documents', 'uploaded', companyId],
  },
};

// Utility hooks
export function useInvalidateQueries() {
  const queryClient = useQueryClient();
  
  return {
    invalidateDashboard: (companyId) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
        exact: false
      });
    },
    
    invalidateCompany: (companyId) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.company(companyId)
      });
    },
    
    invalidateDocuments: (companyId) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.documents.all,
        exact: false
      });
    },
    
    invalidateAll: () => {
      queryClient.invalidateQueries();
    }
  };
}

// Prefetch utilities
export function usePrefetchQueries() {
  const queryClient = useQueryClient();
  
  return {
    prefetchCompany: (companyId, queryFn) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.dashboard.company(companyId),
        queryFn,
        staleTime: 5 * 60 * 1000,
      });
    },
    
    prefetchDocuments: (companyId, queryFn) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.documents.required(companyId),
        queryFn,
        staleTime: 2 * 60 * 1000,
      });
    }
  };
}
