
//adm/DocumentoRequerido/dialogs/TemplatesListDialog.jsx
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
  Divider,
  Box,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Typography
} from '@mui/material';
import {
  Description as DescriptionIcon,
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../../config/firebaseconfig';
import CompanySelectorLocal from '../CompanySelectorModal';
import { createRequiredDocument } from '../../../../utils/MetadataService';
import { getAuth } from "firebase/auth";
import { useCompanies } from '../../../../context/CompaniesContext';
import DocumentoDetalleDialog from './DocumentDetails';
import { getTenantCollectionPath } from '../../../../utils/tenantUtils';

const TemplatesListDialog = ({
  open,
  onClose,
  templates,
  loading,
  onViewTemplate,
  onApplyTemplate,
  onDeleteTemplate,
  selectedCompanyId,
  setSuccess,
  setError,
  triggerRefresh,
}) => {
  const { loading: loadingCompanies } = useCompanies();
  const [tabIndex, setTabIndex] = useState(0);
  const [localLoading, setLocalLoading] = useState(false); 
  const [filterCompany, setFilterCompany] = useState(null);
  const [filteredDocuments, setFilteredDocuments] = useState([]);
  const [loadingFilteredDocs, setLoadingFilteredDocs] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);

  useEffect(() => {
    const fetchDocs = async () => {
      if (!filterCompany || filterCompany?.id === 'todas') {
        setFilteredDocuments([]);
        return;
      }

      setLoadingFilteredDocs(true);
      try {
        // Normalizar el companyId para evitar problemas de formato
        const normalizedCompanyId = String(filterCompany.id).trim();
        if (import.meta.env.DEV) {
          console.log(`[TemplatesListDialog] Buscando documentos para empresa:`, {
            id: normalizedCompanyId,
            name: filterCompany.name,
            originalId: filterCompany.id,
            type: typeof filterCompany.id
          });
        }
        
        const q = query(
          collection(db, getTenantCollectionPath("requiredDocuments")), 
          where("companyId", "==", normalizedCompanyId)
        );
        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        
        if (import.meta.env.DEV) {
          console.log(`[TemplatesListDialog] Documentos encontrados para empresa ${normalizedCompanyId} (${filterCompany.name}):`, {
            cantidad: docs.length,
            documentos: docs.map(d => ({ id: d.id, name: d.name, companyId: d.companyId, entityType: d.entityType }))
          });
        }
        
        setFilteredDocuments(docs);
      } catch (error) {
        console.error("Error fetching individual documents:", error);
        setError("Error al cargar documentos individuales.");
      } finally {
        setLoadingFilteredDocs(false);
      }
    };

    fetchDocs();
  }, [filterCompany, setError]);

  const handleApplySingleDocument = async (docToCopy) => {
    if (!selectedCompanyId) {
      setError("Debe seleccionar una empresa de destino para copiar el documento.");
      return;
    }
  
    setError("");
  
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        setError("Usuario no autenticado.");
        return;
      }
  
      const docData = {
        name: docToCopy.name,
        entityType: docToCopy.entityType,
        exampleImage: docToCopy.exampleImage || "",
        comentario: docToCopy.comentario || "",
        expirationDate: docToCopy.expirationDate || docToCopy.vencimiento || (docToCopy.deadline?.date ?? null),
        allowedFileTypes: docToCopy.allowedFileTypes || [".pdf", ".jpg", ".jpeg", ".png"],
      };
  
      await createRequiredDocument({ user, data: docData, companyId: selectedCompanyId });
  
      setSuccess(`Documento "${docToCopy.name}" copiado correctamente a la empresa seleccionada.`);
      triggerRefresh();
      onClose();
    } catch (error) {
      console.error("Error copying document:", error);
      setError("Error al copiar el documento: " + (error.message || error));
    }
  };
  

  if (!open) return null;

  return (
    <Dialog 
      open={true} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth 
      disablePortal
      PaperProps={{
        sx: {
          backgroundColor: "var(--paper-background)",
          color: "var(--paper-background-text)"
        }
      }}
    >
      <DialogTitle sx={{ color: "var(--paper-background-text)" }}>Gestión de documentos</DialogTitle>
      <DialogContent>
        <Tabs 
          value={tabIndex} 
          onChange={(e, newIndex) => setTabIndex(newIndex)} 
          aria-label="Document management tabs"
          sx={{
            borderColor: "var(--divider-color)",
            "& .MuiTab-root": {
              color: "var(--paper-background-text)"
            },
            "& .MuiTab-root.Mui-selected": {
              color: "var(--tab-active-text) !important"
            },
            "& .MuiTabs-indicator": {
              backgroundColor: "var(--tab-active-text) !important"
            }
          }}
        >
          <Tab label="Plantillas guardadas" sx={{ "&.Mui-selected": { color: "var(--tab-active-text) !important" } }} />
          <Tab label="Documentos individuales" sx={{ "&.Mui-selected": { color: "var(--tab-active-text) !important" } }} />
        </Tabs>

        {tabIndex === 0 && (
          <Box sx={{ mt: 2 }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                <CircularProgress />
              </Box>
            ) : templates.length === 0 ? (
              <Alert severity="info" sx={{ my: 2 }}>
                No hay plantillas guardadas. Cree una lista de documentos y guárdela como plantilla.
              </Alert>
            ) : (
              <List>
                {templates.map((template) => (
                  <React.Fragment key={template.id}>
                    <ListItem>
                      <ListItemText
                        primary={template.name}
                        secondary={`${template.documents?.length || 0} documentos • Creada: ${new Date(template.createdAt).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}`}
                      />
                      <ListItemSecondaryAction>
                        <Tooltip title="Ver detalles">
                          <IconButton 
                            edge="end" 
                            onClick={() => onViewTemplate(template)}
                            sx={{
                              color: "var(--paper-background-text)",
                              "&:hover": {
                                backgroundColor: "var(--primary-main)",
                                color: "var(--primary-text)"
                              }
                            }}
                          >
                            <DescriptionIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Aplicar plantilla completa">
                          <IconButton
                            edge="end"
                            onClick={() => onApplyTemplate(template)}
                            disabled={!selectedCompanyId}
                            sx={{
                              color: "var(--primary-main)",
                              "&:hover": {
                                backgroundColor: "var(--primary-main)",
                                color: "var(--primary-text)"
                              },
                              "&:disabled": {
                                color: "var(--paper-background-text)",
                                opacity: 0.5
                              }
                            }}
                          >
                            <AddIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar plantilla">
                          <IconButton 
                            edge="end" 
                            onClick={() => onDeleteTemplate(template.id)} 
                            sx={{
                              color: "var(--error-main)",
                              "&:hover": {
                                backgroundColor: "var(--error-main)",
                                color: "white"
                              }
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </ListItemSecondaryAction>
                    </ListItem>
                    <Divider sx={{ borderColor: "var(--divider-color)" }} />
                  </React.Fragment>
                ))}
              </List>
            )}
          </Box>
        )}

        {tabIndex === 1 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ color: "var(--paper-background-text)" }}>
              Copiar documento individual desde otra empresa:
            </Typography>

            {loadingCompanies ? (
              <Box display="flex" justifyContent="center" p={2}><CircularProgress size={20} /></Box>
            ) : (
              <>
                <CompanySelectorLocal
                  value={filterCompany?.id ?? ''}
                  onChange={(company) => setFilterCompany(company)}
                  allowAllOption={true}
                  sx={{ mt: 1, mb: 2 }}
                />

                {filterCompany?.id === 'todas' ? (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Seleccione una empresa específica para ver y copiar documentos individuales.
                  </Alert>
                ) : filterCompany ? (
                  <>
                    {loadingFilteredDocs ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                        <CircularProgress />
                      </Box>
                    ) : filteredDocuments.length === 0 ? (
                      <Alert severity="info" sx={{ my: 2 }}>
                        No se encontraron documentos requeridos para esta empresa.
                      </Alert>
                    ) : (
                      <List>
                        <Typography variant="subtitle2" sx={{ mb: 1, color: "var(--paper-background-text)" }}>
                          Documentos requeridos de {filterCompany.name || 'esta empresa'}:
                        </Typography>
                        {filteredDocuments.map((doc) => (
                          <ListItem
                          key={doc.id}
                          component="button" // ✅ renderiza como botón real
                          onClick={() => setPreviewDoc(doc)}
                          disabled={!selectedCompanyId}
                          sx={{ cursor: 'pointer', textAlign: 'left' }} // ✅ estilo visual de botón
                        >
                          <ListItemText
                            primary={doc.name}
                            secondary={`Tipo: ${doc.entityType} • Vencimiento: ${doc.expirationDate ? new Date(doc.expirationDate).toLocaleDateString('es-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            }) : 'Sin fecha'}`}
                          />
                          <ListItemSecondaryAction>
                            <Tooltip title="Copiar a la empresa actual">
                              <IconButton
                                edge="end"
                                onClick={() => setPreviewDoc(doc)}
                                disabled={!selectedCompanyId}
                                sx={{
                                  color: "var(--primary-main)",
                                  "&:hover": {
                                    backgroundColor: "var(--primary-main)",
                                    color: "var(--primary-text)"
                                  },
                                  "&:disabled": {
                                    color: "rgba(0, 0, 0, 0.26)"
                                  }
                                }}
                              >
                                <AddIcon />
                              </IconButton>
                            </Tooltip>
                          </ListItemSecondaryAction>
                        </ListItem>
                        
                        ))}
                      </List>
                    )}
                  </>
                ) : null}
              </>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button 
          onClick={onClose} 
          disabled={loading}
          sx={{
            color: "var(--paper-background-text)",
            "&:disabled": {
              color: "var(--paper-background-text)",
              opacity: 0.5
            }
          }}
        >
          Cerrar
        </Button>
      </DialogActions>

      <DocumentoDetalleDialog
        open={!!previewDoc}
        documento={previewDoc}
        onClose={() => setPreviewDoc(null)}
        onApply={handleApplySingleDocument}
        disabled={!selectedCompanyId}
      />

    </Dialog>
  );
};

export default TemplatesListDialog;
