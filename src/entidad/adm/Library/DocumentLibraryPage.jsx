import React, { useContext, useState, useMemo } from 'react';
import { 
  Box, 
  Typography, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Button,
  Dialog,
  DialogContent,
  DialogActions,
  CircularProgress,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  Checkbox,
  TextField,
  InputAdornment,
  Autocomplete,
  Chip,
  Divider
} from '@mui/material';
import { Search as SearchIcon, Clear as ClearIcon } from '@mui/icons-material';
import { AuthContext } from '../../../context/AuthContext';
import { useCompanies } from '../../../context/CompaniesContext';
import { useRefresh } from '../../../context/RefreshContext';
import { useDocumentAll } from './DocumentAll';
import DocumentTable from './DocumentTable';
import MultiDownloadZipButton from '../../../components/MultiDownloadZipButton'; // Importación del botón ZIP
import DocumentViewer from './DocumentViewer';
import DateRangeWithPresets from './DateRangeWithPresets';
import IHatePdfModal from './components/IHatePdfModal';
// --- Integración Backups ---
import { useBackups } from './backup/useBackups';
import BackupTable from './backup/BackupTable';
// --- Smart Backup Imports ---
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { uploadFile } from '../../../utils/FileUploadService';
import { getAuth } from 'firebase/auth';
import { getClientNamesBatch } from '../../../utils/getClientName';
import { marcarArchivosBackupConMetadata } from '../../../utils/MetadataService';

/**
 * Helper para obtener solo la última versión de cada documento
 * según la clave companyId + entityType + entityName + name
 * Compara usando el campo 'version' (numérico o string convertible)
 */
function getLatestDocuments(documents = []) {
  const map = new Map();
  documents.forEach(doc => {
    // Clave única
    const key = [doc.companyId, doc.entityType, doc.entityName, doc.name].join('||');
    const current = map.get(key);
    const docVersion = typeof doc.version === 'string' ? parseFloat(doc.version) : doc.version;
    if (!current) {
      map.set(key, doc);
    } else {
      const currVersion = typeof current.version === 'string' ? parseFloat(current.version) : current.version;
      if (docVersion > currVersion) {
        map.set(key, doc);
      } else if (docVersion === currVersion) {
        // Si hay empate, tomar el más reciente por fecha
        const docDate = doc.reviewedAt instanceof Date ? doc.reviewedAt : (doc.reviewedAt?.toDate ? doc.reviewedAt.toDate() : new Date(doc.reviewedAt));
        const currDate = current.reviewedAt instanceof Date ? current.reviewedAt : (current.reviewedAt?.toDate ? current.reviewedAt.toDate() : new Date(current.reviewedAt));
        if (docDate > currDate) {
          map.set(key, doc);
        }
      }
    }
  });
  return Array.from(map.values());
}

export default function DocumentLibraryPage() {
  // --- Integración Backups ---
  const { selectedCompany } = useCompanies();
  const { user, token } = useContext(AuthContext);
  const { getRefreshKey } = useRefresh();
  // Pestaña activa primero
  const [currentTab, setCurrentTab] = useState(0); // 0 para 'Últimos', 1 para 'Histórico', 2 para 'Backups'
  // Estado de rango de fechas debe ir antes del uso en useBackups
  const [dateRange, setDateRange] = useState({
    start: null,
    end: null
  });
  // Permitir admin y superadmin (max)
  const isAdmin = user?.role === "admin" || user?.role === "max";
  const { backups, loading: loadingBackups, error: errorBackups, refreshBackups } = useBackups({
    isAdmin,
    selectedCompanyId: selectedCompany?.id || null,
    startDate: currentTab === 2 ? dateRange.start : null,
    endDate: currentTab === 2 ? dateRange.end : null,
    currentTab: currentTab // Agregar currentTab para que se refresque cuando cambia la pestaña
  });
  // --- Backup State ---
  const [loadingBackup, setLoadingBackup] = useState(false);
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [backupResult, setBackupResult] = useState(null);
  
  // --- Smart Backup State ---
  const [loadingSmartBackup, setLoadingSmartBackup] = useState(false);
  const [smartBackupResult, setSmartBackupResult] = useState(null);

  // --- Backup Logic ---
  const handleBackupClick = () => {
    if (selectedFiles.length > 0) {
      handleGenerateBackup(selectedFiles);
    } else {
      setBackupModalOpen(true);
    }
  };

  // --- INTEGRACIÓN DE METADATA DE BACKUP ---
  // Importar la función en el encabezado: import { marcarArchivosBackupConMetadata } from '../../../utils/MetadataService';
  const handleGenerateBackup = async (docIds) => {
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
      const { marcarArchivosBackupConMetadata } = await import('../../../utils/MetadataService');
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
      
      // Refrescar la lista de backups para que aparezcan los nuevos
      refreshBackups();
    } catch (err) {
      setBackupResult({ type: 'error', message: err.message });
    } finally {
      setLoadingBackup(false);
      setBackupModalOpen(false);
    }
  };

  // Agrupa archivos en lotes de hasta 400MB para backups ZIP
  function agruparPorTamanioMaximo(archivos, maxBytes = 400 * 1024 * 1024) {
    const grupos = [];
    let grupoActual = [];
    let sizeActual = 0;
    for (const file of archivos) {
      const fileSize = typeof file.size === 'number' ? file.size : (file.fileSize || 0);
      if ((sizeActual + fileSize) > maxBytes && grupoActual.length > 0) {
        grupos.push(grupoActual);
        grupoActual = [];
        sizeActual = 0;
      }
      grupoActual.push(file);
      sizeActual += fileSize;
    }
    if (grupoActual.length > 0) grupos.push(grupoActual);
    return grupos;
  }

  const handleConfirmBackupAll = () => {
    handleGenerateBackup(allDocuments.map(doc => doc.id));
  };

  // Cierra el modal de feedback del backup
  const handleCloseBackupResult = () => setBackupResult(null);

  // Estado para selección múltiple
  const [selectedFiles, setSelectedFiles] = useState([]);

  // Alternar selección individual
  const toggleFileSelection = (id) => {
    setSelectedFiles((prev) =>
      prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]
    );
  };

  // Seleccionar/deseleccionar todos
  const selectAllFiles = () => {
    if (selectedFiles.length === filteredAndSortedDocs.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(filteredAndSortedDocs.map((doc) => doc.id));
    }
  };

  const [entityTypeFilter, setEntityTypeFilter] = useState('todos');
  const [entityNameFilter, setEntityNameFilter] = useState('todos');
  const [searchText, setSearchText] = useState('');
  const [openDateModal, setOpenDateModal] = useState(false);
  const [sortBy, setSortBy] = useState('companyName');
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentDoc, setCurrentDoc] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [ihatePdfModalOpen, setIHatePdfModalOpen] = useState(false);
  const [selectedPdfDoc, setSelectedPdfDoc] = useState(null);

  const { companies } = useCompanies();
  const refreshKey = getRefreshKey('dashboard');
  
  // Obtener IDs de empresas asignadas
  const assignedCompanyIds = useMemo(() => {
    return new Set(companies.map(c => c.id));
  }, [companies]);
  
  const { documents: allDocuments = [], loading, error } = useDocumentAll({
    isAdmin,
    selectedCompanyId: selectedCompany === null ? 'todas' : selectedCompany?.id,
    assignedCompanyIds,
    refreshKey
  });

  const latestDocuments = useMemo(() => getLatestDocuments(allDocuments), [allDocuments]);

  const documentsToShow = useMemo(() => {
    if (currentTab === 0) {
      return latestDocuments;
    } else {
      return allDocuments;
    }
  }, [currentTab, latestDocuments, allDocuments]);

  const filteredAndSortedDocs = useMemo(() => {
    return documentsToShow
      .filter(doc => {
        if (entityTypeFilter !== 'todos' && doc.entityType !== entityTypeFilter) return false;
        if ((entityTypeFilter === 'employee' || entityTypeFilter === 'vehicle') &&
            entityNameFilter !== 'todos' && doc.entityName !== entityNameFilter) return false;

        if (dateRange.start && dateRange.end) {
          const fecha = doc.reviewedAt;
          const docDate = fecha?.toDate ? fecha.toDate() : fecha;
          if (!(docDate instanceof Date) || isNaN(docDate)) return false;
          return docDate >= dateRange.start && docDate <= dateRange.end;
        }

        // Filtro de búsqueda por nombre de documento
        if (searchText.trim()) {
          const searchLower = searchText.toLowerCase().trim();
          const nombreDoc = (doc.nombreOriginal || doc.name || doc.documentName || '').toLowerCase();
          const entidadDoc = (doc.entityName || '').toLowerCase();
          const empresaDoc = (doc.companyName || '').toLowerCase();
          
          if (!nombreDoc.includes(searchLower) && 
              !entidadDoc.includes(searchLower) && 
              !empresaDoc.includes(searchLower)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        let comparison = 0;
        switch(sortBy) {
          case 'companyName':
            comparison = (a.companyName || '').localeCompare(b.companyName || '');
            break;
          case 'name':
            comparison = (a.nombreOriginal || '').localeCompare(b.nombreOriginal || '');
            break;
          case 'category':
            comparison = (a.entityType || '').localeCompare(b.entityType || '');
            break;
          case 'entityName':
            comparison = (a.entityName || '').localeCompare(b.entityName || '');
            break;
          case 'size':
            comparison = (a.size || 0) - (b.size || 0);
            break;
          case 'date':
            comparison = new Date(a.reviewedAt || 0) - new Date(b.reviewedAt || 0);
            break;
          case 'subversion':
            comparison = (parseFloat(a.version) || 0) - (parseFloat(b.version) || 0);
            break;
          default:
            comparison = 0;
        }
        return sortDirection === 'asc' ? comparison : -comparison;
      });
  }, [documentsToShow, entityTypeFilter, entityNameFilter, dateRange.start, dateRange.end, sortBy, sortDirection, searchText]);

  const handleViewDetails = (docId) => {
    const doc = filteredAndSortedDocs.find(d => d.id === docId);
    setCurrentDoc(doc);
    setViewerOpen(true);
  };

  const handleIHatePdf = (doc) => {
    setSelectedPdfDoc(doc);
    setIHatePdfModalOpen(true);
  };

  const entityNames = useMemo(() => {
    if (entityTypeFilter !== 'employee' && entityTypeFilter !== 'vehicle') return [];
    const namesSet = new Set();
    allDocuments.forEach(doc => {
      if (doc.entityType === entityTypeFilter) {
        namesSet.add(doc.entityName || 'Desconocido');
      }
    });
    return Array.from(namesSet).sort();
  }, [allDocuments, entityTypeFilter]);

  // Nombres únicos de documentos para autocomplete
  const documentNames = useMemo(() => {
    const namesSet = new Set();
    const entitiesSet = new Set();
    const companiesSet = new Set();
    
    allDocuments.forEach(doc => {
      const docName = doc.nombreOriginal || doc.name || doc.documentName;
      if (docName) namesSet.add(docName);
      
      if (doc.entityName) entitiesSet.add(doc.entityName);
      if (doc.companyName) companiesSet.add(doc.companyName);
    });
    
    return {
      documents: Array.from(namesSet).sort(),
      entities: Array.from(entitiesSet).sort(),
      companies: Array.from(companiesSet).sort()
    };
  }, [allDocuments]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 5 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) return <Box textAlign="center"><Typography color="error">{error}</Typography></Box>;

  // Helper consistente para nombre de archivo y agrupamiento lógico
  const getLogicalGroupKey = (doc) => {
    // Usar originalName como prioridad para agrupamiento lógico
    const documentName = doc.originalName || doc.name || doc.documentName || doc.nombreOriginal || 'SinNombre';
    
    return [
      documentName,
      doc.entityName,
      doc.entityType === 'vehicle' ? 'VEHICULO' : doc.entityType === 'employee' ? 'EMPLEADO' : 'EMPRESA',
      doc.companyName,
      doc.version
    ]
      .filter(Boolean)
      .join('_')
      .replace(/\s+/g, '_')
      .replace(/[^\w\-\.]/g, '');
  };

  // Helper para extraer extensión
  function getFileExtension(filename = '') {
    const match = filename.match(/\.([a-zA-Z0-9]+)$/);
    return match ? match[0] : '';
  }

  // Preparar archivos seleccionados para el ZIP
  const selectedDocs = filteredAndSortedDocs.filter((doc) =>
    selectedFiles.includes(doc.id)
  );
  // Documentos sin backup general (siempre de todos los documentos)
  const docsSinBackupGeneral = allDocuments.filter(doc => !doc.generalBackup);
  
  // --- SMART BACKUP LOGIC ---
  // Documentos sin smart backup
  const docsSinSmartBackup = allDocuments.filter(doc => !doc.smartBackup);
  
  // Documentos filtrados para Smart Backup (aplicando filtros actuales)
  const docsSinSmartBackupFiltrados = docsSinSmartBackup.filter(doc => {
    // Filtro por tipo de entidad
    if (entityTypeFilter !== 'todos' && doc.entityType !== entityTypeFilter) {
      return false;
    }
    
    // Filtro por nombre de entidad
    if (entityNameFilter !== 'todos' && doc.entityName !== entityNameFilter) {
      return false;
    }
    
    // Filtro por fechas
    if (dateRange.start && dateRange.end) {
      const docDate = new Date(doc.createdAt || doc.uploadedAt);
      if (docDate < dateRange.start || docDate > dateRange.end) {
        return false;
      }
    }
    
    return true;
  });
  
  // Función para crear clave inteligente de agrupación
  const getSmartGroupKey = (doc) => {
    const entityTypeText = doc.entityType === 'vehicle' ? 'VEHICULO' : 
                          doc.entityType === 'employee' ? 'EMPLEADO' : 'EMPRESA';
    
    // Usar originalName como prioridad, luego name, luego documentName
    const documentName = doc.originalName || doc.name || doc.documentName || 'SinNombre';
    
    return [
      doc.companyName || 'SinEmpresa',
      documentName,
      entityTypeText,
      doc.entityName || 'SinEntidad'
    ]
      .filter(Boolean)
      .join('-')
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]/g, '');
  };
  
  // Función para agrupar documentos inteligentemente
  const groupDocumentsForSmartBackup = (documents) => {
    const groups = {};
    documents.forEach(doc => {
      const groupKey = getSmartGroupKey(doc);
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(doc);
    });
    
    // Ordenar cada grupo por versionString o versionNumber
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        const aVersion = parseFloat(a.versionString || a.version || 0);
        const bVersion = parseFloat(b.versionString || b.version || 0);
        return bVersion - aVersion; // Orden descendente (última versión primero)
      });
    });
    
    return groups;
  };
  
  // Función helper para extraer metadata agregada de documentos
  const extractDocumentsMetadata = (documents) => {
    const metadata = {
      companyIds: new Set(),
      companyNames: new Set(),
      entityTypes: new Set(),
      entityNames: new Set(),
      documentNames: new Set(),
      companyIdsMap: {} // Map companyName -> companyId
    };

    documents.forEach(doc => {
      if (doc.companyId) {
        metadata.companyIds.add(doc.companyId);
        if (doc.companyName) {
          metadata.companyNames.add(doc.companyName);
          metadata.companyIdsMap[doc.companyName] = doc.companyId;
        }
      }
      if (doc.entityType) metadata.entityTypes.add(doc.entityType);
      if (doc.entityName) metadata.entityNames.add(doc.entityName);
      const docName = doc.name || doc.documentName || doc.nombreOriginal || doc.originalName;
      if (docName) metadata.documentNames.add(docName);
    });

    return {
      companyIds: Array.from(metadata.companyIds),
      companyNames: Array.from(metadata.companyNames),
      entityTypes: Array.from(metadata.entityTypes),
      entityNames: Array.from(metadata.entityNames),
      documentNames: Array.from(metadata.documentNames),
      documentCount: documents.length,
      companiesCount: metadata.companyIds.size,
      entitiesCount: metadata.entityNames.size
    };
  };

  // Función para generar Smart Backup con filtros aplicados
  const handleGenerateSmartBackup = async () => {
    setLoadingSmartBackup(true);
    setSmartBackupResult(null);
    
    try {
      if (docsSinSmartBackupFiltrados.length === 0) {
        setSmartBackupResult({ 
          type: 'error', 
          message: 'No hay documentos que coincidan con los filtros aplicados para smart backup.' 
        });
        setLoadingSmartBackup(false);
        return;
      }
      
      // Extraer metadata agregada de los documentos
      const aggregatedMetadata = extractDocumentsMetadata(docsSinSmartBackupFiltrados);
      console.log('[SmartBackup] Metadata agregada:', aggregatedMetadata);
      
      const zip = new JSZip();
      const groups = groupDocumentsForSmartBackup(docsSinSmartBackupFiltrados);
      
      console.log('[SmartBackup] Grupos generados:', groups);
      
      // Obtener nombres de clientes de todos los documentos
      const allClientIds = [...new Set(docsSinSmartBackupFiltrados.map(doc => doc.clientId).filter(Boolean))];
      const clientNamesMap = await getClientNamesBatch(allClientIds);
      
      // Procesar cada grupo
      for (const [groupKey, docs] of Object.entries(groups)) {
        const pdfDocs = docs.filter(doc => doc.fileType === 'application/pdf');
        
        if (pdfDocs.length === 0) continue;
        
        if (pdfDocs.length === 1) {
          // Solo un PDF, descargarlo directamente
          try {
            const response = await fetch(pdfDocs[0].fileURL);
            if (response.ok) {
              const blob = await response.blob();
              zip.file(`${groupKey}.pdf`, blob);
              console.log(`[SmartBackup] PDF individual agregado: ${groupKey}.pdf`);
            }
          } catch (err) {
            console.warn(`Error descargando ${groupKey}:`, err);
          }
        } else {
          // Múltiples PDFs - guardar individualmente (PDF merging removed)
          try {
            for (const doc of pdfDocs) {
              const response = await fetch(doc.fileURL);
              if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                const fileName = `${groupKey}_${doc.name || 'document'}.pdf`;
                zip.file(fileName, new Blob([arrayBuffer], { type: 'application/pdf' }));
                console.log(`[SmartBackup] PDF individual agregado: ${fileName}`);
              }
            }
          } catch (err) {
            console.warn(`Error procesando PDFs para ${groupKey}:`, err);
          }
        }
      }
      
      // Generar ZIP
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const fecha = new Date();
      const zipName = `smart_backup_${fecha.toISOString().slice(0,10)}.zip`;
      
      // Descargar ZIP
      saveAs(zipBlob, zipName);
      
      // Subir backup a Backblaze
      const zipFile = new File([zipBlob], zipName, { type: "application/zip" });
      const metadata = {
        type: "backup",
        name: zipName,
        backupInfo: {
          tipo: "smart_backup",
          cantidadArchivos: docsSinSmartBackupFiltrados.length,
          grupos: Object.keys(groups).length,
          filtros: {
            entityType: entityTypeFilter,
            entityName: entityNameFilter,
            fechaInicio: dateRange.start?.toISOString(),
            fechaFin: dateRange.end?.toISOString()
          },
          metadata: aggregatedMetadata
        },
        comentario: "Smart Backup generado - documentos agrupados"
      };
      
      const uploadResponse = await uploadFile(zipFile, "Admin/backups", metadata);
      const backupURL = uploadResponse?.url || uploadResponse?.fileURL || uploadResponse?.downloadURL || '';
      const backupId = zipName;
      
      // Obtener usuario actual
      const auth = getAuth();
      const currentUser = auth.currentUser ? {
        uid: auth.currentUser.uid,
        email: auth.currentUser.email,
        realemail: auth.currentUser.email
      } : user;
      
      // Marcar documentos con smartBackup metadata
      const { marcarArchivosBackupConMetadata } = await import('../../../utils/MetadataService');
      await marcarArchivosBackupConMetadata({
        files: docsSinSmartBackupFiltrados,
        backupType: 'smartBackup',
        backupURL,
        backupId,
        user: currentUser
      });
      
      setSmartBackupResult({
        type: 'success',
        message: `Smart Backup generado exitosamente. ${Object.keys(groups).length} grupos procesados.`,
        url: backupURL
      });
      
      // Refrescar la lista de backups para que aparezca el nuevo
      refreshBackups();
      
    } catch (err) {
      console.error('[SmartBackup] Error:', err);
      setSmartBackupResult({ type: 'error', message: err.message });
    } finally {
      setLoadingSmartBackup(false);
    }
  };
  
  // Cerrar modal de resultado de Smart Backup
  const handleCloseSmartBackupResult = () => setSmartBackupResult(null);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 2, color: "var(--page-background-text)" }}>
        Documentos Aprobados
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'var(--divider-color)', mb: 2 }}>
        <Tabs 
          value={currentTab} 
          onChange={(event, newValue) => setCurrentTab(newValue)} 
          aria-label="document tabs"
          textColor="primary"
          indicatorColor="primary"
          sx={{
            "& .MuiTab-root": {
              color: "var(--page-background-text)"
            },
            "& .MuiTab-root.Mui-selected": {
              color: "var(--tab-active-text) !important"
            },
            "& .MuiTabs-indicator": {
              backgroundColor: "var(--tab-active-text) !important"
            }
          }}
        >
          <Tab 
            label="Últimos Documentos" 
            sx={{
              "&.Mui-selected": {
                color: "var(--tab-active-text) !important"
              }
            }}
          />
          <Tab 
            label="Histórico" 
            sx={{
              "&.Mui-selected": {
                color: "var(--tab-active-text) !important"
              }
            }}
          />
          {isAdmin && (
            <Tab 
              label="Backups" 
              sx={{
                "&.Mui-selected": {
                  color: "var(--tab-active-text) !important"
                }
              }}
            />
          )}
        </Tabs>
      </Box>

      {/* Botón de descarga múltiple en ZIP y HACER BACKUP */}
      <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
        <MultiDownloadZipButton
          files={selectedDocs.map((doc) => ({
            id: doc.id,
            url: doc.fileURL,
            fileType: doc.fileType,
            filename: (doc.fileName || doc.nombreOriginal || doc.name) || (getLogicalGroupKey(doc) + getFileExtension(doc.fileName || doc.nombreOriginal || doc.name)),
            name: doc.name || doc.documentName || doc.nombreOriginal,
            entityName: doc.entityName,
            entityType: doc.entityType === 'vehicle' ? 'VEHICULO' : doc.entityType === 'employee' ? 'EMPLEADO' : 'EMPRESA',
            companyName: doc.companyName,
            version: doc.version
          }))}
          zipName="documentos_seleccionados.zip"
          label="Descargar seleccionados (.zip)"
          disabled={selectedDocs.length === 0}
          size="small"
        />
        {/* --- BACKUP HISTÓRICO: todos los documentos sin backup --- */}
        {docsSinBackupGeneral.length < 10 && docsSinBackupGeneral.length > 0 && (
          <Box sx={{ mb: 1 }}>
            <Typography color="warning.main" variant="subtitle2">
              {docsSinBackupGeneral.length === 1
                ? 'Solo hay 1 documento sin backup histórico.'
                : `Se guardarán como backup histórico ${docsSinBackupGeneral.length} documentos.`}
            </Typography>
          </Box>
        )}
        {docsSinBackupGeneral.length === 0 && (
          <Box sx={{ mb: 1 }}>
            <Typography color="success.main" variant="subtitle2">
              Todos los documentos ya tienen backup histórico.
            </Typography>
          </Box>
        )}
        <MultiDownloadZipButton
          files={docsSinBackupGeneral.map((doc) => ({
            id: doc.id,
            url: doc.fileURL,
            fileType: doc.fileType,
            filename: (doc.fileName || doc.nombreOriginal || doc.name) || (getLogicalGroupKey(doc) + getFileExtension(doc.fileName || doc.nombreOriginal || doc.name)),
            name: doc.name || doc.documentName || doc.nombreOriginal,
            entityName: doc.entityName,
            entityType: doc.entityType === 'vehicle' ? 'VEHICULO' : doc.entityType === 'employee' ? 'EMPLEADO' : 'EMPRESA',
            companyName: doc.companyName,
            version: doc.version
          }))}
          zipName="backup_historico.zip"
          label={loadingBackup ? "Generando backup..." : "Backup Histórico (.zip)"}
          disabled={docsSinBackupGeneral.length === 0 || loadingBackup}
          size="small"
        />
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        {/* Filtro por tipo */}
        <FormControl sx={{ minWidth: 200 }} size="small">
          <InputLabel id="entity-type-select-label">Filtrar por tipo</InputLabel>
          <Select
            labelId="entity-type-select-label"
            value={entityTypeFilter}
            label="Filtrar por tipo"
            onChange={(e) => {
              setEntityTypeFilter(e.target.value);
              setEntityNameFilter('todos');
            }}
          >
            <MenuItem value="todos">Todos</MenuItem>
            <MenuItem value="company">Empresa</MenuItem>
            <MenuItem value="employee">Personal</MenuItem>
            <MenuItem value="vehicle">Vehículo</MenuItem>
          </Select>
        </FormControl>

        {/* Filtro por nombre solo si es personal o vehículo */}
        {(entityTypeFilter === 'employee' || entityTypeFilter === 'vehicle') && (
          <FormControl sx={{ minWidth: 200 }} size="small">
            <InputLabel id="entity-name-select-label">Filtrar por nombre</InputLabel>
            <Select
              labelId="entity-name-select-label"
              value={entityNameFilter}
              label="Filtrar por nombre"
              onChange={(e) => setEntityNameFilter(e.target.value)}
            >
              <MenuItem value="todos">Todos</MenuItem>
              {entityNames.map((name) => (
                <MenuItem key={name} value={name}>
                  {name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* Botón para abrir el modal de fechas */}
        <Button 
          variant="outlined" 
          onClick={() => setOpenDateModal(true)}
          sx={{ height: 40 }}
        >
          Buscar por fecha
        </Button>

        {/* Campo de búsqueda con autocomplete */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Autocomplete
            freeSolo
            options={[...documentNames.documents, ...documentNames.entities, ...documentNames.companies]}
            inputValue={searchText}
            onInputChange={(event, newInputValue) => setSearchText(newInputValue)}
            size="small"
            sx={{ minWidth: 300 }}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Buscar documentos, entidades, empresas..."
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            )}
            renderOption={(props, option) => (
              <li {...props} key={option}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SearchIcon fontSize="small" color="action" />
                  <Typography variant="body2">{option}</Typography>
                </Box>
              </li>
            )}
          />
          {searchText && (
            <Button
              size="small"
              onClick={() => setSearchText('')}
              sx={{ minWidth: 'auto', px: 1 }}
              startIcon={<ClearIcon />}
            >
              Limpiar
            </Button>
          )}
        </Box>

        {/* Botón Descargar todo para pestaña Últimos */}
        {currentTab === 0 && filteredAndSortedDocs.length > 0 && (
          <MultiDownloadZipButton
            files={filteredAndSortedDocs.map((doc) => ({
              id: doc.id,
              url: doc.fileURL,
              fileType: doc.fileType,
              filename: (doc.fileName || doc.nombreOriginal || doc.name) || (getLogicalGroupKey(doc) + getFileExtension(doc.fileName || doc.nombreOriginal || doc.name)),
              name: doc.name || doc.documentName || doc.nombreOriginal,
              entityName: doc.entityName,
              entityType: doc.entityType === 'vehicle' ? 'VEHICULO' : doc.entityType === 'employee' ? 'EMPLEADO' : 'EMPRESA',
              companyName: doc.companyName,
              version: doc.version
            }))}
            zipName="ultimos_documentos.zip"
            label={`Descargar todo (${filteredAndSortedDocs.length})`}
            disabled={false}
            createBackup={false}
          />
        )}

        {/* Mostrar rango seleccionado si existe */}
        {(dateRange.start || dateRange.end) && (
          <Button 
            variant="outlined" 
            onClick={() => setDateRange({ start: null, end: null })}
            size="small"
            sx={{ height: 40 }}
          >
            Limpiar fechas
          </Button>
        )}
        
        {/* --- SMART BACKUP: Solo en pestaña Histórico --- */}
        {currentTab === 1 && (
          <>
            {/* Información sobre Smart Backup */}
            {docsSinSmartBackupFiltrados.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography color="info.main" variant="body2">
                  {docsSinSmartBackupFiltrados.length === 1
                    ? '1 doc. filtrado'
                    : `${docsSinSmartBackupFiltrados.length} documentos`}
                </Typography>
              </Box>
            )}
            
            {/* Botón Smart Backup */}
            <Button
              variant="contained"
              color="secondary"
              size="small"
              onClick={handleGenerateSmartBackup}
              disabled={docsSinSmartBackupFiltrados.length === 0 || loadingSmartBackup}
              sx={{ minWidth: 120 }}
            >
              {loadingSmartBackup ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                `Smart Backup (${docsSinSmartBackupFiltrados.length})`
              )}
            </Button>
            
          </>
        )}
      </Box>

      {/* Modal para selección de fechas */}
      <Dialog open={openDateModal} onClose={() => setOpenDateModal(false)} maxWidth="md">
        <DialogContent>
          <DateRangeWithPresets 
            onApply={(range) => {
              const start = new Date(range.start);
              start.setHours(0, 0, 0, 0); // Inicio del día

              const end = new Date(range.end);
              end.setHours(23, 59, 59, 999); // Fin del día

              setDateRange({ start, end });
              setOpenDateModal(false);
            }} 
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDateModal(false)}>Cancelar</Button>
        </DialogActions>
      </Dialog>

      {/* Render condicional de tablas por pestaña */}
      {((currentTab === 0) || (currentTab === 1)) && (
        <DocumentTable 
          documents={filteredAndSortedDocs}
          selectedCompany={selectedCompany}
          selectedFiles={selectedFiles}
          toggleFileSelection={toggleFileSelection}
          selectAllFiles={selectAllFiles}
          formatFileSize={(bytes) => bytes ? `${(bytes/1024).toFixed(2)} KB` : '-'}
          formatDate={(date) => date?.toLocaleDateString?.('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          }) || '-'}
          viewMode="list"
          onViewDetails={handleViewDetails}
          onIHatePdf={handleIHatePdf}
          sortBy={sortBy}
          sortDirection={sortDirection}
          setSortBy={setSortBy}
          setSortDirection={setSortDirection}
        />
      )}

      {/* Pestaña Backups solo para admin */}
      {currentTab === 2 && isAdmin && (
        <Box mt={2}>
          {loadingBackups ? (
            <CircularProgress />
          ) : errorBackups ? (
            <Typography color="error">{errorBackups}</Typography>
          ) : (
            <BackupTable
              backups={backups}
              selectedCompany={selectedCompany}
            />
          )}
        </Box>
      )}

      {currentDoc && (
        <DocumentViewer
          open={viewerOpen}
          handleClose={() => setViewerOpen(false)}
          currentDocument={currentDoc}
          handleDownload={(url, name) => window.open(url, '_blank')}
          formatFileSize={(bytes) => bytes ? `${(bytes/1024).toFixed(2)} KB` : '-'}
          formatDate={(date) => date?.toLocaleDateString?.('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          }) || '-'}
        />
      )}
      
      {/* Modal de confirmación para backup histórico */}
      <Dialog open={backupModalOpen} onClose={() => setBackupModalOpen(false)}>
        <DialogContent>
          <Typography>¿Desea generar backup histórico de <b>todos los documentos sin backup</b>? (Total: {docsSinBackupGeneral.length})</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBackupModalOpen(false)}>Cancelar</Button>
          <Button onClick={handleConfirmBackupAll} color="secondary" variant="contained" disabled={loadingBackup}>
            {loadingBackup ? <CircularProgress size={22} /> : 'Confirmar Backup Histórico'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Feedback visual del resultado del backup */}
      <Dialog open={!!backupResult} onClose={handleCloseBackupResult}>
        <DialogContent>
          <Typography color={backupResult?.type === 'error' ? 'error' : 'primary'}>
            {backupResult?.message}
          </Typography>
          {backupResult?.urls && (
            <Box mt={2}>
              {backupResult.urls.map((item, idx) => (
                <Button key={item.url} href={item.url} target="_blank" rel="noopener" variant="outlined" sx={{ m: 1 }}>
                  {item.nombre}
                </Button>
              ))}
            </Box>
          )}
          {backupResult?.url && (
            <Box mt={2}>
              <Button href={backupResult.url} target="_blank" rel="noopener" variant="outlined">Ver Backup</Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseBackupResult}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Modal de resultado de Smart Backup */}
      <Dialog open={!!smartBackupResult} onClose={handleCloseSmartBackupResult}>
        <DialogContent>
          <Typography color={smartBackupResult?.type === 'error' ? 'error' : 'primary'}>
            {smartBackupResult?.message}
          </Typography>
          {smartBackupResult?.url && (
            <Box mt={2}>
              <Button href={smartBackupResult.url} target="_blank" rel="noopener" variant="outlined">
                Ver Smart Backup
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSmartBackupResult}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Modal iHatePDF */}
      <IHatePdfModal 
        open={ihatePdfModalOpen}
        onClose={() => setIHatePdfModalOpen(false)}
        selectedPdfDoc={selectedPdfDoc}
      />

    </Box>
  );
}


// ---
// Integración de backups como pestaña separada para admins.
// Se usa useBackups (hook) y BackupTable (tabla presentacional) para máxima modularidad y mantenibilidad.