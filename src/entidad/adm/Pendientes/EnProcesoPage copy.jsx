// src/component/administrador/Pendientes/EnProcesoPage.jsx
import React, { useEffect, useState, useContext } from 'react';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { 
  Box, Typography, CircularProgress, Alert, Button, Chip, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  IconButton, Collapse, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { ExpandMore, ExpandLess, CheckCircle, Cancel, Download } from '@mui/icons-material';
import { db } from '../../../config/firebaseconfig';
import VistaDocumentoSubido from '../VistaDocumentoSubido';
import handleApproveOrReject from '../handleApproveOrReject';
import RevisionDocumentoDialog from '../RevisionDocumentoDialog';
import { useCompanies } from '../../../context/CompaniesContext';
import { AuthContext } from '../../../context/AuthContext';
import { useRefresh } from '../../../context/RefreshContext';
import DownloadButton from '../../../components/common/DownloadButton';
import { getDeadlineColor, getDeadlineStatus, getStatusIconComponent } from '../../../utils/getDeadlineUtils.jsx';
import { parseFirestoreDate } from '../../../utils/dateHelpers';
import { getTenantCollectionPath } from '../../../utils/tenantUtils';
import { useClientNamesMap } from '../../../utils/getClientName';
import { useMemo } from 'react';

export default function EnProcesoPage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogAccion, setDialogAccion] = useState(null);
  const [adminComment, setAdminComment] = useState({});
  const [companyComment, setCompanyComment] = useState({});
  const [exampleComment, setExampleComment] = useState({});
  const [newExpirationDates, setNewExpirationDates] = useState({});
  const [expandedRow, setExpandedRow] = useState(null);
  const [filterStatus, setFilterStatus] = useState('En proceso');
  const [sortOption, setSortOption] = useState('uploadedAtDesc');
  const [toastMessage, setToastMessage] = useState('');
  const [toastOpen, setToastOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { selectedCompany, companies } = useCompanies();
  const { user } = useContext(AuthContext);
  const { triggerRefresh } = useRefresh();

  // Listener para refresco automático desde aprobación masiva
  useEffect(() => {
    const handleRefresh = () => {
      console.log('🔄 Refrescando documentos en proceso por evento de aprobación masiva');
      // Forzar refresco de la lista
      if (companies) {
        const fetchDocs = async () => {
          setLoading(true);
          setError('');
          try {
            const statusToQuery = 'En proceso';
            const uploadedDocumentsPath = 'uploadedDocuments';
            let q = query(
              collection(db, uploadedDocumentsPath),
              where('status', '==', statusToQuery),
              where('companyId', '!=', null)
            );
            if (selectedCompany?.id) {
              q = query(q, where('companyId', '==', selectedCompany.id));
            }
            const snap = await getDocs(q);
            
            const docs = await Promise.all(snap.docs.map(async doc => {
              const company = companies.find(c => c.id === doc.data().companyId);
              const expirationDate = parseFirestoreDate(doc.data().expirationDate);
              const uploadedAt = parseFirestoreDate(doc.data().uploadedAt);
              // Lógica corregida para versiones - mostrar la versión correcta del documento
              let version = 1, subversion = 0, versionString = '1.0';

              // 1. PRIMERO usar versionString del documento (incluye subversión correcta)
              if (doc.data().versionString) {
                versionString = doc.data().versionString;
                const versionParts = versionString.split('.');
                version = parseInt(versionParts[0]) || 1;
                subversion = parseInt(versionParts[1]) || 0;
              } else if (doc.data().versionNumber && typeof doc.data().versionNumber === 'number') {
                // 2. Si no hay versionString, usar versionNumber y subversion por separado
                version = doc.data().versionNumber;
                subversion = doc.data().subversion || 0;
                versionString = `${version}.${subversion}`;
              } else if (doc.data().requiredDocumentId) {
                // 3. Como último recurso, buscar en requiredDocuments (para documentos nuevos)
                try {
                  const tenantCollectionPath = 'requiredDocuments';
                  const requiredSnap = await getDoc(doc(db, tenantCollectionPath, doc.data().requiredDocumentId));
                  if (requiredSnap.exists()) {
                    const reqData = requiredSnap.data();
                    version = typeof reqData.version === 'number' ? reqData.version : 1;
                    subversion = typeof reqData.subversion === 'number' ? reqData.subversion : 0;
                    versionString = reqData.versionString || `${version}.${subversion}`;
                  }
                } catch (e) {
                  // Si falla, deja valores por defecto
                }
              }
              return {
                id: doc.id,
                ...doc.data(),
                companyName: company?.name || 'Empresa no especificada',
                expirationDateFormatted: expirationDate?.toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                }) || 'Sin vencimiento',
                uploadedAtFormatted: uploadedAt ? uploadedAt.toLocaleString('es-ES', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }) : 'Sin fecha',
                companyComment: doc.data().companyComment,
                exampleComment: doc.data().exampleComment,
                adminComment: doc.data().adminComment,
                versionString,
                version,
                subversion,
                daysSinceUpload: uploadedAt 
                  ? Math.floor((new Date() - uploadedAt) / (1000 * 60 * 60 * 24)) 
                  : 'N/A',
                entityFullType: doc.data().entityType === 'company' ? 'Empresa' : 
                               doc.data().entityType === 'employee' ? 'Empleado' : 
                               doc.data().entityType === 'vehicle' ? 'Vehículo' : 'Desconocido',
                statusBadgeColor: doc.data().status === 'Pendiente de revisión' ? 'warning' : 
                                 doc.data().status === 'Aprobado' ? 'success' : 
                                 doc.data().status === 'En proceso' ? 'info' : 'error'
              };
            }));
            setDocuments(docs);
          } catch (err) {
            console.error(err);
            setError('Error al cargar documentos en proceso.');
          } finally {
            setLoading(false);
          }
        };
        fetchDocs();
      }
    };

    // Escuchar eventos de refresco
    window.addEventListener('pendientesShouldRefresh', handleRefresh);
    window.addEventListener('companyListShouldRefresh', handleRefresh);

    return () => {
      window.removeEventListener('pendientesShouldRefresh', handleRefresh);
      window.removeEventListener('companyListShouldRefresh', handleRefresh);
    };
  }, [selectedCompany, companies]);

  // Query reactivo y robusto: permite filtrar por estado, espera companies
  useEffect(() => {
    const fetchDocs = async () => {
      setLoading(true);
      setError('');
      try {
        // Solo mostrar documentos "En proceso"
        const statusToQuery = 'En proceso';
        // Usar la ruta multi-tenant correcta
        const uploadedDocumentsPath = 'uploadedDocuments';
        let q = query(
          collection(db, uploadedDocumentsPath),
          where('status', '==', statusToQuery),
          where('companyId', '!=', null) // Excluir documentos de ejemplo
        );
        if (selectedCompany?.id) {
          q = query(q, where('companyId', '==', selectedCompany.id));
        }
        const snap = await getDocs(q);
        console.log(`📋 Consulta documentos en proceso - Filtro: ${statusToQuery}, Documentos encontrados: ${snap.docs.length}`);
        
        // Obtener versiones reales desde requiredDocuments
        const docs = await Promise.all(snap.docs.map(async doc => {
          const company = companies.find(c => c.id === doc.data().companyId);
          const expirationDate = parseFirestoreDate(doc.data().expirationDate);
          const uploadedAt = parseFirestoreDate(doc.data().uploadedAt);
          // Lógica corregida para versiones - mostrar la versión correcta del documento
          let version = 1, subversion = 0, versionString = '1.0';

          // 1. PRIMERO usar versionString del documento (incluye subversión correcta)
          if (doc.data().versionString) {
            versionString = doc.data().versionString;
            const versionParts = versionString.split('.');
            version = parseInt(versionParts[0]) || 1;
            subversion = parseInt(versionParts[1]) || 0;
          } else if (doc.data().versionNumber && typeof doc.data().versionNumber === 'number') {
            // 2. Si no hay versionString, usar versionNumber y subversion por separado
            version = doc.data().versionNumber;
            subversion = doc.data().subversion || 0;
            versionString = `${version}.${subversion}`;
          } else if (doc.data().requiredDocumentId) {
            // 3. Como último recurso, buscar en requiredDocuments (para documentos nuevos)
            try {
              const tenantCollectionPath = 'requiredDocuments';
              const requiredSnap = await getDoc(doc(db, tenantCollectionPath, doc.data().requiredDocumentId));
              if (requiredSnap.exists()) {
                const reqData = requiredSnap.data();
                version = typeof reqData.version === 'number' ? reqData.version : 1;
                subversion = typeof reqData.subversion === 'number' ? reqData.subversion : 0;
                versionString = reqData.versionString || `${version}.${subversion}`;
              }
            } catch (e) {
              // Si falla, deja valores por defecto
            }
          }
          return {
            id: doc.id,
            ...doc.data(),
            companyName: company?.name || 'Empresa no especificada',
            expirationDateFormatted: expirationDate?.toLocaleDateString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            }) || 'Sin vencimiento',
            uploadedAtFormatted: uploadedAt ? uploadedAt.toLocaleString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }) : 'Sin fecha',
            companyComment: doc.data().companyComment,
            exampleComment: doc.data().exampleComment,
            adminComment: doc.data().adminComment,
            versionString,
            version,
            subversion,
            daysSinceUpload: uploadedAt 
              ? Math.floor((new Date() - uploadedAt) / (1000 * 60 * 60 * 24)) 
              : 'N/A',
            entityFullType: doc.data().entityType === 'company' ? 'Empresa' : 
                           doc.data().entityType === 'employee' ? 'Empleado' : 
                           doc.data().entityType === 'vehicle' ? 'Vehículo' : 'Desconocido',
            statusBadgeColor: doc.data().status === 'Pendiente de revisión' ? 'warning' : 
                             doc.data().status === 'Aprobado' ? 'success' : 
                             doc.data().status === 'En proceso' ? 'info' : 'error'
          };
        }));
        setDocuments(docs);
      } catch (err) {
        console.error(err);
        setError('Error al cargar documentos en proceso.');
      } finally {
        setLoading(false);
      }
    };
    // Esperar a que companies esté listo
    if (companies) fetchDocs();
  }, [selectedCompany, companies]);

  const handleConfirm = async () => {
    const { doc: selectedDoc, tipo } = dialogAccion || {};
    if (!selectedDoc?.id) {
      console.warn('handleConfirm: selectedDoc.id es nulo o indefinido. Saliendo.');
      return;
    }
    
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
        selectedCompany?.id,
        triggerRefresh
      );
      
      // Forzar cierre del modal después de la operación exitosa
      setDialogAccion(null);
      setExpandedRow(null);
      
      // Los refrescos de pestañas se manejan ahora en handleApproveOrReject
    } catch (error) {
      setToastMessage(`Error al ${tipo === 'aprobar' ? 'aprobar' : 'rechazar'} documento`);
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
    .sort((a, b) => {
      if (sortOption === 'uploadedAtDesc') {
        return (b.uploadedAt?.seconds || 0) - (a.uploadedAt?.seconds || 0);
      }
      if (sortOption === 'uploadedAtAsc') {
        return (a.uploadedAt?.seconds || 0) - (b.uploadedAt?.seconds || 0);
      }
      if (sortOption === 'daysSinceUploadDesc') {
        return (b.daysSinceUpload || 0) - (a.daysSinceUpload || 0);
      }
      if (sortOption === 'daysSinceUploadAsc') {
        return (a.daysSinceUpload || 0) - (b.daysSinceUpload || 0);
      }
      return 0;
    });

  if (loading) return <Box textAlign="center"><CircularProgress sx={{ color: "var(--primary-main)" }} /></Box>;
  if (error) return <Alert severity="error" sx={{ backgroundColor: "var(--paper-background)", color: "var(--paper-background-text)", borderColor: "var(--error-main)" }}>{error}</Alert>;

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        {/* Filtro por estado */}
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
            <MenuItem value="En proceso">En proceso</MenuItem>
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
            <MenuItem value="uploadedAtDesc">Subido (reciente)</MenuItem>
            <MenuItem value="uploadedAtAsc">Subido (antiguo)</MenuItem>
            <MenuItem value="daysSinceUploadDesc">Días pendiente (mayor)</MenuItem>
            <MenuItem value="daysSinceUploadAsc">Días pendiente (menor)</MenuItem>
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
              <TableCell sx={{ color: "var(--paper-background-text)", fontWeight: "bold" }}>Vencimiento</TableCell>
              <TableCell sx={{ color: "var(--paper-background-text)", fontWeight: "bold" }}>Version</TableCell>
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
                <TableCell sx={{ color: "var(--paper-background-text)" }}>{doc.name || doc.documentName || doc.fileName?.split('.')[0] || 'Sin nombre'}</TableCell>
                <TableCell sx={{ color: "var(--paper-background-text)" }}>{doc.entityFullType}</TableCell>
                  <TableCell>
                    <Chip 
                      label={doc.status} 
                      color={doc.statusBadgeColor} 
                      size="small" 
                    />
                  </TableCell>
                  <TableCell 
                    sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      color: getDeadlineColor(doc.expirationDate),
                      fontWeight: doc.expirationDate && (new Date(doc.expirationDate) - new Date())/(1000*60*60*24) <= 5 ? 'bold' : 'normal'
                    }}
                  >
                    {doc.expirationDate && (
                      <>
                        {getStatusIconComponent(getDeadlineStatus(doc.expirationDate).icon)}
                        {doc.expirationDateFormatted}
                      </>
                    )}
                    {!doc.expirationDate && 'Sin fecha'}
                  </TableCell>
                  <TableCell sx={{ color: "var(--paper-background-text)" }}>
                    <Tooltip title={`Versión: ${doc.version}`}>
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
                  <TableCell colSpan={8} style={{ padding: 0 }}>
                    <Collapse in={expandedRow === doc.id} timeout="auto" unmountOnExit>
                      <Box sx={{ p: 2, borderTop: `1px solid var(--divider-color)`, backgroundColor: "var(--page-background)" }}>
                      <VistaDocumentoSubido
  documentId={doc.id}
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
  status={doc.status || 'En proceso'}
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
                          {doc.status === 'En proceso' && (
                            <>
                              <Button 
                                variant="contained" 
                                color="success" 
                                startIcon={<CheckCircle />} 
                                onClick={() => setDialogAccion({ tipo: 'aprobar', doc })}
                                disabled={isSubmitting}
                              >
                                {isSubmitting ? <CircularProgress size={24} /> : 'Confirmar Aprobación'}
                              </Button>
                              <Button 
                                variant="contained" 
                                color="error" 
                                startIcon={<Cancel />} 
                                onClick={() => setDialogAccion({ tipo: 'rechazar', doc })}
                                disabled={isSubmitting}
                              >
                                {isSubmitting ? <CircularProgress size={24} /> : 'Rechazar'}
                              </Button>
                            </>
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
        companyComment={companyComment[dialogAccion?.doc?.id] || ''}
        setCompanyComment={(val) => setCompanyComment(prev => ({ ...prev, [dialogAccion.doc.id]: val }))}
        exampleComment={exampleComment[dialogAccion?.doc?.id] || ''}
        setExampleComment={(val) => setExampleComment(prev => ({ ...prev, [dialogAccion.doc.id]: val }))}
        setToastMessage={(msg) => setToastMessage(msg)}
        setToastOpen={(open) => setToastOpen(open)}
      />
    </Box>
  );
}
