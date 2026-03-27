import { useState } from 'react';
import { agruparPorTamanioMaximo } from '../utils/documentUtils';

/**
 * Hook para manejar la lógica de backup histórico
 */
export function useBackupLogic() {
  const [loadingBackup, setLoadingBackup] = useState(false);
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [backupResult, setBackupResult] = useState(null);

  const handleGenerateBackup = async (docIds, filteredAndSortedDocs, allDocuments, token, user) => {
    setLoadingBackup(true);
    setBackupResult(null);
    try {
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
        setBackupResult({ type: 'error', message: 'No hay documentos para backupear.' });
        setLoadingBackup(false);
        setBackupModalOpen(false);
        return;
      }
      
      // Agrupar en lotes de hasta 400MB
      const grupos = agruparPorTamanioMaximo(docsToBackup);
      const resultados = [];
      const urls = [];
      const { marcarArchivosBackupConMetadata } = await import('../../../../utils/MetadataService');
      
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
      
      // Feedback visual
      if (resultados.length === 1) {
        setBackupResult({
          type: 'success',
          message: 'Backup generado correctamente.',
          url: resultados[0].backupURL
        });
      } else {
        setBackupResult({
          type: 'success',
          message: `Se generaron ${resultados.length} archivos ZIP (máx 400MB c/u) y fueron guardados como backup.`,
          urls: resultados.map((r, idx) => ({ url: r.backupURL, nombre: `Backup #${idx + 1}` }))
        });
      }
    } catch (err) {
      setBackupResult({ type: 'error', message: err.message });
    } finally {
      setLoadingBackup(false);
      setBackupModalOpen(false);
    }
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
    loadingBackup,
    backupModalOpen,
    backupResult,
    handleBackupClick,
    handleGenerateBackup,
    handleConfirmBackupAll,
    handleCloseBackupResult,
    setBackupModalOpen
  };
}
