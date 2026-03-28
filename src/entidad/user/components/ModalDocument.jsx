//src/entidad/user/components/ModalDocument.jsx
import React, { useState, useEffect } from 'react';
import {
  // ...otros imports
  serverTimestamp,
  collection, addDoc, updateDoc, doc, query, where, getDocs
} from 'firebase/firestore';
import { db } from '../../../config/firebaseconfig';
import { getTenantCollectionPath } from '../../../utils/tenantUtils';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, Typography, Box, Paper, TextField, Button, CircularProgress, Snackbar, Alert, Tooltip
} from '@mui/material';
import { UploadFile as UploadFileIcon } from '@mui/icons-material';
import DownloadButton from '../../../components/common/DownloadButton';
import { useFileUrl } from '../../../hooks/useFileUrl';
import VistaPrevia from '../../../components/common/VistaPrevia';
import { approveDocument, rejectDocument, updateDocumentOnUpload } from "../../../utils/MetadataService";
import { useAuth } from '../../../context/AuthContext';
import {
  ENTITY_TYPE_LABELS,
  STATUS_COLOR_MAP,
  buildMailtoHref,
  buildSubtitleSegments,
  formatExpiration,
  formatLatestUpdate,
  normalizeStatus,
  resolveDateValue,
} from "./ModalDocument/helpers";
import { LatestDocumentSection } from "./ModalDocument/LatestDocumentSection";

// Componente principal: Modal para subir documentos (con conversión opcional a PDF)
export default function ModalDocumentWithConversion({
  open,              // Booleano: controla si el modal está abierto
  onClose,           // Función: cerrar el modal
  selectedDocument,  // Objeto: documento seleccionado para subir
  currentUser,       // Objeto: usuario actual
  onUploadSuccess,   // Función: callback al subir con éxito
  entityType,        // String: tipo de entidad (ej. 'empresa')
  entityName,        // String: nombre de la entidad
  latestUploadedDoc, // Objeto: última versión aprobada/rechazada
}) {
  console.log('[ModalDocument] 🔄 Componente renderizado con props:', {
    open,
    selectedDocumentId: selectedDocument?.id,
    selectedDocumentName: selectedDocument?.name,
    currentUserId: currentUser?.uid,
    currentUserEmail: currentUser?.email,
    entityType,
    entityName
  });
  // Estados locales para manejar comentarios, archivos y feedback de UI
  const [companyComment, setCompanyComment] = useState('');   // Comentario de la empresa
  const [exampleComment, setExampleComment] = useState('');   // Comentario de ejemplo (no editable, pero definido por compatibilidad)
  const [adminComment, setAdminComment] = useState('');       // Comentario de administrador
  const [fileMap, setFileMap] = useState({});                 // Archivos seleccionados por id de documento
  const [previewMap, setPreviewMap] = useState({});           // URLs de vista previa de archivos
  const [previewTypeMap, setPreviewTypeMap] = useState({});   // Tipos MIME de archivos para vista previa
  const [uploading, setUploading] = useState(false);          // Estado de carga
  const [error, setError] = useState(null);                   // Mensaje de error
  const [successMsg, setSuccessMsg] = useState('');           // Mensaje de éxito
  const [showSnackbar, setShowSnackbar] = useState(false);    // Controla visibilidad de Snackbar
  const [showLatestDetails, setShowLatestDetails] = useState(false); // Controla colapsable de último documento
  const [isClosing, setIsClosing] = useState(false);          // Evita llamadas duplicadas a handleClose
  const { token, activeCompanyId, mainCompanyId } = useAuth();

  // Función para limpiar el estado del modal
  const handleClose = () => {
    // Evitar llamadas duplicadas
    if (isClosing) {
      console.log('[ModalDocument] ⚠️ handleClose ya en ejecución, ignorando llamada duplicada');
      return;
    }
    
    console.log('[ModalDocument] 🧹 handleClose ejecutándose - limpiando estados...');
    console.log('[ModalDocument] 📊 Estados antes de limpiar:', {
      fileMapKeys: Object.keys(fileMap),
      previewMapKeys: Object.keys(previewMap),
      companyComment: companyComment ? 'SÍ' : 'NO',
      error: error ? 'SÍ' : 'NO',
      successMsg: successMsg ? 'SÍ' : 'NO',
      showSnackbar
    });
    
    setIsClosing(true);
    
    // Limpiar URLs de vista previa para evitar memory leaks
    let urlsRevoked = 0;
    Object.values(previewMap).forEach(url => {
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
        urlsRevoked++;
      }
    });
    console.log('[ModalDocument] 🗑️ URLs revocadas:', urlsRevoked);
    
    // Resetear estados
    setCompanyComment('');
    setFileMap({});
    setPreviewMap({});
    setPreviewTypeMap({});
    setError(null);
    setSuccessMsg('');
    setShowSnackbar(false);
    setIsClosing(false);
    
    console.log('[ModalDocument] ✅ Estados limpiados, llamando onClose()');
    
    // Llamar al callback original
    onClose();
  };

  // Función para manejar el cierre del modal (evita llamadas duplicadas)
  const handleModalClose = () => {
    console.log('[ModalDocument] 🚪 handleModalClose llamado (botón cancelar, ESC, o clic fuera)');
    handleClose();
  };

  // Limpiar estado cuando cambia el documento seleccionado
  useEffect(() => {
    if (selectedDocument) {
      console.log('[ModalDocument] 📄 Documento seleccionado cambiado:', {
        id: selectedDocument.id,
        name: selectedDocument.name,
        exampleComment: selectedDocument.exampleComment ? 'SÍ' : 'NO',
        adminComment: selectedDocument.adminComment ? 'SÍ' : 'NO',
        exampleImage: selectedDocument.exampleImage ? 'SÍ' : 'NO'
      });
      
      // Limpiar URLs de vista previa anteriores
      let urlsRevoked = 0;
      Object.values(previewMap).forEach(url => {
        if (url && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
          urlsRevoked++;
        }
      });
      console.log('[ModalDocument] 🗑️ URLs revocadas al cambiar documento:', urlsRevoked);
      
      // Resetear estados para el nuevo documento
      setCompanyComment('');
      setFileMap({});
      setPreviewMap({});
      setPreviewTypeMap({});
      setError(null);
      setSuccessMsg('');
      setShowSnackbar(false);
      
      console.log('[ModalDocument] ✅ Estados reseteados para nuevo documento');
    }
  }, [selectedDocument?.id]); // Solo se ejecuta cuando cambia el ID del documento

  // Asegurar limpieza cuando el modal se cierra
  useEffect(() => {
    console.log('[ModalDocument] 🔍 useEffect open/isClosing:', { open, isClosing });
    if (!open && !isClosing) {
      console.log('[ModalDocument] 🚪 Modal cerrado programáticamente, ejecutando limpieza...');
      handleClose();
    }
  }, [open, isClosing]); // Se ejecuta cuando cambia el estado 'open' o 'isClosing'

  // Limpieza al desmontar el componente
  useEffect(() => {
    return () => {
      console.log('[ModalDocument] 💀 Componente desmontándose, limpiando recursos...');
      // Limpiar URLs de vista previa para evitar memory leaks
      let urlsRevoked = 0;
      Object.values(previewMap).forEach(url => {
        if (url && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
          urlsRevoked++;
        }
      });
      console.log('[ModalDocument] 🗑️ URLs revocadas al desmontar:', urlsRevoked);
    };
  }, []); // Se ejecuta solo al desmontar

  // Función principal para manejar la subida del documento
  const handleUpload = async () => {
    console.log('[ModalDocument] 🚀 handleUpload iniciado');
    
    // Obtener el archivo específico para este documento
    const file = fileMap?.[selectedDocument?.id];
    
    // Validaciones con logs para debugging
    console.log('[ModalDocument] 📋 Validaciones:', {
      selectedDocumentId: selectedDocument?.id,
      selectedDocumentName: selectedDocument?.name,
      fileSelected: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      currentUser: !!currentUser,
      currentUserEmail: currentUser?.email
    });
    console.log('[ModalDocument] 📁 fileMap completo:', fileMap);
    
    if (!selectedDocument) {
      console.error('[ModalDocument] ❌ No hay documento seleccionado');
      return;
    }
    
    if (isProcessState) {
      console.warn('[ModalDocument] ⚠️ Intento de subir mientras el documento está en proceso externo');
      setError('No es posible subir un nuevo archivo mientras la revisión externa está en curso. Contacta al administrador.');
      setShowSnackbar(true);
      return;
    }

    if (!file) {
      console.error('[ModalDocument] ❌ No hay archivo seleccionado para el documento:', selectedDocument.id);
      setError('Por favor selecciona un archivo para subir');
      setShowSnackbar(true);
      return;
    }
    
    if (!currentUser) {
      console.error('[ModalDocument] ❌ No hay usuario autenticado');
      return;
    }

    console.log('[ModalDocument] ⏳ Iniciando proceso de subida...');
    setUploading(true);
    setError(null);
    setSuccessMsg('');
    setShowSnackbar(false);

    try {
      // Armado de metadatos para la subida  
      console.log('[ModalDocument] 📝 Preparando metadatos...');
      
      // IMPORTANTE: Usar siempre mainCompanyId como companyId (empresa principal, nunca cambia)
      // Obtener nombre de empresa de localStorage como fallback
      const userCompanyData = JSON.parse(localStorage.getItem("userCompany") || '{}');
      const realCompanyName = userCompanyData?.companyName || userCompanyData?.name || 'unknown';
      
      if (!mainCompanyId) {
        throw new Error('No se encontró la empresa principal. Por favor, vuelve a iniciar sesión.');
      }
      
      console.log('[ModalDocument] 🏢 Datos de empresa obtenidos - usando mainCompanyId como companyId');
      
      const metadata = {
        documentType: selectedDocument.id,
        name: selectedDocument.name || file.name.split('.')[0],
        companyComment: companyComment,
        companyName: realCompanyName,
        companyId: mainCompanyId, // Siempre la empresa principal
        activeCompanyId: activeCompanyId || mainCompanyId, // Empresa/cliente activo
        mainCompanyId: mainCompanyId, // Empresa principal
        expirationDate: selectedDocument?.expirationDate || selectedDocument?.vencimiento || selectedDocument?.deadline?.date || null,
        entityType,
        entityId: selectedDocument?.entityId,
        entityClientId: selectedDocument?.entityClientId ?? undefined, // Cliente de la entidad (persona/vehículo); mantiene el cliente al subir desde vista principal
        exampleComment: selectedDocument?.exampleComment || '',
        adminComment: selectedDocument?.adminComment || adminComment,
        email: currentUser.email || '',
        uploadedByEmail: currentUser.email || '',
        uploadedAt: serverTimestamp(),
        entityName,
      };
      console.log('[ModalDocument] 📋 Metadatos preparados:', metadata);

      let fileToUpload = file;
      if (['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        console.log('[DEBUG] Entrando a optimización de imagen, tipo:', file.type);
        try {
          console.log('[ModalDocument] ⏳ Enviando imagen a optimización backend...');
          const formData = new FormData();
          formData.append('image', file);
          // Parámetros de optimización conservadores para preservar texto
          formData.append('quality', '95'); // Alta calidad
          formData.append('maxWidth', '2048'); // Resolución máxima para OCR
          formData.append('maxHeight', '2048');
          formData.append('enhanceForOCR', 'false'); // Desactivar mejoras agresivas
          formData.append('preserveText', 'true'); // Preservar legibilidad del texto
          
          const response = await fetch(`${import.meta.env.VITE_API_URL}/api/optimize-upload`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData
          });
          if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Error optimizando imagen');
          }
          const blob = await response.blob();
          fileToUpload = new File([blob], file.name, { type: blob.type });
          console.log('[ModalDocument] ✅ Imagen optimizada para OCR, tamaño:', fileToUpload.size);
        } catch (err) {
          console.warn('[ModalDocument] ⚠️ Error optimizando imagen, se sube original:', err);
          fileToUpload = file;
        }
      }

      // Subida de archivo (usa fileToUpload en vez de file)
      console.log('[ModalDocument] 📤 Iniciando subida de archivo...');
      console.log('[ModalDocument] 📁 Archivo a subir:', {
        name: fileToUpload.name,
        size: fileToUpload.size,
        type: fileToUpload.type,
        lastModified: fileToUpload.lastModified
      });
      const { uploadFile } = await import('../../../utils/FileUploadService');
      const result = await uploadFile(fileToUpload, 'companyDocuments', metadata);
      console.log('[ModalDocument] ✅ Archivo subido exitosamente:', {
        url: result.url,
        fileName: result.fileName,
        originalName: fileToUpload.name
      });
      
      // El backend ya maneja la creación en uploadedDocuments, no necesitamos crear otro

      // Actualizar archivoSubido en requiredDocuments para que AdminDashboard lo detecte correctamente
      if (selectedDocument?.id) {
        try {
          const requiredDocumentsPath = getTenantCollectionPath('requiredDocuments');
          const requiredDocRef = doc(db, requiredDocumentsPath, selectedDocument.id);
          
          // Actualizar solo archivoSubido, sin afectar otros campos globales
          await updateDoc(requiredDocRef, {
            archivoSubido: true,
            status: "Subido"
          });
          
          console.log('[ModalDocument] ✅ Actualizado archivoSubido en requiredDocuments:', {
            docId: selectedDocument.id,
            entityId: metadata.entityId,
            entityType: metadata.entityType
          });
        } catch (updateError) {
          // Si falla la actualización, no es crítico - la lógica de coincidencia en AdminDashboard también funciona
          console.warn('[ModalDocument] ⚠️ Error actualizando archivoSubido:', {
            error: updateError.message,
            docId: selectedDocument.id
          });
        }
      }

      // Si todo fue bien, muestra mensaje de éxito y ejecuta callback de éxito
      console.log('[ModalDocument] 🎉 Proceso completado exitosamente');
      
      // Ejecutar callback inmediatamente para propagar la actualización UI
      if (onUploadSuccess) {
        console.log('[ModalDocument] 📞 Ejecutando callback onUploadSuccess inmediatamente...');
        // Esperar un poco para que el backend complete la escritura en Firestore
        await new Promise(resolve => setTimeout(resolve, 500));
        onUploadSuccess({ 
          ...result, 
          documentType: selectedDocument.id, 
          fileName: selectedDocument.name, 
          fileComment: companyComment, 
          entityType, 
          entityName
        });
      }
      
      setSuccessMsg('¡Documento subido correctamente!');
      setShowSnackbar(true);
      
      // Cerrar modal inmediatamente para permitir propagación real-time
      console.log('[ModalDocument] ⏰ Cierre inmediato del modal para propagación en tiempo real');
      // Callback se ejecuta inmediatamente (línea 323-333), el onSnapshot REAL-TIME debe actualizar la UI
      setTimeout(handleClose, 200); // Cierre mínimo de 200ms para mostrar el usuario mensaje de éxito
    } catch (error) {
      console.error('[ModalDocument] ❌ Error durante la subida:', error);
      setError(error?.message || 'Error inesperado');
      setShowSnackbar(true);
    } finally {
      console.log('[ModalDocument] 🔚 Finalizando handleUpload (finally)');
      setUploading(false);
    }
  };

  const latestUploadedDocument = latestUploadedDoc || selectedDocument?.uploadedDoc || null;
  const latestStatusRaw = latestUploadedDocument?.status || latestUploadedDocument?.statusLabel || null;
  const latestStatusNormalized = normalizeStatus(latestStatusRaw);
  const isProcessState = latestStatusNormalized === 'en proceso';
  const latestStatusLabel = latestStatusRaw || (latestUploadedDocument ? 'Pendiente' : null);
  const latestStatusColor = STATUS_COLOR_MAP[latestStatusNormalized] || 'default';
  const latestVersion =
    latestUploadedDocument?.versionString ||
    (typeof latestUploadedDocument?.versionNumber === 'number'
      ? `v${latestUploadedDocument.versionNumber}`
      : latestUploadedDocument?.version
      ? `v${latestUploadedDocument.version}`
      : null);
  const lastReviewerComment =
    latestUploadedDocument?.comentario || latestUploadedDocument?.adminComment || null;
  const lastCompanyComment =
    latestUploadedDocument?.companyComment ||
    latestUploadedDocument?.fileComment ||
    latestUploadedDocument?.comment ||
    null;
  const latestFileURL = useFileUrl({
    fileId: latestUploadedDocument?.fileId,
    fileURL: latestUploadedDocument?.fileURL || latestUploadedDocument?.url,
  });
  const latestFileName =
    latestUploadedDocument?.fileName ||
    latestUploadedDocument?.filename ||
    latestUploadedDocument?.name ||
    selectedDocument?.name ||
    'documento';
  const latestUploadedAt = resolveDateValue(
    latestUploadedDocument?.uploadedAt ||
      latestUploadedDocument?.updatedAt ||
      latestUploadedDocument?.createdAt ||
      latestUploadedDocument?.versionTimestamp ||
      latestUploadedDocument?.timestamp ||
      latestUploadedDocument?.fecha ||
      null
  );
  const latestUploadedAtLabel = formatLatestUpdate(latestUploadedAt);

  const canUpload = !isProcessState;
  const contactEmail = selectedDocument?.adminEmail || latestUploadedDocument?.adminEmail || '';
  const contactName =
    selectedDocument?.adminName ||
    latestUploadedDocument?.adminName ||
    selectedDocument?.reviewerName ||
    latestUploadedDocument?.reviewerName ||
    'administrador';
  const mailtoHref = buildMailtoHref({
    contactEmail,
    contactName,
    documentName: selectedDocument?.name || latestFileName,
  });

  const latestInfo = {
    version: latestVersion,
    updatedAt: latestUploadedAtLabel,
    reviewerComment: lastReviewerComment,
    companyComment: lastCompanyComment,
    fileURL: latestFileURL,
    fileName: latestFileName,
    fileType: latestUploadedDocument?.fileType,
  };

  useEffect(() => {
    if (isProcessState) {
      setShowLatestDetails(true);
    }
  }, [isProcessState]);

  // Si no hay documento seleccionado, no renderiza nada
  if (!selectedDocument) {
    console.log('[ModalDocument] ❌ No hay documento seleccionado, no renderizando');
    return null;
  }

  const entityDisplayName = entityName || selectedDocument?.entityName || 'Entidad';
  const entityTypeKey = (entityType || selectedDocument?.entityType || '').toLowerCase();
  const entityTypeLabel = ENTITY_TYPE_LABELS[entityTypeKey] || null;
  const statusLabel = selectedDocument?.status || selectedDocument?.statusLabel || null;
  const expirationCandidates = [
    selectedDocument?.expirationDate,
    selectedDocument?.deadline?.date,
    selectedDocument?.vencimiento,
    selectedDocument?.deadline,
  ];
  const expirationDate = expirationCandidates.map(resolveDateValue).find(Boolean);
  const formattedExpiration = formatExpiration(expirationDate);
  const subtitleSegments = buildSubtitleSegments({
    entityName: entityDisplayName,
    entityTypeLabel,
    statusLabel,
    expirationLabel: formattedExpiration,
  });

  const toggleLatestDetails = () => setShowLatestDetails((prev) => !prev);
  const handleLatestHeaderKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleLatestDetails();
    }
  };

  // Renderizado del modal (UI)
  return (
    <Dialog open={open} onClose={handleModalClose} maxWidth="xl" fullWidth>
      {/* Snackbar para mostrar mensajes de error o éxito */}
      <Snackbar open={showSnackbar} autoHideDuration={error ? 4000 : 2000} onClose={() => setShowSnackbar(false)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        {error ? <Alert severity="error" variant="filled">{error}</Alert> : successMsg ? <Alert severity="success" variant="filled">{successMsg}</Alert> : null}
      </Snackbar>

      <DialogTitle>
        <Typography variant="h6" component="div">Subir {selectedDocument?.name || 'Documento'}</Typography>
        {subtitleSegments.length > 0 && (
          <Typography variant="subtitle2" color="text.secondary">
            {subtitleSegments.join(' • ')}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        {latestUploadedDocument && (
          <Paper
            variant="outlined"
            sx={{
              p: 2.5,
              mb: 3,
              backgroundColor: '#fdfdfd',
            }}
          >
            <LatestDocumentSection
              expanded={showLatestDetails}
              onToggle={toggleLatestDetails}
              onKeyDown={handleLatestHeaderKeyDown}
              statusLabel={latestStatusLabel}
              statusColor={latestStatusColor}
              info={latestInfo}
              isProcessState={isProcessState}
              contactEmail={contactEmail}
              mailtoHref={mailtoHref}
              entityName={entityName}
              documentName={selectedDocument?.name}
            />
          </Paper>
        )}
        {canUpload ? (
          <Grid container spacing={2}>
            {/* Columna 1: Ejemplo y comentario de ejemplo */}
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2">Ejemplo:</Typography>
              {/* Muestra el comentario de ejemplo si existe */}
              {selectedDocument?.exampleComment && (
                <Paper sx={{ p: 2, mb: 2, backgroundColor: '#f9f9f9' }}>
                  <Typography variant="body2" fontWeight="bold">{selectedDocument.exampleComment}</Typography>
                </Paper>
              )}
              {/* Muestra imagen de ejemplo y botón de descarga si existe */}
              {selectedDocument?.exampleImage && (
                <Box my={1}>
                  <DownloadButton 
                    url={selectedDocument.exampleImage}
                    currentDocument={{
                      fileURL: selectedDocument.exampleImage,
                      fileName: selectedDocument.exampleImage?.split('/').pop(),
                      name: selectedDocument.name || 'documento_ejemplo',
                      companyName: 'Internos',
                      entityType: 'example',
                      entityName: selectedDocument.id || 'general',
                    }}
                    label="Descargar ejemplo"
                    variant="outlined"
                    size="small"
                    download
                  />
                  <VistaPrevia 
                    url={selectedDocument.exampleImage} 
                    width="100%" 
                    height={250}
                    tipo="ejemplo"
                    sx={{ 
                      mt: 1,
                      border: '1px dashed #999',
                      backgroundColor: '#f4faff'
                    }}
                  />
                </Box>
              )}
            </Grid>

            {/* Columna 2: Comentario del administrador y comentario editable de la empresa */}
            <Grid item xs={12} md={4}>
              {/* Muestra comentario del administrador si existe */}
              {selectedDocument?.adminComment && (
                <Paper sx={{ p: 2, mb: 2, backgroundColor: '#f0f0f0' }}>
                  <Typography variant="subtitle2">Comentario del administrador</Typography>
                  <Typography variant="body2" fontWeight="bold">{selectedDocument.adminComment}</Typography>
                </Paper>
              )}
              {/* Campo para que la empresa escriba su comentario (opcional) */}
              <TextField label="Comentario (opcional)" multiline rows={4} fullWidth value={companyComment} onChange={(e) => setCompanyComment(e.target.value)} />
            </Grid>

            {/* Columna 3: Vista previa del archivo a subir y selección de archivo */}
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2">Vista previa:</Typography>
              <VistaPrevia 
                url={previewMap[selectedDocument?.id]} 
                fileType={previewTypeMap[selectedDocument?.id]}
                width="100%" 
                height={250}
                tipo={fileMap[selectedDocument?.id] ? 'documento' : 'ejemplo'}
                sx={{ 
                  border: '2px dashed var(--info-main)', 
                  p: 2, 
                  backgroundColor: '#f9f9f9',
                  cursor: 'pointer'
                }}
              />

              {/* Botón para seleccionar archivo y mostrar nombre del archivo seleccionado */}
              <Box mt={2}>
                <Tooltip
                  title={canUpload ? '' : 'Estamos gestionando el archivo actual con un tercero. Espera la resolución del administrador.'}
                  disableHoverListener={canUpload}
                >
                  <span style={{ display: 'block' }}>
                    <Button
                      component="label"
                      variant="contained"
                      startIcon={<UploadFileIcon />}
                      fullWidth
                      disabled={!canUpload}
                    >
                      Seleccionar Archivo
                      <input type="file" hidden disabled={!canUpload} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.txt,.ppt,.pptx" onChange={(e) => {
                    const selected = e.target.files[0];
                    console.log('[ModalDocument] 📁 Archivo seleccionado:', {
                      name: selected?.name,
                      size: selected?.size,
                      type: selected?.type,
                      lastModified: selected?.lastModified
                    });
                    console.log('[ModalDocument] 📄 Para documento:', {
                      id: selectedDocument?.id,
                      name: selectedDocument?.name
                    });
                    
                    if (selected) {
                      // Limpiar URL de vista previa anterior si existe
                      const previousPreview = previewMap[selectedDocument?.id];
                      if (previousPreview) {
                        console.log('[ModalDocument] 🗑️ Revocando URL de vista previa anterior');
                        URL.revokeObjectURL(previousPreview);
                      }
                      
                      // Actualizar estados
                      setFileMap(prev => {
                        const newMap = { ...prev, [selectedDocument?.id]: selected };
                        console.log('[ModalDocument] 📁 Nuevo fileMap:', {
                          keys: Object.keys(newMap),
                          currentFile: newMap[selectedDocument?.id]?.name
                        });
                        return newMap;
                      });
                      
                      const preview = URL.createObjectURL(selected);
                      console.log('[ModalDocument] 🖼️ Creando nueva URL de vista previa:', preview);
                      setPreviewMap(prev => ({ ...prev, [selectedDocument?.id]: preview }));
                      setPreviewTypeMap(prev => ({ ...prev, [selectedDocument?.id]: selected.type }));
                      
                      // Limpiar errores si los había
                      if (error) {
                        console.log('[ModalDocument] 🧹 Limpiando error anterior');
                        setError(null);
                      }
                    } else {
                      console.log('[ModalDocument] ⚠️ No se seleccionó ningún archivo');
                    }
                  }} />
                    </Button>
                  </span>
                </Tooltip>
                {fileMap?.[selectedDocument?.id] && (
                  <Typography variant="body2" mt={1}>Archivo: {fileMap[selectedDocument?.id].name}</Typography>
                )}
              </Box>
            </Grid>
          </Grid>
        ) : (
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              textAlign: 'center',
              backgroundColor: '#fff8e1',
              borderColor: 'rgba(255, 152, 0, 0.4)',
            }}
          >
            <Typography variant="subtitle1" fontWeight={600}>
              Revisión externa en curso
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Espera la respuesta del administrador o utiliza las opciones superiores para avisarle si necesitas cancelar el trámite.
            </Typography>
          </Paper>
        )}
      </DialogContent>

      {/* Acciones del modal: cancelar o confirmar subida */}
      <DialogActions>
        <Button onClick={handleModalClose}>Cancelar</Button>
        <Tooltip
          title={canUpload ? '' : 'Espera la respuesta del tercero o contacta al administrador para liberar el documento.'}
          disableHoverListener={canUpload}
        >
          <span>
            <Button
              onClick={handleUpload}
              variant="contained"
              disabled={!canUpload || !fileMap[selectedDocument?.id] || uploading || !currentUser}
              startIcon={uploading ? <CircularProgress size={20} /> : null}
            >
              {!currentUser ? "Inicia sesión primero" : uploading ? "Subiendo..." : "Confirmar subida"}
            </Button>
          </span>
        </Tooltip>
      </DialogActions>
    </Dialog>
  );
}