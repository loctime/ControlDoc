// src/hooks/useFileAnalysisQuery.js
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

function isValidURL(url) {
  try {
    const parsed = new URL(url);
    return /^https?:/.test(parsed.protocol);
  } catch {
    return false;
  }
}

const analyzeFileAPI = async ({ fileURL, lang = 'spa' }) => {
  if (!fileURL || !isValidURL(fileURL)) {
    throw new Error("La URL del archivo no es válida.");
  }

  const res = await axios.post(
    `${import.meta.env.VITE_API_URL}/api/analyze-file`,
    { fileURL, lang }
  );
  return res.data;
};

export default function useFileAnalysisQuery() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: analyzeFileAPI,
    onSuccess: (data) => {
      // Cache the result for potential future use
      queryClient.setQueryData(['fileAnalysis', data.fileURL], data);
    },
    onError: (error) => {
      console.error('Error analyzing file:', error);
    }
  });

  const analyzeFile = async (fileURL, lang = 'spa') => {
    return mutation.mutateAsync({ fileURL, lang });
  };

  return {
    loading: mutation.isPending,
    result: mutation.data,
    error: mutation.error?.message || null,
    analyzeFile,
    reset: mutation.reset
  };
}

