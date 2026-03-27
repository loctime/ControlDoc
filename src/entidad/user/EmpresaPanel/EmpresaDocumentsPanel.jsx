// user/EmpresaPanel/EmpresaDocumentsPanel.jsx
import React, { useEffect, useState } from "react";
import { cleanFirestoreData } from "../../../utils/cleanFirestoreData";
import { useContext } from 'react';
import { auth } from "../../../firebaseconfig";

import { AuthContext } from '../../../context/AuthContext';

import {
  Box, Button, Card, CardContent, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Grid, Paper, TextField, Tooltip, Typography,
  Alert, AlertTitle
} from "@mui/material";
import {
  Description as DescriptionIcon,
  UploadFile as UploadFileIcon,
  CloudUpload as CloudUploadIcon,
  Image as ImageIcon,
  Warning as WarningIcon
} from "@mui/icons-material";
import { db } from "../../../firebaseconfig";
import {
  collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, onSnapshot
} from "firebase/firestore";
import DownloadButton from '../../../components/common/DownloadButton'; 
import ModalDocument from '../components/ModalDocument';
import VistaPrevia from '../../../components/common/VistaPrevia';
import ModalDocumentWithConversion from '../components/ModalDocument';
import BulkUploadDialog from '../components/BulkUploadDialog';
import { getTenantCollectionPath } from '../../../utils/tenantUtils';
import useDashboardDataQuery from '../components/hooks/useDashboardDataQuery';
import { useClientNamesMap } from '../../../utils/getClientName';

export default function DocumentosEmpresaForm({ onDocumentUploaded, requiredDocuments: requiredDocumentsProp, uploadedDocuments: uploadedDocumentsProp }) {
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);

  const userCompanyData = JSON.parse(localStorage.getItem("userCompany") || '{}');
  // IMPORTANTE: Usar mainCompanyId del contexto (empresa principal, nunca cambia)
  const { user: currentUser, loading, mainCompanyId, activeCompanyId } = useContext(AuthContext);
  const companyId = mainCompanyId; // Siempre la empresa principal

  // Usar documentos pasados como props (ya filtrados por cliente activo) o fallback al hook
  const { 
    requiredDocuments: requiredDocumentsFromHook, 
    uploadedDocuments: uploadedDocumentsFromHook, 
    loading: queryLoading,
    refreshUploadedDocuments: refreshFromHook
  } = useDashboardDataQuery(companyId, 0, 0, activeCompanyId, mainCompanyId);
  
  // Priorizar props sobre hook (props ya tienen el filtrado correcto por cliente)
  const requiredDocuments = requiredDocumentsProp || requiredDocumentsFromHook || [];
  const uploadedDocuments = uploadedDocumentsProp || uploadedDocumentsFromHook || [];
  
  // Obtener clientIds únicos de los documentos subidos
  const clientIds = uploadedDocuments
    .map(doc => doc.clientId)
    .filter(id => id)
    .filter((id, index, self) => self.indexOf(id) === index);

  // Obtener nombres de clientes
  const { data: clientNamesMap = {}, isLoading: isLoadingClientNames } = useClientNamesMap(clientIds);
  
  // Función combinada para refresh
  const handleDocumentUploaded = async () => {
    console.log('[EmpresaDocumentsPanel] 🔄 Refrescando documentos después de subida...');
    // Esperar un poco para que el backend complete la escritura en Firestore
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Llamar al callback pasado como prop
    if (onDocumentUploaded) {
      await onDocumentUploaded();
    }
    // También refrescar desde el hook
    if (refreshFromHook) {
      await refreshFromHook();
    }
  };  

  // Los datos ahora vienen de los hooks Query, no necesitamos useEffect

if (loading || queryLoading) return <CircularProgress />;
if (!currentUser) return <Alert severity="error">Sesión no iniciada.</Alert>;

const getDaysToExpire = (doc) => {
  if (!doc.deadline?.date) return null;
  const diff = (new Date(doc.deadline.date) - new Date()) / (1000 * 60 * 60 * 24);
  return Math.floor(diff);
};

const openPreview = (url) => {
  setPreviewUrl(url);
  setPreviewOpen(true);
};

return (
  <React.Fragment>
    <Paper sx={{ p: 3 }} id="user-empresa-docs-paper">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" id="user-empresa-docs-title">Documentos Requeridos</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<CloudUploadIcon />}
          onClick={() => setBulkUploadOpen(true)}
          sx={{ display: 'none' }} // Oculto temporalmente
        >
          Carga masiva
        </Button>
      </Box>
      {!currentUser && (
        <Alert severity="error" sx={{ mb: 2 }} id="user-empresa-docs-auth-error">
          <AlertTitle>Error de autenticación</AlertTitle>
          Debes iniciar sesión para poder subir documentos
        </Alert>
      )}
      <Grid container spacing={2} id="user-empresa-docs-grid">
        {requiredDocuments.filter(doc => doc.entityType === "company").map(doc => {
        // Buscar documento subido - mejorar la búsqueda para considerar entityId
        const uploaded = uploadedDocuments.find(up => {
          const matchesRequiredDocId = up.requiredDocumentId === doc.id || up.documentType === doc.id;
          if (!matchesRequiredDocId) return false;
          
          // Si el documento subido tiene entityId, debe coincidir con companyId
          // Si no tiene entityId, es un documento global
          if (up.entityId) {
            return up.entityId === companyId;
          }
          // Si no tiene entityId, es global, permitirlo
          return true;
        });
        
        // Debug logs
        if (doc.id === 'HSyO30w9JQxjZSMVqQ3t') {
          console.log('[EmpresaDocumentsPanel] 🔍 Buscando documento:', {
            docId: doc.id,
            docName: doc.name,
            companyId,
            uploadedDocumentsCount: uploadedDocuments.length,
            uploadedDocumentsRelevant: uploadedDocuments.filter(up => 
              up.requiredDocumentId === doc.id || up.documentType === doc.id
            ).map(up => ({
              id: up.id,
              requiredDocumentId: up.requiredDocumentId,
              documentType: up.documentType,
              entityId: up.entityId,
              status: up.status
            })),
            foundUploaded: uploaded ? {
              id: uploaded.id,
              requiredDocumentId: uploaded.requiredDocumentId,
              documentType: uploaded.documentType,
              entityId: uploaded.entityId,
              status: uploaded.status
            } : null
          });
        }
        
        // USAR SOLO uploadedDocuments - no confiar en requiredDocuments que son compartidos
        const hasUploadedDocument = !!uploaded;
        const finalStatus = uploaded?.status;
        
        const days = getDaysToExpire(doc);
        const bgColor = days <= 0 ? "rgba(244, 67, 54, 0.1)" :
          days <= 10 ? "rgba(255, 152, 0, 0.1)" : "transparent";

        return (
          <Grid item xs={12} sm={6} md={4} key={doc.id} id={`user-empresa-docs-grid-item-${doc.id}`}>
            <Card sx={{
              backgroundColor: bgColor,
              border: '1px solid #ddd',
              '&:hover': { boxShadow: 3 }
            }} id={`user-empresa-docs-card-${doc.id}`}>
              <CardContent>
                <Box id={`user-empresa-docs-cardbox-${doc.id}`}>
                  <Box display="flex" alignItems="center" gap={1} mb={1} id={`user-empresa-docs-cardbox-header-${doc.id}`}>
                    <DescriptionIcon color="primary" />
                    <Box>
                      <Typography variant="subtitle1" fontWeight="bold" id={`user-empresa-docs-docname-${doc.id}`}>{doc.name}</Typography>
                      {uploaded?.clientId && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                          Cliente: {isLoadingClientNames ? '...' : (clientNamesMap[uploaded.clientId] || '-')}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  {hasUploadedDocument ? (
                  <React.Fragment>
                    <Chip
                      label={finalStatus || "Pendiente de revisión"}
                      size="small"
                      color={
                        finalStatus === "Aprobado" ? "success" :
                        finalStatus === "Subido" ? "info" :
                        finalStatus === "En proceso" ? "info" :
                        finalStatus === "Pendiente de revisión" ? "warning" :
                        finalStatus === "Rechazado" ? "error" : "warning"
                      }
                      id={`user-empresa-docs-chip-status-${doc.id}`}
                    />
                    {/* Mostrar comentario del administrador si existe, siempre (de uploaded.adminComment) */}
                    {uploaded?.comentario && (
                      <Box mt={1} id={`user-empresa-docs-admin-comment-${doc.id}`}>
                        <Alert severity={finalStatus === "Rechazado" ? "error" : "info"} sx={{ p: 1, mb: 1 }} id={`user-empresa-docs-admin-alert-${doc.id}`}>
                          <Typography variant="caption">
                            {uploaded.comentario}
                          </Typography>
                        </Alert>
                      </Box>
                    )}
                    {finalStatus === "Aprobado" && uploaded?.expirationDate && (() => {
                      let fechaVenc = null;
                      if (typeof uploaded.expirationDate?.toDate === 'function') {
                        fechaVenc = uploaded.expirationDate.toDate();
                      } else {
                        fechaVenc = new Date(uploaded.expirationDate);
                      }
                      return (fechaVenc instanceof Date && !isNaN(fechaVenc)) ? (
                        <Typography variant="caption" display="block" id={`user-empresa-docs-expiration-${doc.id}`}>
                          Vence: {fechaVenc.toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </Typography>
                      ) : null;
                    })()}
                    {uploaded.fileURL && (
                      <Box mt={1} id={`user-empresa-docs-fileurl-${doc.id}`}>
                        <DownloadButton 
                          url={uploaded.fileURL}
                          filename={uploaded.fileName}
                          variant="outlined"
                          size="small"
                          startIcon
                          id={`user-empresa-docs-download-btn-${doc.id}`}
                        />
                        <VistaPrevia 
                          url={uploaded.fileURL} 
                          width={120} 
                          height={80}
                          sx={{ ml: 1 }}
                          id={`user-empresa-docs-preview-${doc.id}`}
                        />
                      </Box>
                    )}
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    <Typography variant="body2" color="text.secondary" id={`user-empresa-docs-nouploaded-${doc.id}`}>
                      Documento no cargado aún
                    </Typography>
                    {/* Mostrar comentario del admin si existe en el requerimiento */}
                    {doc.comentario && (
                      <Box mt={1} id={`user-empresa-docs-doc-comment-${doc.id}`}>
                        <Alert severity="info" sx={{ p: 1, mb: 1 }} id={`user-empresa-docs-doc-alert-${doc.id}`}>
                          <Typography variant="caption">
                            {doc.comentario}
                          </Typography>
                        </Alert>
                      </Box>
                    )}
                    {/* Mostrar fecha de vencimiento personalizada si existe */}
                    {doc.expirationDate && (
                      <Typography variant="caption" display="block" color="warning.main" id={`user-empresa-docs-expiration-${doc.id}`}>
                        Vence: {new Date(doc.expirationDate).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </Typography>
                    )}
                    {doc.deadline?.date && !doc.expirationDate && (
                      <Typography variant="caption" display="block" color="warning.main" id={`user-empresa-docs-deadline-${doc.id}`}>
                        Vence: {new Date(doc.deadline.date).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </Typography>
                    )}
                    {doc.url && (
                      <Box mt={1} id={`user-empresa-docs-url-${doc.id}`}>
                        <DownloadButton 
                          url={doc.url}
                          filename={doc.fileName}
                          size="small"
                          startIcon
                          sx={{
                            ml: 1,
                            backgroundColor: 'var(--primary-main)',
                            color: 'white',
                            '&:hover': {
                              backgroundColor: 'var(--primary-dark)'
                            }
                          }}
                          id={`user-empresa-docs-download-btn-req-${doc.id}`}
                        />
                      </Box>
                    )}
                  </React.Fragment>
                )}
                <Box mt={2} id={`user-empresa-docs-uploadbox-${doc.id}`}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      setSelectedDocument({ doc, uploaded });
                    }}
                    id={`user-empresa-docs-upload-btn-${doc.id}`}
                  >
                    {uploaded ? "Reemplazar" : "Subir"}
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      );
    })}
  </Grid>
</Paper>
<ModalDocumentWithConversion
  open={!!selectedDocument}
  onClose={() => setSelectedDocument(null)}
  selectedDocument={selectedDocument ? { ...selectedDocument.doc, entityId: companyId } : null}
  currentUser={currentUser}
  entityType="company"
  entityName={userCompanyData?.companyName || userCompanyData?.name || "Empresa"}
  latestUploadedDoc={selectedDocument?.uploaded || null}
  onUploadSuccess={handleDocumentUploaded}
  id="user-empresa-docs-modal-upload"
/>
<VistaPrevia 
  url={previewUrl} 
  open={previewOpen} 
  onClose={() => setPreviewOpen(false)}
  titulo="Vista previa del documento"
  id="user-empresa-docs-modal-preview"
/>

<BulkUploadDialog
  open={bulkUploadOpen}
  onClose={() => setBulkUploadOpen(false)}
  onUploadComplete={(results) => {
    console.log('Carga masiva completada:', results);
    onDocumentUploaded && onDocumentUploaded();
    setBulkUploadOpen(false);
  }}
  entityType="company"
  companyId={companyId}
/>
</React.Fragment>
);
}
