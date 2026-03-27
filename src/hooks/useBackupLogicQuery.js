// src/hooks/useBackupLogicQuery.js
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { agruparPorTamanioMaximo } from '../entidad/adm/Library/utils/documentUtils';
import { MUTATION_DEFAULTS } from '../config/queryConfig';
import { backupsKeys } from './useBackupsQuery';

// Mutation para generar backup
const generateBackupMutation = async ({ docIds, filteredAndSortedDocs, allDocuments, token, user }) => {
  // Determinar tipo de backup
  const isSelected = Array.isArray(docIds) && docIds.length > 0;
  const backupType = isSelected ? 'selectedBackup' : 'generalBackup';
  
  // Backup histórico: siempre todos los documentos sin backup (de allDocuments)
  let docsToBackup = [];
  if (isSelected) {
    docsToBackup = filteredAndSortedDocs.filter(doc => docIds.includes(doc.id));
  } else {
    // Siempre usar allDocuments para backup histórico
    docsToBackup = allDocuments.filter(doc => !doc.generalBackup);
  }
  
  if (docsToBackup.length === 0) {
    throw new Error('No hay documentos para backupear.');
  }
  
  // Agrupar en lotes de hasta 400MB
  const grupos = agruparPorTamanioMaximo(docsToBackup);
  const resultados = [];
  const urls = [];
  const { marcarArchivosBackupConMetadata } = await import('../utils/MetadataService');
  
  for (let i = 0; i < grupos.length; i++) {
    const grupo = grupos[i];
    // --- Generar backup en backend para este grupo ---
    const res = await fetch('/api/generate-backup/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ documentIds: grupo.map(doc => doc.id) })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Error generando backup');
    
    const backupURL = data.fileURLs?.[0] || '';
    const backupId = data.backupId || (data.fileURLs?.[0] ? data.fileURLs[0].split('/').pop().split('.')[0] : '');
    urls.push(backupURL);
    
    // Guardar metadata de backup en Firestore para este grupo
    await marcarArchivosBackupConMetadata({
      files: grupo,
      backupType,
      backupURL,
      backupId,
      user
    });
    resultados.push({ backupURL, backupId, cantidad: grupo.length });
  }
  
  // Preparar resultado
  if (resultados.length === 1) {
    return {
      type: 'success',
      message: 'Backup generado correctamente.',
      url: resultados[0].backupURL
    };
  } else {
    return {
      type: 'success',
      message: `Se generaron ${resultados.length} archivos ZIP (máx 400MB c/u) y fueron guardados como backup.`,
      urls: resultados.map((r, idx) => ({ url: r.backupURL, nombre: `Backup #${idx + 1}` }))
    };
  }
};

// Hook principal
export function useBackupLogicQuery() {
  const queryClient = useQueryClient();
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [backupResult, setBackupResult] = useState(null);

  const generateBackupMutation = useMutation({
    mutationFn: generateBackupMutation,
    onSuccess: (result) => {
      setBackupResult(result);
      // Invalidar lista de backups
      queryClient.invalidateQueries({ queryKey: backupsKeys.all });
    },
    onError: (error) => {
      setBackupResult({ type: 'error', message: error.message });
    },
    ...MUTATION_DEFAULTS,
  });

  const handleGenerateBackup = async (docIds, filteredAndSortedDocs, allDocuments, token, user) => {
    setBackupResult(null);
    generateBackupMutation.mutate({ docIds, filteredAndSortedDocs, allDocuments, token, user });
  };

  const handleBackupClick = (selectedFiles, filteredAndSortedDocs, allDocuments, token, user) => {
    if (selectedFiles.length > 0) {
      handleGenerateBackup(selectedFiles, filteredAndSortedDocs, allDocuments, token, user);
    } else {
      setBackupModalOpen(true);
    }
  };

  const handleConfirmBackupAll = (allDocuments, token, user) => {
    handleGenerateBackup(allDocuments.map(doc => doc.id), null, allDocuments, token, user);
  };

  const handleCloseBackupResult = () => setBackupResult(null);

  return {
    loadingBackup: generateBackupMutation.isPending,
    backupModalOpen,
    backupResult,
    handleBackupClick,
    handleGenerateBackup,
    handleConfirmBackupAll,
    handleCloseBackupResult,
    setBackupModalOpen,
    error: generateBackupMutation.error?.message || null,
  };
}

