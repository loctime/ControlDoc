// src/entidad/user/components/BulkUploadReview.jsx
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Chip,
  LinearProgress,
  Tooltip,
  IconButton,
  Dialog as PreviewDialog,
  DialogTitle as PreviewDialogTitle,
  DialogContent as PreviewDialogContent,
  DialogActions as PreviewDialogActions
} from '@mui/material';
import {
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Upload as UploadIcon,
  Visibility as VisibilityIcon,
  HelpOutline as HelpIcon,
  Close as CloseIcon,
  PictureAsPdf as PdfIcon,
  Image as ImageIcon
} from '@mui/icons-material';
import { useAuth } from '../../../context/AuthContext';
import useDashboardDataQuery from './hooks/useDashboardDataQuery';
import { uploadFile } from '../../../utils/FileUploadService';
import { getAuth } from 'firebase/auth';
import TextSelectorDialog from './TextSelectorDialog';
import VistaPrevia from '../../../components/common/VistaPrevia';

export default function BulkUploadReview({
  open,
  onClose,
  analysisResults,
  groups,
  onComplete,
  entityType,
  companyId
}) {
  const [editableResults, setEditableResults] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [error, setError] = useState(null);
  const [textSelectorOpen, setTextSelectorOpen] = useState(false);
  const [selectedFileIndex, setSelectedFileIndex] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  // Guardar resultados originales para comparación de feedback
  const [originalResults] = useState(analysisResults || []);
  // Guardar selecciones de texto por archivo
  const [textSelections, setTextSelections] = useState({});
  const { token, activeCompanyId, mainCompanyId } = useAuth();
  // IMPORTANTE: companyId siempre debe ser mainCompanyId (empresa principal), nunca cambia
  // Lo que cambia es activeCompanyId cuando seleccionas un cliente
  const finalCompanyId = companyId || mainCompanyId;
  const auth = getAuth();

  // Cargar documentos requeridos y entidades
  const { requiredDocuments, personal, vehiculos } = useDashboardDataQuery(finalCompanyId);

  useEffect(() => {
    if (analysisResults && analysisResults.length > 0) {
      // Inicializar resultados editables
      setEditableResults(analysisResults.map(result => ({
        ...result,
        editMode: false,
        textSelections: [] // Inicializar array de selecciones
      })));
    }
  }, [analysisResults]);

  const handleEdit = (index) => {
    setEditableResults(prev => prev.map((r, i) => ({
      ...r,
      editMode: i === index ? !r.editMode : false
    })));
  };

  const handleFieldChange = (index, field, value) => {
    setEditableResults(prev => prev.map((r, i) => {
      if (i === index) {
        return {
          ...r,
          suggestion: {
            ...r.suggestion,
            [field]: value
          }
        };
      }
      return r;
    }));
  };

  const getRequiredDocumentsByType = (type) => {
    return requiredDocuments.filter(doc => doc.entityType === type);
  };

  const getEntitiesByType = (type) => {
    if (type === 'employee' || type === 'personal') {
      return personal || [];
    } else if (type === 'vehicle' || type === 'vehiculo') {
      return vehiculos || [];
    }
    return [];
  };

  /**
   * Guarda feedback de correcciones del usuario
   */
  const saveClassificationFeedback = async (original, corrected, textSelections = []) => {
    try {
      const user = auth.currentUser;
      if (!user || !token) {
        console.warn('[Feedback] No hay usuario autenticado para guardar feedback');
        return;
      }

      const feedbackData = {
        timestamp: new Date().toISOString(),
        companyId: finalCompanyId,
        originalSuggestion: {
          requiredDocumentId: original.suggestion?.requiredDocumentId || null,
          requiredDocumentName: original.suggestion?.requiredDocumentName || null,
          confidence: original.suggestion?.confidence || 0,
          detectedFields: original.suggestion?.detectedFields || {},
          text: original.text || '',
          entityId: original.suggestion?.entityId || null,
          entityName: original.suggestion?.entityName || null
        },
        userCorrection: {
          requiredDocumentId: corrected.suggestion?.requiredDocumentId || null,
          requiredDocumentName: corrected.suggestion?.requiredDocumentName || null,
          entityId: corrected.suggestion?.entityId || null,
          entityName: corrected.suggestion?.entityName || null,
          detectedFields: corrected.suggestion?.detectedFields || {}
        },
        fileName: corrected.fileName || original.fileName || 'unknown',
        fileURL: corrected.fileURL || original.fileURL || null,
        textExtracted: corrected.text || original.text || '',
        words: corrected.words || original.words || [],
        textSelections: textSelections || []
      };

      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/feedback/classify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(feedbackData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn('[Feedback] Error guardando feedback:', errorData.error || response.statusText);
        return;
      }

      const result = await response.json();
      if (result.success) {
        console.log(`[Feedback] Feedback guardado exitosamente para ${corrected.fileName}`);
      }

    } catch (error) {
      console.error('[Feedback] Error guardando feedback:', error);
      // No fallar la subida si el feedback falla
    }
  };

  /**
   * Detecta si hubo correcciones comparando original con corregido
   */
  const detectCorrections = (original, corrected) => {
    if (!original || !corrected) return false;

    const originalSuggestion = original.suggestion || {};
    const correctedSuggestion = corrected.suggestion || {};

    // Detectar cambios
    const documentChanged = originalSuggestion.requiredDocumentId !== correctedSuggestion.requiredDocumentId;
    const entityChanged = originalSuggestion.entityId !== correctedSuggestion.entityId;
    const fieldsChanged = JSON.stringify(originalSuggestion.detectedFields || {}) !== 
                         JSON.stringify(correctedSuggestion.detectedFields || {});
    const hasTextSelections = corrected.textSelections && corrected.textSelections.length > 0;

    return documentChanged || entityChanged || fieldsChanged || hasTextSelections;
  };

  const handleFinalUpload = async () => {
    if (!auth.currentUser) {
      setError('No hay usuario autenticado');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress({});

    const uploadResults = [];

    try {
      for (let i = 0; i < editableResults.length; i++) {
        const result = editableResults[i];
        const suggestion = result.suggestion || {};
        
        // Saltar archivos que fallaron en OCR
        if (result.error || result.success === false) {
          console.warn(`Saltando archivo con error: ${result.fileName} - ${result.error}`);
          continue;
        }
        
        if (!result.originalFile) {
          console.warn(`No hay archivo original para ${result.fileName}`);
          continue;
        }

        if (!suggestion.requiredDocumentId) {
          setError(`El archivo "${result.fileName}" no tiene un documento requerido asignado`);
          setUploading(false);
          return;
        }

        setUploadProgress(prev => ({
          ...prev,
          [i]: { uploading: true, progress: 0, fileName: result.fileName }
        }));

        try {
          // Detectar si hubo correcciones antes de subir
          const originalResult = originalResults.find(or => or.fileName === result.fileName) || originalResults[i];
          const hasCorrections = detectCorrections(originalResult, result);

          // Si hubo correcciones, guardar feedback
          if (hasCorrections && originalResult) {
            await saveClassificationFeedback(
              originalResult,
              result,
              result.textSelections || []
            );
          }

          // Preparar metadata para subida
          const requiredDoc = requiredDocuments.find(d => d.id === suggestion.requiredDocumentId);
          
          // IMPORTANTE: Usar mainCompanyId como companyId (siempre la empresa principal)
          // El backend calculará clientId basándose en activeCompanyId vs mainCompanyId
          const metadata = {
            documentType: suggestion.requiredDocumentId,
            name: requiredDoc?.name || result.fileName.split('.')[0],
            companyId: mainCompanyId || finalCompanyId, // Siempre la empresa principal
            activeCompanyId: activeCompanyId || mainCompanyId, // Empresa/cliente activo
            mainCompanyId: mainCompanyId, // Empresa principal
            entityType: suggestion.entityType || 'company',
            entityId: suggestion.entityId || null,
            entityName: suggestion.entityName || null,
            expirationDate: requiredDoc?.expirationDate || requiredDoc?.deadline?.date || null
          };

          // Subir archivo usando el endpoint existente
          const uploadResult = await uploadFile(
            result.originalFile,
            'companyDocuments',
            metadata
          );

          uploadResults.push({
            ...result,
            uploadResult,
            success: true
          });

          setUploadProgress(prev => ({
            ...prev,
            [i]: { uploading: false, progress: 100, fileName: result.fileName, success: true }
          }));

        } catch (err) {
          console.error(`Error subiendo archivo ${result.fileName}:`, err);
          setUploadProgress(prev => ({
            ...prev,
            [i]: { uploading: false, progress: 0, fileName: result.fileName, error: err.message }
          }));
          uploadResults.push({
            ...result,
            success: false,
            error: err.message
          });
        }
      }

      const successful = uploadResults.filter(r => r.success);
      
      if (successful.length === 0) {
        setError('No se pudo subir ningún archivo');
        setUploading(false);
        return;
      }

      console.log(`✅ Subida masiva completada: ${successful.length}/${uploadResults.length} exitosos`);

      if (onComplete) {
        onComplete(uploadResults);
      }

      // Cerrar después de un breve delay
      setTimeout(() => {
        handleClose();
      }, 1000);

    } catch (error) {
      console.error('Error en subida masiva:', error);
      setError(error.message || 'Error al subir archivos');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setEditableResults([]);
      setUploadProgress({});
      setError(null);
      onClose();
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.7) return 'success';
    if (confidence >= 0.4) return 'warning';
    return 'error';
  };

  // Función para truncar nombres de archivo largos
  const truncateFileName = (fileName, maxLength = 45) => {
    if (!fileName || fileName.length <= maxLength) return fileName;
    const ext = fileName.split('.').pop();
    const name = fileName.substring(0, fileName.lastIndexOf('.'));
    const truncated = name.substring(0, maxLength - ext.length - 4) + '...';
    return `${truncated}.${ext}`;
  };

  // Función para obtener tipo MIME del archivo
  const getFileType = (fileName) => {
    if (!fileName) return null;
    if (fileName.toLowerCase().endsWith('.pdf')) return 'application/pdf';
    if (/\.(jpg|jpeg)$/i.test(fileName)) return 'image/jpeg';
    if (fileName.toLowerCase().endsWith('.png')) return 'image/png';
    if (fileName.toLowerCase().endsWith('.webp')) return 'image/webp';
    return null;
  };

  // Función para abrir preview
  const handlePreview = (result) => {
    if (result.fileURL || result.originalFile) {
      const fileUrl = result.fileURL || (result.originalFile ? URL.createObjectURL(result.originalFile) : null);
      if (fileUrl) {
        setPreviewFile({
          url: fileUrl,
          name: result.fileName,
          type: getFileType(result.fileName),
          isBlob: !result.fileURL // Si no tiene fileURL, es un blob
        });
        setPreviewOpen(true);
      }
    }
  };

  // Función para cerrar preview y limpiar blobs
  const handleClosePreview = () => {
    if (previewFile && previewFile.isBlob && previewFile.url.startsWith('blob:')) {
      URL.revokeObjectURL(previewFile.url);
    }
    setPreviewOpen(false);
    setPreviewFile(null);
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="xl"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6">Revisar y confirmar clasificación</Typography>
              <Tooltip 
                title={
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>
                      ¿Cómo funcionan las sugerencias?
                    </Typography>
                    <Typography variant="caption" component="div" sx={{ fontSize: '0.75rem', lineHeight: 1.6 }}>
                      1. El sistema extrae texto de cada archivo usando OCR<br/>
                      2. Compara el texto con archivos de ejemplo de documentos requeridos<br/>
                      3. Sugiere el documento con mayor similitud (confianza %)<br/>
                      4. Puedes editar cualquier sugerencia antes de confirmar
                    </Typography>
                  </Box>
                }
                arrow
                placement="right"
              >
                <IconButton size="small" color="primary" sx={{ ml: 0.5 }}>
                  <HelpIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Revisa las sugerencias y ajusta si es necesario. Luego confirma para subir todos los documentos.
        </Typography>

        <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 220, fontWeight: 'bold' }}>Archivo</TableCell>
                <TableCell sx={{ minWidth: 200, fontWeight: 'bold' }}>Tipo de Documento</TableCell>
                <TableCell sx={{ minWidth: 150, fontWeight: 'bold' }}>Entidad</TableCell>
                <TableCell sx={{ minWidth: 130, fontWeight: 'bold' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Confianza
                    <Tooltip 
                      title="Porcentaje de similitud entre el archivo y el documento requerido sugerido. Verde ≥70% (alta), Amarillo 40-69% (media), Rojo <40% (baja)"
                      arrow
                    >
                      <HelpIcon fontSize="small" sx={{ cursor: 'help', opacity: 0.6 }} />
                    </Tooltip>
                  </Box>
                </TableCell>
                <TableCell sx={{ minWidth: 180, fontWeight: 'bold' }}>Campos Detectados</TableCell>
                <TableCell sx={{ minWidth: 120, fontWeight: 'bold' }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {editableResults.map((result, index) => {
                const suggestion = result.suggestion || {};
                const progress = uploadProgress[index];
                const requiredDocsForType = getRequiredDocumentsByType(suggestion.entityType || 'company');
                const entitiesForType = getEntitiesByType(suggestion.entityType || 'company');
                const hasError = result.error || result.success === false;

                const confidence = (suggestion.confidence || 0) * 100;
                const confidenceColor = getConfidenceColor(suggestion.confidence || 0);

                return (
                  <TableRow 
                    key={index} 
                    sx={{
                      ...(hasError && { backgroundColor: 'error.light', opacity: 0.7 }),
                      '&:hover': { backgroundColor: 'action.hover' }
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {(result.fileURL || result.originalFile) && (
                          <Tooltip title="Ver documento">
                            <IconButton
                              size="small"
                              onClick={() => handlePreview(result)}
                              sx={{ 
                                color: 'primary.main',
                                p: 0.5
                              }}
                            >
                              {getFileType(result.fileName) === 'application/pdf' ? (
                                <PdfIcon fontSize="small" />
                              ) : (
                                <ImageIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                        )}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Tooltip title={result.fileName} arrow>
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                fontWeight: 500,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {truncateFileName(result.fileName, 40)}
                            </Typography>
                          </Tooltip>
                        </Box>
                      </Box>
                      {hasError && (
                        <Chip 
                          label={`Error: ${result.error || 'Error al procesar'}`} 
                          size="small" 
                          color="error" 
                          sx={{ mt: 0.5 }} 
                        />
                      )}
                      {progress && progress.uploading && (
                        <LinearProgress size="small" sx={{ mt: 1 }} />
                      )}
                      {progress && progress.success && (
                        <Chip icon={<CheckCircleIcon />} label="Subido" size="small" color="success" sx={{ mt: 0.5 }} />
                      )}
                      {progress && progress.error && (
                        <Chip label="Error" size="small" color="error" sx={{ mt: 0.5 }} />
                      )}
                    </TableCell>
                    <TableCell>
                      {hasError ? (
                        <Typography variant="body2" color="error">
                          No procesado
                        </Typography>
                      ) : result.editMode ? (
                        <FormControl fullWidth size="small">
                          <Select
                            value={suggestion.requiredDocumentId || ''}
                            onChange={(e) => handleFieldChange(index, 'requiredDocumentId', e.target.value)}
                          >
                            {requiredDocsForType.map(doc => (
                              <MenuItem key={doc.id} value={doc.id}>
                                {doc.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      ) : (
                        <Box>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontWeight: suggestion.requiredDocumentName ? 500 : 400,
                              color: suggestion.requiredDocumentName ? 'text.primary' : 'text.secondary',
                              fontStyle: !suggestion.requiredDocumentName && 'italic'
                            }}
                          >
                            {suggestion.requiredDocumentName || 'Sin clasificar'}
                          </Typography>
                          {!suggestion.requiredDocumentName && (
                            <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
                              Requiere asignación manual
                            </Typography>
                          )}
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>
                      {result.editMode ? (
                        <FormControl fullWidth size="small">
                          <Select
                            value={suggestion.entityId || ''}
                            onChange={(e) => {
                              const entityIdValue = e.target.value;
                              const selectedEntity = entitiesForType.find(entity => entity.id === entityIdValue);
                              handleFieldChange(index, 'entityId', entityIdValue);
                              if (selectedEntity) {
                                handleFieldChange(index, 'entityName', 
                                  selectedEntity.nombre || selectedEntity.patente || ''
                                );
                              }
                            }}
                          >
                            <MenuItem value="">Ninguna (Empresa)</MenuItem>
                            {entitiesForType.map(entity => (
                              <MenuItem key={entity.id} value={entity.id}>
                                {entity.nombre || entity.patente || entity.id}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      ) : (
                        <Typography variant="body2">
                          {suggestion.entityName || suggestion.entityType || 'Empresa'}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Tooltip 
                        title={
                          confidence >= 70 
                            ? "Alta confianza: el sistema está muy seguro de esta sugerencia" 
                            : confidence >= 40 
                            ? "Confianza media: revisa la sugerencia antes de confirmar"
                            : "Baja confianza: probablemente requiera asignación manual"
                        }
                        arrow
                      >
                        <Chip
                          label={`${Math.round(confidence)}%`}
                          size="small"
                          color={confidenceColor}
                          sx={{ fontWeight: 'bold', cursor: 'help' }}
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      {suggestion.detectedFields && Object.keys(suggestion.detectedFields).length > 0 ? (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: 250 }}>
                          {Object.entries(suggestion.detectedFields).slice(0, 2).map(([key, value]) => (
                            <Tooltip key={key} title={`${key}: ${value}`} arrow>
                              <Chip
                                label={`${key}: ${String(value).substring(0, 15)}${String(value).length > 15 ? '...' : ''}`}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.7rem' }}
                              />
                            </Tooltip>
                          ))}
                          {Object.keys(suggestion.detectedFields).length > 2 && (
                            <Tooltip 
                              title={Object.entries(suggestion.detectedFields).slice(2).map(([k, v]) => `${k}: ${v}`).join(', ')} 
                              arrow
                            >
                              <Chip
                                label={`+${Object.keys(suggestion.detectedFields).length - 2}`}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.7rem' }}
                              />
                            </Tooltip>
                          )}
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Ninguno
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Ver documento completo">
                          <IconButton
                            size="small"
                            onClick={() => handlePreview(result)}
                            disabled={uploading || !(result.fileURL || result.originalFile)}
                            color="primary"
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={result.editMode ? "Guardar cambios" : "Editar clasificación"}>
                          <IconButton
                            size="small"
                            onClick={() => handleEdit(index)}
                            disabled={uploading}
                            color={result.editMode ? "primary" : "default"}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {groups && groups.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Documentos agrupados por similitud:
            </Typography>
            {groups.map((group, idx) => (
              <Chip
                key={idx}
                label={`Grupo ${idx + 1}: ${group.fileIndices.length} archivos`}
                size="small"
                sx={{ mr: 1, mb: 1 }}
              />
            ))}
          </Box>
        )}

        {/* Dialog para selector de texto */}
        {textSelectorOpen && selectedFileIndex !== null && editableResults[selectedFileIndex] && (
          <TextSelectorDialog
            open={textSelectorOpen}
            onClose={() => {
              setTextSelectorOpen(false);
              setSelectedFileIndex(null);
            }}
            fileData={editableResults[selectedFileIndex]}
            onSelect={(field, value, selectionMetadata) => {
              const index = selectedFileIndex;
              setEditableResults(prev => prev.map((r, i) => {
                if (i === index) {
                  // Guardar selección de texto con metadata completa
                  const newTextSelections = [...(r.textSelections || []), {
                    field,
                    selectedText: value,
                    ...selectionMetadata // wordIndex, bbox, etc.
                  }];
                  
                  return {
                    ...r,
                    suggestion: {
                      ...r.suggestion,
                      detectedFields: {
                        ...(r.suggestion?.detectedFields || {}),
                        [field]: value
                      }
                    },
                    textSelections: newTextSelections
                  };
                }
                return r;
              }));
              setTextSelectorOpen(false);
              setSelectedFileIndex(null);
            }}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={uploading}>
          Cancelar
        </Button>
        <Button
          onClick={handleFinalUpload}
          variant="contained"
          startIcon={<UploadIcon />}
          disabled={uploading || editableResults.length === 0}
        >
          {uploading ? 'Subiendo...' : `Confirmar y subir ${editableResults.length} archivo(s)`}
        </Button>
      </DialogActions>
    </Dialog>

    {/* Dialog de preview */}
    {previewOpen && previewFile && (
      <PreviewDialog
        open={previewOpen}
        onClose={handleClosePreview}
        maxWidth="lg"
        fullWidth
      >
        <PreviewDialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">{previewFile.name}</Typography>
            <IconButton onClick={handleClosePreview} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </PreviewDialogTitle>
        <PreviewDialogContent>
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', minHeight: '60vh' }}>
            <VistaPrevia
              url={previewFile.url}
              fileType={previewFile.type}
              titulo={previewFile.name}
              width="100%"
              height="70vh"
            />
          </Box>
        </PreviewDialogContent>
        <PreviewDialogActions>
          <Button onClick={handleClosePreview}>Cerrar</Button>
        </PreviewDialogActions>
      </PreviewDialog>
    )}
    </>
  );
}

