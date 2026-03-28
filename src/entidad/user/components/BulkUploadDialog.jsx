// src/entidad/user/components/BulkUploadDialog.jsx
import React, { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Paper,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Alert,
  Chip
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  FileUpload as FileUploadIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { useAuth } from '../../../context/AuthContext';
import { uploadFile } from '../../../utils/FileUploadService';
import { getDownloadUrl } from '../../../utils/ControlFileStorage';
import BulkUploadReview from './BulkUploadReview';
import PdfSeparationReview from './PdfSeparationReview';
import CircularProgress from '@mui/material/CircularProgress';

export default function BulkUploadDialog({
  open,
  onClose,
  onUploadComplete,
  entityType,
  entityId,
  companyId
}) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const [currentStep, setCurrentStep] = useState('selection'); // 'selection' | 'analyzing' | 'review'
  const [classificationResults, setClassificationResults] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [separationReviewOpen, setSeparationReviewOpen] = useState(false);
  const [separationData, setSeparationData] = useState(null);
  const fileInputRef = useRef(null);
  const { token, activeCompanyId, mainCompanyId } = useAuth();
  const bulkUploadAnalysisEnabled = import.meta.env.VITE_BULK_UPLOAD_ANALYSIS_ENABLED === 'true';
  
  // IMPORTANTE: companyId siempre debe ser mainCompanyId (empresa principal), nunca cambia
  // Lo que cambia es activeCompanyId cuando seleccionas un cliente
  const finalCompanyId = companyId || mainCompanyId;

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      handleFilesSelected(files);
    }
  }, []);

  const handleFilesSelected = (files) => {
    const validFiles = Array.from(files).filter(file => {
      // Validar tipo de archivo
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      const isValidType = allowedTypes.includes(file.type);
      
      // Validar tamaño (400MB máximo)
      const maxSize = 400 * 1024 * 1024;
      const isValidSize = file.size <= maxSize;
      
      if (!isValidType) {
        setError(`El archivo "${file.name}" no es un tipo válido (PDF, JPG, PNG)`);
        return false;
      }
      
      if (!isValidSize) {
        setError(`El archivo "${file.name}" supera el límite de 400MB`);
        return false;
      }
      
      return true;
    });

    if (validFiles.length > 0) {
      setError(null);
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesSelected(Array.from(e.target.files));
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!bulkUploadAnalysisEnabled) {
      setError('La clasificación automática con OCR está deshabilitada temporalmente.');
      return;
    }

    if (selectedFiles.length === 0) {
      setError('Por favor selecciona al menos un archivo');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress({});
    const uploaded = [];

    try {
      // Subir archivos temporalmente a Backblaze
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setUploadProgress(prev => ({
          ...prev,
          [i]: { uploading: true, progress: 0, fileName: file.name }
        }));

        try {
          // Subir a una carpeta temporal
          const result = await uploadFile(file, 'temp-uploads', {
            isTemporary: true,
            originalName: file.name
          });

          uploaded.push({
            fileIndex: i,
            fileName: file.name,
            fileURL: result.url || result.fileURL,
            originalFile: file,
            uploaded: true
          });

          setUploadProgress(prev => ({
            ...prev,
            [i]: { uploading: false, progress: 100, fileName: file.name, success: true }
          }));
        } catch (err) {
          console.error(`Error subiendo archivo ${file.name}:`, err);
          setUploadProgress(prev => ({
            ...prev,
            [i]: { uploading: false, progress: 0, fileName: file.name, error: err.message }
          }));
        }
      }

      if (uploaded.length === 0) {
        setError('No se pudo subir ningún archivo. Por favor intenta nuevamente.');
        setUploading(false);
        return;
      }

      // Guardar archivos subidos
      setUploadedFiles(uploaded);
      
      // Detectar separaciones automáticamente en PDFs grandes (más de 5MB)
      const pdfsToCheck = uploaded.filter(file => {
        const isPdf = file.fileName.toLowerCase().endsWith('.pdf');
        const fileSize = file.originalFile?.size || 0;
        return isPdf && (fileSize > 5 * 1024 * 1024); // PDFs mayores a 5MB
      });
      
      if (pdfsToCheck.length > 0) {
        console.log(`🔍 Detectando separaciones en ${pdfsToCheck.length} PDF(s)...`);
        
        // Detectar separaciones en el primer PDF grande encontrado
        // TODO: Permitir detectar en múltiples PDFs
        const pdfToCheck = pdfsToCheck[0];
        try {
          await detectSeparations(pdfToCheck, uploaded);
        } catch (error) {
          console.warn('⚠️ Error detectando separaciones, continuando con análisis normal:', error);
          setCurrentStep('analyzing');
          prepareAnalysis(uploaded);
        }
      } else {
        // No hay PDFs grandes, continuar con análisis normal
        setCurrentStep('analyzing');
        prepareAnalysis(uploaded);
      }
      
    } catch (error) {
      console.error('Error en subida masiva:', error);
      setError(error.message || 'Error al subir archivos');
      setUploading(false);
    }
  };

  // Detectar separaciones en un PDF
  const detectSeparations = async (pdfFile, filesToUse = null) => {
    if (!token) {
      setError('No hay token de autenticación');
      return;
    }

    setProcessing(true);
    setError(null);

    // Usar filesToUse si se proporciona, sino usar uploadedFiles del estado
    const filesForSeparation = filesToUse || uploadedFiles;

    try {
      console.log(`🔍 Detectando separaciones en PDF: ${pdfFile.fileName}`);
      const pdfFileUrl = pdfFile.fileURL || (pdfFile.fileId ? await getDownloadUrl(pdfFile.fileId) : null);

      const apiUrl = `${import.meta.env.VITE_API_URL}/api/pdf-separations/detect`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          pdfUrl: pdfFileUrl,
          fileName: pdfFile.fileName,
          companyId: finalCompanyId, // Siempre la empresa principal
          activeCompanyId: activeCompanyId || mainCompanyId, // Empresa/cliente activo
          mainCompanyId: mainCompanyId // Empresa principal
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error detectando separaciones');
      }

      const data = await response.json();
      
      if (data.success) {
        // Si hay separaciones detectadas, mostrar modal de revisión
        if (data.separations && data.separations.length > 0) {
          console.log(`✅ Separaciones detectadas: ${data.separations.length} sugerencias`);
          
          // Mostrar modal de revisión de separaciones
          setSeparationData({
            ...data,
            pdfFile: pdfFile,
            uploadedFiles: filesForSeparation
          });
          setSeparationReviewOpen(true);
        } else if (data.totalPages && data.totalPages > 10) {
          // No hay detecciones automáticas, pero el PDF tiene muchas páginas
          // Ofrecer separación manual
          console.log(`⚠️ No se detectaron separaciones automáticas (PDF escaneado?). PDF tiene ${data.totalPages} páginas, ofreciendo separación manual`);
          
          setSeparationData({
            ...data,
            separations: [], // Sin detecciones automáticas
            pdfFile: pdfFile,
            uploadedFiles: filesForSeparation,
            isManualMode: true // Indicar que es modo manual
          });
          setSeparationReviewOpen(true);
        } else {
          // PDF pequeño o sin separaciones, continuar con análisis normal
          console.log('⚠️ No se detectaron separaciones, continuando con análisis normal');
          setCurrentStep('analyzing');
          prepareAnalysis(filesForSeparation.length > 0 ? filesForSeparation : uploadedFiles);
        }
      } else {
        // Error en detección, continuar con análisis normal
        console.log('⚠️ Error en detección de separaciones, continuando con análisis normal');
        setCurrentStep('analyzing');
        prepareAnalysis(filesForSeparation.length > 0 ? filesForSeparation : uploadedFiles);
      }
      
    } catch (err) {
      console.warn('⚠️ Error detectando separaciones, continuando con análisis normal:', err);
      // Continuar con análisis normal si falla la detección
      setCurrentStep('analyzing');
      // Usar filesToUse si está disponible, sino uploadedFiles del estado
      prepareAnalysis(filesForSeparation.length > 0 ? filesForSeparation : uploadedFiles);
    } finally {
      setProcessing(false);
    }
  };

  // Confirmar separación y separar PDF
  const handleConfirmSeparation = async (separationPages) => {
    if (!token || !separationData) {
      setError('Datos de separación no disponibles');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const splitFile = separationData.pdfFile;
      const splitFileUrl = splitFile.fileURL || (splitFile.fileId ? await getDownloadUrl(splitFile.fileId) : null);
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/pdf-separations/split`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          pdfUrl: splitFileUrl,
          fileName: separationData.pdfFile.fileName,
          separationPages: separationPages,
          companyId: finalCompanyId, // Siempre la empresa principal
          activeCompanyId: activeCompanyId || mainCompanyId, // Empresa/cliente activo
          mainCompanyId: mainCompanyId, // Empresa principal
          folder: 'temp-uploads'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error separando PDF');
      }

      const data = await response.json();
      
      if (data.success && data.documents && data.documents.length > 0) {
        console.log(`✅ PDF separado en ${data.documents.length} documentos`);
        
        // Reemplazar el PDF original con los documentos separados en uploadedFiles
        const otherFiles = uploadedFiles.filter(f => f.fileName !== separationData.pdfFile.fileName);
        const separatedFiles = data.documents.map(doc => ({
          fileIndex: uploadedFiles.length + doc.index,
          fileName: doc.fileName,
          fileURL: doc.fileURL,
          originalFile: null, // Los documentos separados no tienen originalFile
          uploaded: true
        }));
        
        const newUploadedFiles = [...otherFiles, ...separatedFiles];
        setUploadedFiles(newUploadedFiles);
        
        // Cerrar modal de separación y continuar con análisis
        setSeparationReviewOpen(false);
        setSeparationData(null);
        setCurrentStep('analyzing');
        prepareAnalysis(newUploadedFiles);
      } else {
        throw new Error('No se pudieron separar los documentos');
      }
      
    } catch (err) {
      console.error('❌ Error separando PDF:', err);
      setError(err.message || 'Error al separar PDF');
      setProcessing(false);
    }
  };

  // Cancelar separación y continuar con PDF original
  const handleCancelSeparation = () => {
    setSeparationReviewOpen(false);
    // Usar los archivos del separationData si están disponibles, sino usar uploadedFiles del estado
    const filesToUse = separationData?.uploadedFiles || uploadedFiles;
    setSeparationData(null);
    setCurrentStep('analyzing');
    prepareAnalysis(filesToUse.length > 0 ? filesToUse : uploadedFiles);
  };

  const prepareAnalysis = async (filesToAnalyze) => {
    if (!token) {
      setError('No hay token de autenticación');
      setProcessing(false);
      return;
    }

    // Validar que haya archivos para analizar
    if (!filesToAnalyze || !Array.isArray(filesToAnalyze) || filesToAnalyze.length === 0) {
      console.warn('⚠️ No hay archivos para analizar. Archivos recibidos:', filesToAnalyze);
      setError('No hay archivos para analizar. Por favor, intenta subir los archivos nuevamente.');
      setProcessing(false);
      setUploading(false);
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      console.log('🔍 Preparando análisis de', filesToAnalyze.length, 'archivos...');
      
      const filesData = filesToAnalyze.map(file => ({
        fileURL: file.fileURL,
        fileName: file.fileName
      }));

      // Usar finalCompanyId del contexto
      if (!finalCompanyId) {
        throw new Error('No se encontró el companyId. Por favor, asegúrate de estar autenticado con una empresa asignada.');
      }

      const apiUrl = `${import.meta.env.VITE_API_URL}/api/bulk-upload/prepare`;
      console.log(`🔍 [BulkUpload] Enviando petición a: ${apiUrl}`);
      console.log(`🔍 [BulkUpload] Origen actual: ${window.location.origin}`);
      
      let response;
      try {
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            files: filesData,
            lang: 'spa',
            concurrencyLimit: 3,
            companyId: finalCompanyId, // Siempre la empresa principal
            activeCompanyId: activeCompanyId || mainCompanyId, // Empresa/cliente activo
            mainCompanyId: mainCompanyId // Empresa principal
          })
        });
      } catch (fetchError) {
        console.error('❌ [BulkUpload] Error en fetch:', fetchError);
        
        // Detectar errores de CORS específicamente
        if (fetchError.message.includes('CORS') || fetchError.message.includes('Failed to fetch')) {
          throw new Error(
            'Error de conexión CORS. Por favor, verifica que el servidor esté configurado correctamente. ' +
            `Origen: ${window.location.origin}, API: ${apiUrl}`
          );
        }
        
        throw new Error(`Error de red: ${fetchError.message}`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Si es error 403, probablemente es CORS
        if (response.status === 403) {
          throw new Error(
            'Acceso denegado por CORS. Por favor, contacta al administrador. ' +
            `Origen: ${window.location.origin}`
          );
        }
        
        throw new Error(errorData.error || `Error al preparar análisis (${response.status})`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error('La preparación falló');
      }

      console.log('✅ Preparación completada:', data.suggestions.length, 'sugerencias');
      
      // Combinar resultados con archivos originales
      const combinedResults = data.suggestions.map(suggestion => {
        const originalFile = filesToAnalyze.find(f => f.fileName === suggestion.fileName)?.originalFile;
        return {
          ...suggestion,
          suggestion: suggestion, // Mantener estructura esperada por BulkUploadReview
          originalFile,
          text: suggestion.text || '',
          words: suggestion.words || [],
          error: suggestion.error || null,
          success: suggestion.success !== false // Por defecto true si no se especifica
        };
      });

      setClassificationResults({
        suggestions: combinedResults,
        groups: data.groups || [],
        analysisId: data.analysisId
      });

      setCurrentStep('review');
      
    } catch (err) {
      console.error('❌ Error en preparación:', err);
      setError(err.message || 'Error al preparar análisis');
    } finally {
      setProcessing(false);
      setUploading(false);
    }
  };

  const handleReviewComplete = (results) => {
    if (onUploadComplete) {
      onUploadComplete(results);
    }
    handleClose();
  };

  const handleClose = () => {
    if (!uploading && !processing) {
      setSelectedFiles([]);
      setUploadedFiles([]);
      setUploadProgress({});
      setError(null);
      setCurrentStep('selection');
      setClassificationResults(null);
      setSeparationReviewOpen(false);
      setSeparationData(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onClose();
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Vista de revisión de separaciones
  if (separationReviewOpen && separationData) {
    return (
      <PdfSeparationReview
        open={true}
        onClose={handleCancelSeparation}
        pdfUrl={separationData.pdfFile.fileURL}
        fileName={separationData.pdfFile.fileName}
        totalPages={separationData.totalPages}
        separations={separationData.separations}
        pageAnalyses={separationData.pageAnalyses}
        onConfirm={handleConfirmSeparation}
        onCancel={handleCancelSeparation}
      />
    );
  }

  // Vista de revisión
  if (currentStep === 'review' && classificationResults) {
    return (
      <BulkUploadReview
        open={true}
        onClose={handleClose}
        analysisResults={classificationResults.suggestions}
        groups={classificationResults.groups}
        onComplete={handleReviewComplete}
        entityType={entityType}
        companyId={finalCompanyId}
      />
    );
  }

  // Vista de análisis en progreso
  if (currentStep === 'analyzing') {
    return (
      <Dialog
        open={true}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Preparando análisis...
        </DialogTitle>
        <DialogContent dividers>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ textAlign: 'center', py: 4 }}>
            {processing ? (
              <>
                <CircularProgress sx={{ mb: 2 }} />
                <Typography variant="body1" gutterBottom>
                  Analizando {uploadedFiles.length} archivo(s) con OCR y clasificando...
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Esto puede tomar unos momentos...
                </Typography>
                <LinearProgress sx={{ mt: 3 }} />
              </>
            ) : (
              <Typography variant="body1">
                Procesando...
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={processing}>
            Cancelar
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  // Vista de selección de archivos (por defecto)
  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        Carga masiva de documentos
      </DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {!bulkUploadAnalysisEnabled && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            La carga masiva con análisis automático está deshabilitada temporalmente. Usa el flujo manual de carga
            y aprobación por documento.
          </Alert>
        )}

        {/* Zona de drag & drop */}
        <Paper
          sx={{
            p: 4,
            border: '2px dashed',
            borderColor: dragActive ? 'primary.main' : 'grey.300',
            backgroundColor: dragActive ? 'action.hover' : 'background.paper',
            cursor: 'pointer',
            transition: 'all 0.3s',
            mb: 2
          }}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Box sx={{ textAlign: 'center' }}>
            <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Arrastra archivos aquí o haz clic para seleccionar
            </Typography>
            <Typography variant="body2" color="text.secondary">
              PDF, JPG, PNG (máx. 400MB por archivo)
            </Typography>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
            />
          </Box>
        </Paper>

        {/* Lista de archivos seleccionados */}
        {selectedFiles.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Archivos seleccionados ({selectedFiles.length})
            </Typography>
            <List dense>
              {selectedFiles.map((file, index) => {
                const progress = uploadProgress[index];
                return (
                  <ListItem key={index} sx={{ border: '1px solid', borderColor: 'divider', mb: 1, borderRadius: 1 }}>
                    <FileUploadIcon sx={{ mr: 2, color: 'text.secondary' }} />
                    <ListItemText
                      primary={file.name}
                      secondary={formatFileSize(file.size)}
                    />
                    {progress && progress.uploading && (
                      <Box sx={{ width: 150, mr: 2 }}>
                        <LinearProgress variant="determinate" value={progress.progress || 0} />
                      </Box>
                    )}
                    {progress && progress.success && (
                      <CheckCircleIcon sx={{ mr: 2, color: 'success.main' }} />
                    )}
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => removeFile(index)}
                        disabled={progress?.uploading}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                );
              })}
            </List>
          </Box>
        )}

        {/* Progreso general */}
        {uploading && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Subiendo archivos...
            </Typography>
            <LinearProgress />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={uploading}>
          Cancelar
        </Button>
        <Button
          onClick={handleUpload}
          variant="contained"
          startIcon={<CloudUploadIcon />}
          disabled={selectedFiles.length === 0 || uploading || !bulkUploadAnalysisEnabled}
        >
          {uploading ? 'Subiendo...' : `Subir ${selectedFiles.length} archivo(s)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
