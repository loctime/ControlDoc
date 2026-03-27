import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  Paper, CircularProgress, Chip, Tooltip, TableSortLabel, Checkbox, IconButton,
  FormControlLabel, Button
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningIcon from '@mui/icons-material/Warning';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebaseconfig';
import { auth } from '../../../firebaseconfig';
import { useSnackbar } from 'notistack';
import { useAuth } from '../../../context/AuthContext';
import { getTenantCollectionPath } from '../../../utils/tenantUtils';
import { usePendingDocumentsQuery, useInProgressDocumentsQuery, useHistoryDocumentsQuery } from '../../../hooks/queries/useAdminQueries';
import { useClientNamesMap } from '../../../utils/getClientName';

const normalizeAppliesTo = (appliesTo) => {
  const normalized = {
    main: appliesTo?.main !== false
  };

  if (appliesTo?.clients === null) {
    normalized.clients = null; // null = todos los clientes
  } else if (Array.isArray(appliesTo?.clients)) {
    normalized.clients = appliesTo.clients;
  } else {
    normalized.clients = [];
  }

  return normalized;
};

export default function DocumentList({ 
  type, 
  companyId = null, 
  mode = null, 
  refreshTrigger, 
  onDeleteDocument, 
  onEditDocument,
  deletingId,
  user: propUser,
  requiredDocuments: propRequiredDocuments = null // Nueva prop para documentos requeridos
}) {
  const { user: contextUser } = useAuth();
  const user = propUser || contextUser;

  const [sortConfig, setSortConfig] = useState({ field: 'name', direction: 'asc' });
  const [selectedIds, setSelectedIds] = useState([]);
  const { enqueueSnackbar } = useSnackbar();
  const [companyClientsMap, setCompanyClientsMap] = useState({});
  const [docOverrides, setDocOverrides] = useState({});
  const [savingDocId, setSavingDocId] = useState(null);
  const documentsSignatureRef = useRef('');

  const isRequerido = mode === 'requeridos';
  const isSuperAdmin = typeof user?.role === 'string' && user.role.trim().toLowerCase() === 'max';
  const canAssignClients = isRequerido && isSuperAdmin;

  // Siempre llamar hooks (no pueden estar condicionalmente)
  const pendingQuery = usePendingDocumentsQuery();
  const inProgressQuery = useInProgressDocumentsQuery();
  const historyQuery = useHistoryDocumentsQuery();

  // Seleccionar query según el tipo
  const getQueryData = () => {
    switch (type) {
      case 'Pendientes':
        return pendingQuery;
      case 'En proceso':
        return inProgressQuery;
      case 'Aprobados':
      case 'Rechazados':
        return historyQuery;
      default:
        return { documents: [], loading: false, error: null };
    }
  };

  const queryData = getQueryData();

  // Si es modo requeridos y tenemos documentos como prop, usarlos directamente
  let allDocuments, loading, error;
  if (isRequerido && propRequiredDocuments !== null) {
    if (import.meta.env.DEV) {
      console.log('[DocumentList] Modo requeridos - usando documentos de prop:', {
        cantidad: propRequiredDocuments.length,
        companyId,
        documentos: propRequiredDocuments.map(d => ({ id: d.id, name: d.name, companyId: d.companyId, entityType: d.entityType }))
      });
    }
    
    allDocuments = propRequiredDocuments;
    loading = false;
    error = null;
  } else {
    allDocuments = queryData.documents || [];
    loading = queryData.loading || false;
    error = queryData.error || null;
  }
  
  // Filtrar documentos según el tipo y companyId
  const documents = allDocuments.filter(doc => {
    // Para modo requeridos, filtrar por companyId si está especificado
    if (isRequerido && companyId && companyId !== 'todas') {
      const docCompanyId = String(doc.companyId || '').trim();
      const filterCompanyId = String(companyId).trim();
      const matches = docCompanyId === filterCompanyId;
      if (import.meta.env.DEV && !matches) {
        console.log('[DocumentList] Documento filtrado (requeridos):', {
          docId: doc.id,
          docName: doc.name,
          docCompanyId,
          filterCompanyId,
          matches
        });
      }
      return matches;
    }
    
    // Para otros modos, usar la lógica original
    if (companyId && doc.companyId !== companyId) return false;
    if (type === 'Aprobados' && doc.status !== 'Aprobado') return false;
    if (type === 'Rechazados' && doc.status !== 'Rechazado') return false;
    return true;
  });

  if (import.meta.env.DEV) {
    console.log('[DocumentList] Documentos finales después de filtrar:', {
      modo: isRequerido ? 'requeridos' : type,
      cantidad: documents.length,
      companyId,
      documentos: documents.map(d => ({ id: d.id, name: d.name, companyId: d.companyId }))
    });
  }

  useEffect(() => {
    const idsKey = documents
      .map(doc => doc.id)
      .sort()
      .join('|');

    if (documentsSignatureRef.current !== idsKey) {
      documentsSignatureRef.current = idsKey;
      setDocOverrides({});
    }
  }, [documents]);

  const normalizedDocuments = useMemo(() => {
    return documents.map(doc => ({
      ...doc,
      appliesTo: normalizeAppliesTo(doc.appliesTo)
    }));
  }, [documents]);

  const documentsWithOverrides = useMemo(() => {
    if (!Object.keys(docOverrides).length) return normalizedDocuments;
    return normalizedDocuments.map(doc => {
      const override = docOverrides[doc.id];
      if (!override) return doc;
      return { ...doc, ...override };
    });
  }, [normalizedDocuments, docOverrides]);

  const applyAppliesOverride = useCallback((docId, appliesToValue) => {
    const originalDoc = normalizedDocuments.find(doc => doc.id === docId);
    const originalApplies = normalizeAppliesTo(originalDoc?.appliesTo);
    const nextApplies = normalizeAppliesTo(appliesToValue);
    const isEqualToOriginal = JSON.stringify(originalApplies) === JSON.stringify(nextApplies);

    if (isEqualToOriginal) {
      setDocOverrides(prev => {
        if (!prev[docId]) return prev;
        const updated = { ...prev };
        delete updated[docId];
        return updated;
      });
      return;
    }

    setDocOverrides(prev => ({
      ...prev,
      [docId]: {
        ...(prev[docId] || {}),
        appliesTo: nextApplies
      }
    }));
  }, [normalizedDocuments]);

  const fetchCompanyClients = useCallback(async (companyId) => {
    if (!companyId || companyId === 'todas') return;

    setCompanyClientsMap(prev => ({
      ...prev,
      [companyId]: {
        clients: prev[companyId]?.clients || [],
        loading: true,
        error: null
      }
    }));

    try {
      const companiesPath = getTenantCollectionPath('companies');
      const clientsQuery = query(
        collection(db, companiesPath),
        where('parentCompanyId', '==', companyId),
        where('active', '==', true),
        where('status', '==', 'approved')
      );

      const snapshot = await getDocs(clientsQuery);
      const clients = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        companyName: docSnap.data().companyName || docSnap.data().name || 'Sin nombre',
        ...docSnap.data()
      }));

      setCompanyClientsMap(prev => ({
        ...prev,
        [companyId]: {
          clients,
          loading: false,
          error: null
        }
      }));
    } catch (error) {
      console.error('Error cargando clientes para la empresa:', companyId, error);
      setCompanyClientsMap(prev => ({
        ...prev,
        [companyId]: {
          clients: [],
          loading: false,
          error: error.message || 'Error al cargar clientes'
        }
      }));
    }
  }, []);

  useEffect(() => {
    if (!canAssignClients) return;
    const uniqueCompanyIds = [...new Set(documents.map(doc => doc.companyId).filter(Boolean))];
    uniqueCompanyIds.forEach(companyId => {
      if (!companyClientsMap[companyId]) {
        fetchCompanyClients(companyId);
      }
    });
  }, [canAssignClients, documents, companyClientsMap, fetchCompanyClients]);

  const persistClientAssignment = useCallback(async (currentDoc, clientsValue) => {
    if (!currentDoc?.id) return;
    const previousApplies = normalizeAppliesTo(currentDoc.appliesTo);
    const nextApplies = { ...previousApplies, clients: clientsValue };
    applyAppliesOverride(currentDoc.id, nextApplies);
    setSavingDocId(currentDoc.id);

    try {
      const requiredDocumentsPath = getTenantCollectionPath('requiredDocuments');
      if (!requiredDocumentsPath) {
        throw new Error('Ruta de documentos no disponible');
      }
      const documentRef = doc(db, requiredDocumentsPath, currentDoc.id);
      await updateDoc(documentRef, { appliesTo: nextApplies });
      enqueueSnackbar('Clientes actualizados', { variant: 'success' });
    } catch (error) {
      console.error('Error actualizando clientes del documento:', error);
      applyAppliesOverride(currentDoc.id, previousApplies);
      enqueueSnackbar(error.message || 'Error al actualizar clientes', { variant: 'error' });
    } finally {
      setSavingDocId(null);
    }
  }, [applyAppliesOverride, enqueueSnackbar]);

  const handleClientsChange = useCallback((currentDoc, rawValue) => {
    const value = typeof rawValue === 'string' ? rawValue.split(',') : rawValue;
    persistClientAssignment(currentDoc, value);
  }, [persistClientAssignment]);

  const handleAllClientsToggle = useCallback((currentDoc, checked) => {
    persistClientAssignment(currentDoc, checked ? null : []);
  }, [persistClientAssignment]);

  const renderClientSelector = (doc) => {
    if (!canAssignClients) return null;

    const companyId = doc.companyId;
    if (!companyId || companyId === 'todas') {
      return (
        <Typography variant="body2" color="text.secondary">
          Sin empresa asociada
        </Typography>
      );
    }

    const entry = companyClientsMap[companyId];
    const clients = entry?.clients || [];
    const loadingClients = entry?.loading;
    const errorClients = entry?.error;
    const appliesTo = normalizeAppliesTo(doc.appliesTo);
    const clientsValue = appliesTo.clients;
    const isAllClients = clientsValue === null;
    const selectedClientIds = Array.isArray(clientsValue) ? clientsValue : [];
    const isSaving = savingDocId === doc.id;
    const disableSelect = isAllClients || !clients.length || isSaving;

    if (loadingClients) {
      return <CircularProgress size={20} />;
    }

    if (errorClients) {
      return (
        <Typography variant="body2" color="error">
          {errorClients}
        </Typography>
      );
    }

    if (!clients.length) {
      return (
        <Typography variant="body2" color="text.secondary">
          Sin clientes aprobados
        </Typography>
      );
    }

    return (
      <Box sx={{ minWidth: 220, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={isAllClients}
              onChange={(event) => handleAllClientsToggle(doc, event.target.checked)}
              disabled={isSaving}
            />
          }
          label="Aplica a todos"
          sx={{ mb: 1 }}
        />
        {/* Los botones de clientes específicos siempre aparecen */}
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" gutterBottom sx={{ mb: 1, fontSize: '0.875rem' }}>
            Clientes específicos:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {clients.map((client) => {
              const isSelected = isAllClients || selectedClientIds.includes(client.id);
              return (
                <Button
                  key={client.id}
                  variant={isSelected ? "contained" : "outlined"}
                  size="small"
                  onClick={() => {
                    if (isSaving) return;
                    
                    if (isAllClients) {
                      // Si "Todos los clientes" está marcado, desmarcarlo y seleccionar solo este
                      handleAllClientsToggle(doc, false);
                      handleClientsChange(doc, [client.id]);
                    } else {
                      // Toggle del cliente individual
                      const newSelectedIds = selectedClientIds.includes(client.id)
                        ? selectedClientIds.filter(id => id !== client.id)
                        : [...selectedClientIds, client.id];
                      handleClientsChange(doc, newSelectedIds);
                    }
                  }}
                  disabled={isSaving}
                  sx={{
                    minWidth: 'auto',
                    px: 2,
                    py: 0.5,
                    borderRadius: 2,
                    textTransform: 'none',
                    ...(isSelected ? {
                      bgcolor: "var(--primary-main)",
                      color: "var(--primary-text)",
                      "&:hover": {
                        bgcolor: "var(--primary-dark)"
                      }
                    } : {
                      borderColor: "var(--divider-color)",
                      color: "var(--paper-background-text)",
                      "&:hover": {
                        borderColor: "var(--primary-main)",
                        bgcolor: "var(--paper-background)"
                      }
                    })
                  }}
                >
                  {client.companyName || client.name}
                </Button>
              );
            })}
          </Box>
        </Box>
        {isSaving && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="caption" color="text.secondary">
              Guardando...
            </Typography>
          </Box>
        )}
      </Box>
    );
  };
  const statusMap = {
    Pendientes: 'Pendiente de revisión',
    Aprobados: 'Aprobado',
    Rechazados: 'Rechazado',
    'En proceso': 'En proceso'
  };

  const statusColor = {
    'Pendiente de revisión': 'warning',
    'Aprobado': 'success',
    'Rechazado': 'error',
    'En proceso': 'info'
  };

  // Extraer clientIds únicos de los documentos (para documentos no requeridos)
  const clientIds = useMemo(() => {
    if (isRequerido) return [];
    const ids = documents.map(doc => doc.clientId).filter(Boolean);
    return [...new Set(ids)];
  }, [documents, isRequerido]);

  // Obtener nombres de clientes
  const { data: clientNamesMap = {}, isLoading: isLoadingClientNames } = useClientNamesMap(clientIds);

  // Para documentos requeridos, extraer todos los clientIds de appliesTo.clients
  const requiredDocClientIds = useMemo(() => {
    if (!isRequerido) return [];
    const ids = new Set();
    documents.forEach(doc => {
      const appliesTo = normalizeAppliesTo(doc.appliesTo);
      if (Array.isArray(appliesTo.clients)) {
        appliesTo.clients.forEach(id => ids.add(id));
      }
    });
    return [...ids];
  }, [documents, isRequerido]);

  const { data: requiredClientNamesMap = {} } = useClientNamesMap(requiredDocClientIds);

  const baseColumns = isRequerido
    ? ['Empresa', 'Cliente', 'Nombre', 'Tipo', 'Entidad', 'Vencimiento', 'Comentario']
    : ['Empresa', 'Cliente', 'Documento', 'Comentario', 'Vencimiento', 'Estado'];

  const columns = (canAssignClients && isRequerido)
    ? [...baseColumns, 'Asignar Clientes']
    : baseColumns;

  // Los datos ahora vienen de los hooks Query, no necesitamos useEffect

  const handleSort = (field) => {
    const isAsc = sortConfig.field === field && sortConfig.direction === 'asc';
    setSortConfig({ field, direction: isAsc ? 'desc' : 'asc' });
  };

  const sortedDocs = [...documentsWithOverrides].sort((a, b) => {
    const { field, direction } = sortConfig;
    
    // Mapear nombres de columnas a campos reales
    let aValue, bValue;
    
    if (isRequerido) {
      switch (field) {
        case 'empresa':
          aValue = a.companyName || '';
          bValue = b.companyName || '';
          break;
        case 'nombre':
          aValue = a.name || '';
          bValue = b.name || '';
          break;
        case 'tipo':
          aValue = a.entityType || '';
          bValue = b.entityType || '';
          break;
        case 'entidad':
          aValue = a.entityName || '';
          bValue = b.entityName || '';
          break;
        case 'vencimiento':
          aValue = a.vencimiento ? new Date(a.vencimiento).getTime() : 0;
          bValue = b.vencimiento ? new Date(b.vencimiento).getTime() : 0;
          break;
        case 'comentario':
          aValue = (a.comentario || '').toString();
          bValue = (b.comentario || '').toString();
          break;
        default:
          aValue = '';
          bValue = '';
      }
    } else {
      switch (field) {
        case 'empresa':
          aValue = a.companyName || '';
          bValue = b.companyName || '';
          break;
        case 'documento':
          aValue = a.requiredDocName || 'Sin título';
          bValue = b.requiredDocName || 'Sin título';
          break;
        case 'comentario':
          aValue = (a.exampleComment || '-').toString();
          bValue = (b.exampleComment || '-').toString();
          break;
        case 'vencimiento':
          aValue = a.expirationDate ? new Date(a.expirationDate).getTime() : 0;
          bValue = b.expirationDate ? new Date(b.expirationDate).getTime() : 0;
          break;
        case 'estado':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        default:
          aValue = '';
          bValue = '';
      }
    }
    
    // Para campos de fecha, comparar numéricamente
    if (field === 'vencimiento') {
      return direction === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    // Para campos de texto, usar localeCompare
    const comparison = String(aValue).localeCompare(String(bValue), 'es-ES');
    return direction === 'asc' ? comparison : -comparison;
  });

  const handleDeleteDocument = async (docId) => {
    try {
      const response = await fetch('/api/admin/delete-required-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
        },
        body: JSON.stringify({ docId })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Error al eliminar');

      // Actualizar la lista
      setRefreshTrigger(prev => !prev);
      enqueueSnackbar('Documento eliminado correctamente', { variant: 'success' });
    } catch (error) {
      console.error('Error eliminando documento:', error);
      enqueueSnackbar(error.message, { variant: 'error' });
    }
  };

  const handleDeleteDocuments = async (docIds) => {
    try {
      const response = await fetch('/api/admin/delete-required-documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
        },
        body: JSON.stringify({ docIds })
      });

      if (!response.ok) {
        let errorMessage = 'Error al eliminar documentos';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const result = await response.json();
            errorMessage = result.error || result.message || errorMessage;
          } else {
            errorMessage = `Error ${response.status}: ${response.statusText}`;
          }
        } catch (e) {
          errorMessage = `Error ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      // Actualizar la lista
      setRefreshTrigger(prev => !prev);
      enqueueSnackbar(`Se eliminaron ${docIds.length} documentos`, { variant: 'success' });
      setSelectedIds([]);
    } catch (error) {
      console.error('Error eliminando documentos:', error);
      enqueueSnackbar(error.message, { variant: 'error' });
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {isRequerido ? 'Documentos requeridos' : `Documentos ${type}`}
      </Typography>
      {selectedIds.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Tooltip title={user?.role === 'max' ? "Eliminar seleccionados" : "Requiere rol superadmin"}>
            <IconButton
              color="error"
              onClick={() => handleDeleteDocuments(selectedIds)}
              disabled={user?.role !== 'max'}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {loading ? (
        <Box textAlign="center" py={4}><CircularProgress /></Box>
      ) : documentsWithOverrides.length === 0 ? (
        <Typography>No se encontraron documentos {isRequerido ? 'requeridos' : type.toLowerCase()}.</Typography>
      ) : (
        
        <Paper sx={{ overflowX: 'auto', maxWidth: '100%' }}>
          <Table>
          <TableHead>
  <TableRow>
    <TableCell padding="checkbox">
      <Checkbox
        indeterminate={
          selectedIds.length > 0 && selectedIds.length < documentsWithOverrides.length
        }
        checked={documentsWithOverrides.length > 0 && selectedIds.length === documentsWithOverrides.length}
        onChange={(e) => {
          const checked = e.target.checked;
          setSelectedIds(checked ? documentsWithOverrides.map(doc => doc.id) : []);
        }}
      />
    </TableCell>
    {columns.map((col, index) => (
      <TableCell key={index}>
        <TableSortLabel
          active={sortConfig.field === col.toLowerCase()}
          direction={sortConfig.direction}
          onClick={() => handleSort(col.toLowerCase())}
        >
          {col}
        </TableSortLabel>
      </TableCell>
    ))}
    <TableCell>Acciones</TableCell>
  </TableRow>
</TableHead>

<TableBody>
  {sortedDocs.map((doc) => {
    const isSelected = selectedIds.includes(doc.id);
    const vencimiento = new Date(
      isRequerido ? doc.vencimiento : doc.expirationDate || null
    );

    return (
      <TableRow key={doc.id} hover selected={isSelected}>
        <TableCell padding="checkbox">
          <Checkbox
            checked={isSelected}
            onChange={() => {
              setSelectedIds((prev) =>
                prev.includes(doc.id)
                  ? prev.filter((id) => id !== doc.id)
                  : [...prev, doc.id]
              );
            }}
          />
        </TableCell>

        {isRequerido ? (
          <>
            <TableCell>{doc.companyName}</TableCell>
            <TableCell>
              {(() => {
                const appliesTo = normalizeAppliesTo(doc.appliesTo);
                if (appliesTo.clients === null) {
                  return 'Todos los clientes';
                } else if (Array.isArray(appliesTo.clients) && appliesTo.clients.length > 0) {
                  const clientNames = appliesTo.clients
                    .map(id => requiredClientNamesMap[id])
                    .filter(Boolean);
                  return clientNames.length > 0 ? clientNames.join(', ') : '-';
                } else {
                  return appliesTo.main ? 'Principal' : '-';
                }
              })()}
            </TableCell>
            <TableCell>{doc.name}</TableCell>
            <TableCell>{doc.entityType}</TableCell>
            <TableCell>
              {doc.entityType === 'company'
                ? 'Empresa'
                : (doc.entityType === 'personal' || doc.entityType === 'employee')
                ? 'Personal'
                : (doc.entityType === 'vehicle' || doc.entityType === 'vehiculo')
                ? 'Vehículo'
                : doc.entityType}
            </TableCell>
            <TableCell>
              {vencimiento ? vencimiento.toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              }) : 'Sin fecha'}
            </TableCell>
            <TableCell>{doc.comentario || '-'}</TableCell>
            {canAssignClients && (
              <TableCell>
                {renderClientSelector(doc)}
              </TableCell>
            )}
          </>
        ) : (
          <>
            <TableCell>{doc.companyName}</TableCell>
            <TableCell>
              {doc.clientId 
                ? (isLoadingClientNames ? '...' : (clientNamesMap[doc.clientId] || '-'))
                : '-'}
            </TableCell>
            <TableCell>{doc.requiredDocName || 'Sin título'}</TableCell>
            <TableCell>{doc.exampleComment || '-'}</TableCell>
            <TableCell>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography>
                  {vencimiento ? vencimiento.toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              }) : 'Sin fecha'}
                </Typography>
                {vencimiento && (
                  <Tooltip title={`Faltan ${Math.ceil((vencimiento - new Date()) / (1000 * 60 * 60 * 24))} días`}>
                    <WarningIcon sx={{ color: 'warning.main' }} />
                  </Tooltip>
                )}
              </Box>
            </TableCell>
            <TableCell>
              <Chip
                label={doc.status}
                color={statusColor[doc.status] || 'default'}
                variant="outlined"
              />
            </TableCell>
          </>
        )}

        <TableCell>
          <Tooltip title="Editar">
            <IconButton
              size="small"
              onClick={() => onEditDocument?.(doc)}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={user?.role === 'max' ? "Eliminar" : "Requiere rol superadmin"}>
            <IconButton
              size="small"
              onClick={() => onDeleteDocument(doc.id)}
              disabled={!['max', 'MAX'].includes(user?.role?.toLowerCase?.()) || deletingId === doc.id}
            >
              {deletingId === doc.id ? (
                <CircularProgress size={24} />
              ) : (
                <DeleteIcon 
                  fontSize="small" 
                  color={user?.role === 'max' ? "error" : "disabled"} 
                />
              )}
            </IconButton>
          </Tooltip>
        </TableCell>
      </TableRow>
    );
  })}
</TableBody>

          </Table>
        </Paper>
      )}
    </Box>
  );
}
