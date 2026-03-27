// src/component/administrador/Pendientes/HistorialPage.jsx
import React, { useEffect, useState, useContext } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { 
  Box, Typography, CircularProgress, Alert, Button, Chip, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  IconButton, Collapse, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { ExpandMore, ExpandLess, CheckCircle, Cancel, Download } from '@mui/icons-material';
import { db } from '../../../config/firebaseconfig';
import { getTenantCollectionPath } from '../../../utils/tenantUtils';
import VistaDocumentoSubido from '../VistaDocumentoSubido';
import handleApproveOrReject from '../handleApproveOrReject';
import RevisionDocumentoDialog from '../RevisionDocumentoDialog';
import { useCompanies } from '../../../context/CompaniesContext';
import { AuthContext } from '../../../context/AuthContext';
import { useRefresh } from '../../../context/RefreshContext';
import DownloadButton from '../../../components/common/DownloadButton';
import { getDeadlineColor, getDeadlineStatus, getStatusIconComponent } from '../../../utils/getDeadlineUtils';
import { parseFirestoreDate } from '../../../utils/dateHelpers';
import { useClientNamesMap } from '../../../utils/getClientName';
import { useMemo } from 'react';

export default function HistorialPage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogAccion, setDialogAccion] = useState(null);
  const [adminComment, setAdminComment] = useState('');
  const [companyComment, setCompanyComment] = useState('');
  const [exampleComment, setExampleComment] = useState('');
  const [newExpirationDates, setNewExpirationDates] = useState({});
  const [expandedRow, setExpandedRow] = useState(null);
  const [filterStatus, setFilterStatus] = useState('todos');
  const [sortOption, setSortOption] = useState('reviewedAtDesc');
  const { selectedCompany, companies } = useCompanies();
  const { user } = useContext(AuthContext);
  const { getRefreshKey } = useRefresh();
  const [toastMessage, setToastMessage] = useState('');
  const [toastOpen, setToastOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  useEffect(() => {
    const fetchDocs = async () => {
      setLoading(true);
      try {
        // IMPORTANTE: Mostrar documentos de approvedDocuments para aprobados (todas las versiones)
        // Para rechazados, mostrar de uploadedDocuments (solo la última versión rechazada)
        const approvedDocumentsPath = getTenantCollectionPath('approvedDocuments');
        const uploadedDocumentsPath = 'uploadedDocuments';
        
        // Buscar documentos aprobados en approvedDocuments (todas las versiones)
        let approvedQuery = query(
          collection(db, approvedDocumentsPath),
          where('status', '==', 'Aprobado'),
          where('companyId', '!=', null)
        );
        
        if (selectedCompany?.id) {
          approvedQuery = query(approvedQuery, where('companyId', '==', selectedCompany.id));
        }
        
        const approvedSnap = await getDocs(approvedQuery);
        
        // Buscar documentos rechazados en uploadedDocuments (solo últimos rechazados)
        let rejectedQuery = query(
          collection(db, uploadedDocumentsPath),
          where('status', '==', 'Rechazado'),
          where('companyId', '!=', null)
        );
        
        if (selectedCompany?.id) {
          rejectedQuery = query(rejectedQuery, where('companyId', '==', selectedCompany.id));
        }
        
        const rejectedSnap = await getDocs(rejectedQuery);
        
        // Obtener IDs de empresas asignadas al admin
        const assignedCompanyIds = new Set(companies.map(c => c.id));
        
        // Filtrar por empresas asignadas si no hay empresa seleccionada
        const filteredApprovedDocs = selectedCompany?.id 
          ? approvedSnap.docs 
          : approvedSnap.docs.filter(doc => assignedCompanyIds.has(doc.data().companyId));
        
        const filteredRejectedDocs = selectedCompany?.id 
          ? rejectedSnap.docs 
          : rejectedSnap.docs.filter(doc => assignedCompanyIds.has(doc.data().companyId));
        
        // Combinar ambos resultados
        const allDocs = [...filteredApprovedDocs, ...filteredRejectedDocs];
        const docs = allDocs.map(doc => {
          const company = companies.find(c => c.id === doc.data().companyId);
          const expirationDate = parseFirestoreDate(doc.data().expirationDate);
          const uploadedAt = parseFirestoreDate(doc.data().uploadedAt);
          const reviewedAt = parseFirestoreDate(doc.data().reviewedAt);
          
          return {
            id: doc.id,
            ...doc.data(),
            companyName: company?.name || 'Empresa no especificada',
            uploadedAtFormatted: uploadedAt ? uploadedAt.toLocaleString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }) : 'Sin fecha',
            companyId: doc.data().companyId,
            reviewedAtFormatted: reviewedAt ? reviewedAt.toLocaleString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }) : 'Sin fecha',
            expirationDateFormatted: expirationDate?.toLocaleDateString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            }) || 'Sin vencimiento',
            daysSinceApproval: reviewedAt 
              ? Math.floor((new Date() - reviewedAt) / (1000 * 60 * 60 * 24)) 
              : 'N/A',
            entityFullType: doc.data().entityType === 'company' ? 'Empresa' : 
                           doc.data().entityType === 'employee' ? 'Empleado' : 
                           doc.data().entityType === 'vehicle' ? 'Vehículo' : 'Desconocido',
            versionInfo: doc.data().versionString || `v${doc.data().versionNumber || 1}`
          };
        });

        setDocuments(docs);
      } catch (err) {
        console.error(err);
        setError('Error al cargar historial.');
      } finally {
        setLoading(false);
      }
    };
    
    if (companies) fetchDocs();
  }, [selectedCompany, companies, getRefreshKey]);

  const handleConfirm = async () => {
    const { doc: selectedDoc, tipo } = dialogAccion || {};
    if (!selectedDoc?.id) return;
    setIsSubmitting(true);
    try {
      await handleApproveOrReject(
      selectedDoc.id,
      tipo,
      documents,
      setDocuments,
      user,
      newExpirationDates,
      adminComment,
      companyComment,
      exampleComment, 
      setToastMessage,
      setToastOpen,
      setExpandedRow,
      setDialogAccion,
      selectedCompany?.id
    );
      // Limpiar estados después de operación exitosa
      setDialogAccion(null);
      setAdminComment(prev => {
        const newState = { ...prev };
        delete newState[selectedDoc.id];
        return newState;
      });
      setNewExpirationDates(prev => {
        const newState = { ...prev };
        delete newState[selectedDoc.id];
        return newState;
      });
    } catch (error) {
      console.error('Error en handleConfirm:', error);
      setToastMessage('Error al procesar la acción');
      setToastOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Extraer clientIds únicos de los documentos
  const clientIds = useMemo(() => {
    const ids = documents.map(doc => doc.clientId).filter(Boolean);
    return [...new Set(ids)];
  }, [documents]);

  // Obtener nombres de clientes
  const { data: clientNamesMap = {}, isLoading: isLoadingClientNames } = useClientNamesMap(clientIds);

  const filteredAndSortedDocuments = documents
    .filter(doc => {
      // approvedDocuments solo tiene documentos aprobados, así que el filtro de estado no aplica
      // Pero mantenemos el filtro por si en el futuro agregamos rechazados
      if (filterStatus === 'todos') return true;
      return doc.status === filterStatus;
    })
    .sort((a, b) => {
      if (sortOption === 'reviewedAtDesc') {
        return (b.reviewedAt?.seconds || 0) - (a.reviewedAt?.seconds || 0);
      }
      if (sortOption === 'reviewedAtAsc') {
        return (a.reviewedAt?.seconds || 0) - (b.reviewedAt?.seconds || 0);
      }
      return 0;
    });

  if (loading) return <Box textAlign="center"><CircularProgress sx={{ color: "var(--primary-main)" }} /></Box>;
  if (error) return <Alert severity="error" sx={{ backgroundColor: "var(--paper-background)", color: "var(--paper-background-text)", borderColor: "var(--error-main)" }}>{error}</Alert>;

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel sx={{ color: "var(--page-background-text)" }}>Filtrar por estado</InputLabel>
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            label="Filtrar por estado"
            sx={{
              color: "var(--page-background-text)",
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "var(--divider-color)"
              },
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: "var(--divider-color)"
              },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderColor: "var(--primary-main)"
              },
              "& .MuiSelect-icon": {
                color: "var(--page-background-text)"
              }
            }}
            MenuProps={{
              PaperProps: {
                sx: {
                  backgroundColor: "var(--paper-background)",
                  color: "var(--page-background-text)",
                  "& .MuiMenuItem-root": {
                    color: "var(--page-background-text)",
                    "&:hover": {
                      backgroundColor: "var(--page-background)"
                    },
                    "&.Mui-selected": {
                      backgroundColor: "var(--primary-main)",
                      color: "var(--primary-text)",
                      "&:hover": {
                        backgroundColor: "var(--primary-dark)"
                      }
                    }
                  }
                }
              }
            }}
          >
            <MenuItem value="todos">Todos</MenuItem>
            <MenuItem value="Aprobado">Aprobados</MenuItem>
            <MenuItem value="Rechazado">Rechazados</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel sx={{ color: "var(--page-background-text)" }}>Ordenar por</InputLabel>
          <Select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            label="Ordenar por"
            sx={{
              color: "var(--page-background-text)",
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "var(--divider-color)"
              },
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: "var(--divider-color)"
              },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderColor: "var(--primary-main)"
              },
              "& .MuiSelect-icon": {
                color: "var(--page-background-text)"
              }
            }}
            MenuProps={{
              PaperProps: {
                sx: {
                  backgroundColor: "var(--paper-background)",
                  color: "var(--page-background-text)",
                  "& .MuiMenuItem-root": {
                    color: "var(--page-background-text)",
                    "&:hover": {
                      backgroundColor: "var(--page-background)"
                    },
                    "&.Mui-selected": {
                      backgroundColor: "var(--primary-main)",
                      color: "var(--primary-text)",
                      "&:hover": {
                        backgroundColor: "var(--primary-dark)"
                      }
                    }
                  }
                }
              }
            }}
          >
            <MenuItem value="reviewedAtDesc">Revisión (reciente)</MenuItem>
            <MenuItem value="reviewedAtAsc">Revisión (antiguo)</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <TableContainer component={Paper} sx={{ backgroundColor: "var(--paper-background)" }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: "var(--paper-background)" }}>
              <TableCell sx={{ color: "var(--paper-background-text)", fontWeight: "bold" }}>Empresa</TableCell>
              <TableCell sx={{ color: "var(--paper-background-text)", fontWeight: "bold" }}>Cliente</TableCell>
              <TableCell sx={{ color: "var(--paper-background-text)", fontWeight: "bold" }}>Documento</TableCell>
              <TableCell sx={{ color: "var(--paper-background-text)", fontWeight: "bold" }}>Entidad</TableCell>
              <TableCell sx={{ color: "var(--paper-background-text)", fontWeight: "bold" }}>Estado</TableCell>
              <TableCell sx={{ color: "var(--paper-background-text)", fontWeight: "bold" }}>Fecha de vencimiento</TableCell>
              <TableCell sx={{ color: "var(--paper-background-text)", fontWeight: "bold" }}>Revisado</TableCell>
              <TableCell sx={{ color: "var(--paper-background-text)", fontWeight: "bold" }}>Versión</TableCell>
              <TableCell align="center" sx={{ color: "var(--paper-background-text)", fontWeight: "bold" }}>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredAndSortedDocuments.map((doc) => (
              <React.Fragment key={doc.id}>
                <TableRow sx={{ backgroundColor: "var(--paper-background)" }}>
                  <TableCell sx={{ color: "var(--paper-background-text)" }}>{doc.companyName}</TableCell>
                  <TableCell sx={{ color: "var(--paper-background-text)" }}>
                    {doc.clientId 
                      ? (isLoadingClientNames ? '...' : (clientNamesMap[doc.clientId] || '-'))
                      : '-'}
                  </TableCell>
                  <TableCell sx={{ color: "var(--paper-background-text)" }}>{doc.requiredDocName || doc.name || doc.documentName || doc.fileName?.split('.')[0] || 'Sin nombre'}</TableCell>
                  <TableCell sx={{ color: "var(--paper-background-text)" }}>{doc.entityFullType}</TableCell>
                  <TableCell>
                    <Chip 
                      label={doc.status} 
                      color={doc.status === 'Aprobado' ? 'success' : 'error'} 
                      size="small" 
                    />
                  </TableCell>
                  <TableCell 
                    sx={{ 
                      color: doc.expirationDate ? getDeadlineColor(doc.expirationDate) : "var(--paper-background-text)",
                      opacity: !doc.expirationDate ? 0.7 : 1,
                      fontWeight: doc.expirationDate && (new Date(doc.expirationDate) - new Date())/(1000*60*60*24) <= 5 ? 'bold' : 'normal',
                      fontStyle: !doc.expirationDate ? 'italic' : 'normal'
                    }}
                  >
                    {doc.expirationDateFormatted}
                  </TableCell>
                  <TableCell sx={{ color: "var(--paper-background-text)" }}>{doc.reviewedAtFormatted}</TableCell>
                  <TableCell sx={{ color: "var(--paper-background-text)" }}>
                    <Tooltip title={`Versión ID: ${doc.version}`}>
                      <Typography variant="body2" sx={{ color: "var(--paper-background-text)" }}>{doc.versionString}</Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="center">
                    <IconButton 
                      onClick={() => setExpandedRow(expandedRow === doc.id ? null : doc.id)}
                      sx={{ color: "var(--icon-color)" }}
                    >
                      {expandedRow === doc.id ? <ExpandLess sx={{ color: "inherit" }} /> : <ExpandMore sx={{ color: "inherit" }} />}
                    </IconButton>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={9} style={{ padding: 0 }}>
                    <Collapse in={expandedRow === doc.id} timeout="auto" unmountOnExit>
                      <Box sx={{ p: 2, borderTop: `1px solid var(--divider-color)`, backgroundColor: "var(--page-background)" }}>
                      <VistaDocumentoSubido
  name={doc.name || doc.documentName}
  fileURL={doc.fileURL}
  uploadedByEmail={doc.uploadedByEmail}
  email={doc.email}
  realemail={doc.realemail}
  fileName={doc.fileName}
  uploaderName={doc.uploadedBy}
  documentDescription={doc.documentName}
  expirationDate={doc.expirationDate}
  comentario={doc.comentario}
  comment={doc.comment}
  companyId={doc.companyId}
  entityName={doc.entityName}
  companyName={doc.companyName}
  entityType={doc.entityType}
  uploadedAt={doc.uploadedAtFormatted}
  category={doc.category}
  status={doc.status || 'Pendiente de revisión'}
  companyComment={companyComment[doc.id] ?? doc.companyComment ?? ''}
  adminComment={adminComment[doc.id] ?? doc.adminComment ?? ''}
  metadata={{
    'Subido por': doc.uploadedByEmail || doc.email || doc.realemail || 'Desconocido',
    'Fecha subida': doc.uploadedAtFormatted,
    'Comentario original': companyComment[doc.id] ?? doc.companyComment ?? 'Sin comentario',
    'Comentario de revisión': adminComment[doc.id] ?? doc.adminComment ?? 'Sin comentarios aún',
    'Comentario de ejemplo': exampleComment[doc.id] ?? doc.exampleComment ?? 'Sin comentarios aún',
  }}
/>
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}>
                          <DownloadButton 
                            url={doc.fileURL} 
                            currentDocument={{
                              fileURL: doc.fileURL,               
                              companyName: doc.companyName,
                              name: doc.name,
                              entityName: doc.entityName,
                              entityType: doc.entityType
                            }}
                            label="Descargar" 
                            variant="outlined" 
                          />
                          <Button 
                            variant="contained" 
                            color="success" 
                            startIcon={<CheckCircle />} 
                            onClick={() => setDialogAccion({ tipo: 'aprobar', doc })}
                            disabled={isSubmitting || doc.status === 'Aprobado'}
                          >
                            {isSubmitting ? <CircularProgress size={24} /> : 'Aprobar nuevamente'}
                          </Button>
                          <Button 
                            variant="contained" 
                            color="error" 
                            startIcon={<Cancel />} 
                            onClick={() => setDialogAccion({ tipo: 'rechazar', doc })}
                            disabled={isSubmitting || doc.status === 'Rechazado'}
                          >
                            {isSubmitting ? <CircularProgress size={24} /> : 'Rechazar nuevamente'}
                          </Button>
                          {doc.status === 'Aprobado' && (
                            <Button 
                              variant="outlined" 
                              color="primary" 
                              onClick={() => {
                                // Inicializar la fecha de vencimiento actual si existe
                                if (doc.expirationDate && !newExpirationDates[doc.id]) {
                                  const currentDate = new Date(doc.expirationDate.seconds * 1000);
                                  const formattedDate = currentDate.toISOString().split('T')[0];
                                  setNewExpirationDates(prev => ({ ...prev, [doc.id]: formattedDate }));
                                }
                                setDialogAccion({ tipo: 'ajustar_fecha', doc });
                              }}
                              disabled={isSubmitting}
                            >
                              Cambiar fecha
                            </Button>
                          )}
                        </Box>
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <RevisionDocumentoDialog
        open={!!dialogAccion}
        tipo={dialogAccion?.tipo}
        doc={dialogAccion?.doc}
        onClose={() => setDialogAccion(null)}
        onConfirm={handleConfirm}
        expirationDate={newExpirationDates[dialogAccion?.doc?.id] || ''}
        setExpirationDate={(val) => setNewExpirationDates(prev => ({ ...prev, [dialogAccion.doc.id]: val }))}
        adminComment={adminComment[dialogAccion?.doc?.id] || ''}
        setAdminComment={(val) => setAdminComment(prev => ({ ...prev, [dialogAccion.doc.id]: val }))}
        companyComment={companyComment}
        setCompanyComment={(val) => setCompanyComment(val)}
        exampleComment={exampleComment}
        setExampleComment={(val) => setExampleComment(val)}
      />
    </Box>
  );
}