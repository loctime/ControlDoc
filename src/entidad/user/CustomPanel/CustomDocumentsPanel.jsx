// user/CustomPanel/CustomDocumentsPanel.jsx
import React, { useEffect, useState } from "react";
import { cleanFirestoreData } from "../../../utils/cleanFirestoreData";
import { useContext } from 'react';
import { auth } from "../../../firebaseconfig";
import { useDocumentEntityTypes } from '../../../utils/useDocumentEntityTypes';
import { getTenantCollectionPath } from '../../../utils/tenantUtils';
import { useClientNamesMap } from '../../../utils/getClientName';

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
import BulkUploadDialog from '../components/BulkUploadDialog';

export default function DocumentosEmpresaForm({ onDocumentUploaded, requiredDocuments: requiredDocumentsProp, uploadedDocuments: uploadedDocumentsProp }) {
  const [requiredDocumentsState, setRequiredDocuments] = useState([]);
  const [uploadedDocumentsState, setUploadedDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [loading, setLoading] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);

  const userCompanyData = JSON.parse(localStorage.getItem("userCompany") || '{}');
  // IMPORTANTE: Usar mainCompanyId del contexto (empresa principal, nunca cambia)
  const { user: currentUser, mainCompanyId, activeCompanyId } = useContext(AuthContext);
  const { entityTypes } = useDocumentEntityTypes(currentUser);
  const companyId = mainCompanyId; // Siempre la empresa principal  

  // Priorizar props sobre estado local (props ya tienen el filtrado correcto por cliente)
  const requiredDocuments = requiredDocumentsProp || requiredDocumentsState || [];
  const uploadedDocuments = uploadedDocumentsProp || uploadedDocumentsState || [];

  // Obtener clientIds únicos de los documentos subidos
  const clientIds = uploadedDocuments
    .map(doc => doc.clientId)
    .filter(id => id)
    .filter((id, index, self) => self.indexOf(id) === index);

  // Obtener nombres de clientes
  const { data: clientNamesMap = {}, isLoading: isLoadingClientNames } = useClientNamesMap(clientIds);

  useEffect(() => {
    // Si recibimos documentos como props, no necesitamos cargarlos
    if (requiredDocumentsProp && uploadedDocumentsProp) return;
    
    if (!companyId) return;

    let unsubscribe = null;
    const fetchData = async () => {
      setLoading(true);
      try {
        // Usar rutas multi-tenant correctas
        const requiredCollectionPath = getTenantCollectionPath('requiredDocuments');
        const uploadedCollectionPath = getTenantCollectionPath('uploadedDocuments');
        
        const reqQuery = query(
          collection(db, requiredCollectionPath),
          where("companyId", "==", companyId)
        );
        const upQuery = query(
          collection(db, uploadedCollectionPath),
          where("companyId", "==", companyId)
        );

        // getDocs solo para los requeridos (no cambian seguido)
        const reqSnap = await getDocs(reqQuery);
        setRequiredDocuments(reqSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        // onSnapshot para uploadedDocuments (reactivo)
        unsubscribe = onSnapshot(upQuery, (upSnap) => {
          setUploadedDocuments(upSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          setLoading(false);
        }, (err) => {
          console.error("Error al escuchar documentos subidos:", err);
          setLoading(false);
        });
      } catch (err) {
        console.error("Error al cargar documentos:", err);
        setLoading(false);
      }
    };
    fetchData();
    return () => { if (unsubscribe) unsubscribe(); };
  }, [companyId, requiredDocumentsProp, uploadedDocumentsProp]);

  if (loading) return <CircularProgress />;
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

  // Obtener categorías estándar (company, employee, vehicle)
  const standardEntityTypes = ["company", "employee", "vehicle", "personal", "vehiculo"];
  
  // Solo mostrar documentos personalizados (entityType distinto a categorías estándar)
  const filteredRequiredDocuments = requiredDocuments.filter(
    doc => typeof doc.entityType === "string" &&
           !standardEntityTypes.includes(doc.entityType)
  );
  const filteredUploadedDocuments = uploadedDocuments.filter(
    doc => typeof doc.entityType === "string" &&
           !standardEntityTypes.includes(doc.entityType)
  );

  return (
    <React.Fragment>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Documentos Personalizados</Typography>
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
          <Alert severity="error" sx={{ mb: 2 }}>
            <AlertTitle>Error de autenticación</AlertTitle>
            Debes iniciar sesión para poder subir documentos
          </Alert>
        )}
        <Grid container spacing={2}>
          {filteredRequiredDocuments.map(doc => {
            const uploaded = filteredUploadedDocuments.find(
              up =>
                up.requiredDocumentId === doc.id &&
                (!!up?.entityId ? up.entityId === companyId : true)
            );
            const days = getDaysToExpire(doc);
            const bgColor = days <= 0 ? "rgba(244, 67, 54, 0.1)" :
              days <= 10 ? "rgba(255, 152, 0, 0.1)" : "transparent";

            return (
              <Grid item xs={12} sm={6} md={4} key={doc.id}>
                <Card sx={{
                  backgroundColor: bgColor,
                  border: '1px solid #ddd',
                  '&:hover': { boxShadow: 3 }
                }}>
                  <CardContent>
                    <Box>
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <DescriptionIcon color="primary" />
                        <Box>
                          <Typography variant="subtitle1" fontWeight="bold">{doc.name}</Typography>
                          {uploaded?.clientId && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                              Cliente: {isLoadingClientNames ? '...' : (clientNamesMap[uploaded.clientId] || '-')}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                        Categoría: {doc.entityType}
                      </Typography>
                      {uploaded ? (
                        <React.Fragment>
                          <Chip
                            label={uploaded.status}
                            size="small"
                            color={
                              uploaded.status === "Aprobado" ? "success" :
                              uploaded.status === "Subido" ? "info" :
                              uploaded.status === "En proceso" ? "info" :
                              uploaded.status === "Pendiente de revisión" ? "warning" :
                              uploaded.status === "Rechazado" ? "error" : "warning"
                            }
                          />
                          {/* Mostrar comentario del administrador si existe, siempre (de uploaded.adminComment) */}
                          {uploaded.comentario && (
                            <Box mt={1}>
                              <Alert severity={uploaded.status === "Rechazado" ? "error" : "info"} sx={{ p: 1, mb: 1 }}>
                                <Typography variant="caption">
                                  {uploaded.comentario}
                                </Typography>
                              </Alert>
                            </Box>
                          )}
                          {uploaded.status === "Aprobado" && uploaded.expirationDate && (() => {
                            let fechaVenc = null;
                            if (typeof uploaded.expirationDate?.toDate === 'function') {
                              fechaVenc = uploaded.expirationDate.toDate();
                            } else {
                              fechaVenc = new Date(uploaded.expirationDate);
                            }
                            return (fechaVenc instanceof Date && !isNaN(fechaVenc)) ? (
                              <Typography variant="caption" display="block">
                                Vence: {fechaVenc.toLocaleDateString('es-ES', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                })}
                              </Typography>
                            ) : null;
                          })()}
                          {uploaded.fileURL && (
                            <Box mt={1}>
                              <DownloadButton 
                                url={uploaded.fileURL}
                                filename={uploaded.fileName}
                                variant="outlined"
                                size="small"
                                startIcon
                              />
                              <VistaPrevia 
                                url={uploaded.fileURL} 
                                width={120} 
                                height={80}
                                sx={{ ml: 1 }}
                              />
                            </Box>
                          )}
                        </React.Fragment>
                      ) : (
                        <React.Fragment>
                          <Typography variant="body2" color="text.secondary">
                            Documento no cargado aún
                          </Typography>
                          {/* Mostrar comentario del admin si existe en el requerimiento */}
                          {doc.comentario && (
                            <Box mt={1}>
                              <Alert severity="info" sx={{ p: 1, mb: 1 }}>
                                <Typography variant="caption">
                                  {doc.comentario}
                                </Typography>
                              </Alert>
                            </Box>
                          )}
                          {/* Mostrar fecha de vencimiento personalizada si existe */}
                          {doc.expirationDate && (
                            <Typography variant="caption" display="block" color="warning.main">
                              Vence: {new Date(doc.expirationDate).toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              })}
                            </Typography>
                          )}
                          {doc.deadline?.date && !doc.expirationDate && (
                            <Typography variant="caption" display="block" color="warning.main">
                              Vence: {new Date(doc.deadline.date).toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              })}
                            </Typography>
                          )}
                          {doc.url && (
                            <Box mt={1}>
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
                              />
                            </Box>
                          )}
                        </React.Fragment>
                      )}
                      <Box mt={2}>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => {
                            setSelectedDocument({ doc, uploaded });
                          }}
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
      <ModalDocument
        open={!!selectedDocument}
        onClose={() => setSelectedDocument(null)}
        selectedDocument={selectedDocument ? { ...selectedDocument.doc, entityId: companyId } : null}
        currentUser={currentUser}
        entityType={selectedDocument?.doc?.entityType || "custom"}
        entityName={userCompanyData?.companyName || userCompanyData?.name || "Empresa"}
        latestUploadedDoc={selectedDocument?.uploaded || null}
        onUploadSuccess={onDocumentUploaded}
      />

      <VistaPrevia 
        url={previewUrl} 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)}
        titulo="Vista previa del documento"
      />

      <BulkUploadDialog
        open={bulkUploadOpen}
        onClose={() => setBulkUploadOpen(false)}
        onUploadComplete={(results) => {
          console.log('Carga masiva completada:', results);
          onDocumentUploaded && onDocumentUploaded();
          setBulkUploadOpen(false);
        }}
        entityType="custom"
        companyId={companyId}
      />
    </React.Fragment>
  );
}
