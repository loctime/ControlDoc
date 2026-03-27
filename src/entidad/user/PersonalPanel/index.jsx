import React, { useState, useContext, useEffect } from 'react';
import { getDocs, query, collection, where, getDoc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../../../config/firebaseconfig.js';
import { getDeadlineColor } from '../../../utils/getDeadlineUtils.jsx';
import { 
  Paper, Typography, Button, Stack, 
  Dialog, DialogTitle, DialogContent, DialogActions,
  TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  Tooltip, Box, Collapse, Card, CardContent, IconButton,
  TextField
} from '@mui/material';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import EditDeleteActions from '../../../components/EditDeleteActions.jsx';
import Swal from 'sweetalert2';
import { doc, deleteDoc } from 'firebase/firestore';
import PersonIcon from '@mui/icons-material/Person';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DescriptionIcon from '@mui/icons-material/Description';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import PersonalForm from './PersonalForm.jsx';
import PersonalImportForm from './PersonalImportForm.jsx';
import DocumentosPersonalForm from './PersonalDocumentsPanel.jsx';
import EntidadPanel from '../EntidadPanel.jsx';
import BulkUploadDialog from '../components/BulkUploadDialog';
import { AuthContext } from '../../../context/AuthContext.jsx';
import { getTenantCollectionPath } from '../../../utils/tenantUtils';
import { useClientNamesMap } from '../../../utils/getClientName';

export default function PersonalPanel({
  personal = [],
  onPersonalAdded,
  requiredDocuments,
  uploadedDocuments,
  hasWarningsForPerson,
  refreshUploadedDocuments,
  getDeadlineColor,
  companyId
}) {
  const [localPersonal, setLocalPersonal] = useState(personal);

  // Sincroniza cuando cambie la prop
  useEffect(() => {
    setLocalPersonal(personal);
  }, [personal]);
  const [formKey, setFormKey] = useState(0);

  // Esta función será llamada después de agregar personal
  const handlePersonalAdded = () => {
    setFormKey(prev => prev + 1); // Fuerza el remount
    if (typeof onPersonalAdded === 'function') {
      onPersonalAdded();
    }
    refreshUploadedDocuments && refreshUploadedDocuments();
  };

  const handleEditPersona = async (persona) => {
    try {
      // Usar la ruta multi-tenant correcta
      const personalPath = getTenantCollectionPath('personal');
      await updateDoc(doc(db, personalPath, persona.id), persona);
      Swal.fire('Actualizado', 'La persona ha sido actualizada.', 'success');
      if (typeof refreshUploadedDocuments === 'function') refreshUploadedDocuments();
    } catch (error) {
      Swal.fire('Error', 'No se pudo actualizar la persona.', 'error');
    }
  };

  const [showImportPersonal, setShowImportPersonal] = useState(false);
  const [showIndividualForm, setShowIndividualForm] = useState(false);
  const [showMassiveForm, setShowMassiveForm] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [openDocumentosDialog, setOpenDocumentosDialog] = useState(false);
  const [editPersona, setEditPersona] = useState(null);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('asc');
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { user: currentUser, activeCompanyId, mainCompanyId } = useContext(AuthContext);
  
  // IMPORTANTE: companyId siempre debe ser mainCompanyId (empresa principal), nunca cambia
  // Lo que cambia es activeCompanyId cuando seleccionas un cliente
  const finalCompanyId = companyId || mainCompanyId;

  const handleIndividualClick = () => {
    setShowIndividualForm(!showIndividualForm);
    setShowMassiveForm(false);
  };

  const handleMassiveClick = () => {
    setShowMassiveForm(!showMassiveForm);
    setShowIndividualForm(false);
  };

  const handleBulkUploadClick = () => {
    if (isAuthenticated) {
      setBulkUploadOpen(true);
    } else {
      setPasswordDialogOpen(true);
    }
  };

  const handlePasswordSubmit = () => {
    if (passwordInput === 'admin321') {
      setIsAuthenticated(true);
      setPasswordDialogOpen(false);
      setPasswordInput('');
      setBulkUploadOpen(true);
    } else {
      Swal.fire('Error', 'Contraseña incorrecta', 'error');
      setPasswordInput('');
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Obtener clientIds únicos del personal
  const clientIds = localPersonal
    .map(p => p.clientId)
    .filter(id => id)
    .filter((id, index, self) => self.indexOf(id) === index);

  // Obtener nombres de clientes
  const { data: clientNamesMap = {}, isLoading: isLoadingClientNames } = useClientNamesMap(clientIds);

  const getSortedPersonal = () => {
    return [...localPersonal].sort((a, b) => {
      let aValue, bValue;
      
      switch (sortField) {
        case 'nombre':
          aValue = `${a.nombre} ${a.apellido}`.toLowerCase();
          bValue = `${b.nombre} ${b.apellido}`.toLowerCase();
          break;
        case 'dni':
          aValue = a.dni || '';
          bValue = b.dni || '';
          break;
        case 'activo':
          aValue = a.activo ? 1 : 0;
          bValue = b.activo ? 1 : 0;
          break;
        case 'cliente':
          const aClientName = a.clientId ? (clientNamesMap[a.clientId] || '') : '';
          const bClientName = b.clientId ? (clientNamesMap[b.clientId] || '') : '';
          aValue = aClientName.toLowerCase();
          bValue = bClientName.toLowerCase();
          break;
        case 'documento':
          // Ordenar por estado de documentos (pendiente, subido, aprobado, etc.)
          const aDocs = uploadedDocuments.filter(doc => doc.entityId === a.id);
          const bDocs = uploadedDocuments.filter(doc => doc.entityId === b.id);
          
          // Prioridad: Aprobado > Subido > Pendiente de revisión > Rechazado > Sin documentos
          const getDocPriority = (docs) => {
            if (docs.length === 0) return 0; // Sin documentos
            const statuses = docs.map(doc => doc.status);
            if (statuses.includes('Aprobado')) return 5;
            if (statuses.includes('Subido')) return 4;
            if (statuses.includes('En proceso')) return 3;
            if (statuses.includes('Pendiente de revisión')) return 2;
            if (statuses.includes('Rechazado')) return 1;
            return 0;
          };
          
          aValue = getDocPriority(aDocs);
          bValue = getDocPriority(bDocs);
          break;
        case 'createdAt':
        default:
          aValue = a.createdAt?.seconds || a.createdAt || 0;
          bValue = b.createdAt?.seconds || b.createdAt || 0;
          break;
      }
      
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
  };

  return (
    <>
      <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Button 
          variant={showIndividualForm ? "contained" : "outlined"}
          onClick={handleIndividualClick}
          startIcon={<PersonIcon />}
        >
          Agregar Individual
        </Button>
        <Button 
          variant={showMassiveForm ? "contained" : "outlined"}
          onClick={handleMassiveClick}
          startIcon={<CloudUploadIcon />}
        >
          Importación Masiva
        </Button>
        <Button 
          variant="contained"
          color="primary"
          onClick={handleBulkUploadClick}
          startIcon={<DescriptionIcon />}
        >
          Carga masiva de documentos
        </Button>
      </Stack>
      
      {/* Formulario Individual */}
      <Collapse in={showIndividualForm}>
        <Card elevation={2} sx={{ mb: 2 }}>
          <CardContent>
            <PersonalForm key={formKey} companyId={companyId} onPersonalAdded={handlePersonalAdded} />
          </CardContent>
        </Card>
      </Collapse>

      {/* Formulario Masivo */}
      <Collapse in={showMassiveForm}>
        <Card elevation={2} sx={{ mb: 2 }}>
          <CardContent>
            <PersonalImportForm onPersonalAdded={handlePersonalAdded} />
          </CardContent>
        </Card>
      </Collapse>
      
      <EntidadPanel
        title={"Personal Registrado"}
        entityType="employee"
        entityList={getSortedPersonal()}
        documentosRequeridos={requiredDocuments}
        documentosSubidos={uploadedDocuments}
        maxDocumentos={5}
        getDeadlineColor={getDeadlineColor}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        onVerMas={(persona) => {
          setSelectedPersona(persona);
          setSelectedDocumentId(null);
          setOpenDocumentosDialog(true);
        }}
        renderIdentificadores={(mode, persona) => {
          if (mode === "header") {
            return (
              <>
                <TableCell>
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1, 
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)' }
                    }}
                    onClick={() => handleSort('nombre')}
                  >
                    <b>Nombre</b>
                    {sortField === 'nombre' ? 
                      (sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />) :
                      <ArrowUpwardIcon fontSize="small" sx={{ opacity: 0.3 }} />
                    }
                  </Box>
                </TableCell>
                <TableCell>
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1, 
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)' }
                    }}
                    onClick={() => handleSort('dni')}
                  >
                    <b>DNI</b>
                    {sortField === 'dni' ? 
                      (sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />) :
                      <ArrowUpwardIcon fontSize="small" sx={{ opacity: 0.3 }} />
                    }
                  </Box>
                </TableCell>
                <TableCell>
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1, 
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)' }
                    }}
                    onClick={() => handleSort('activo')}
                  >
                    <b>Estado</b>
                    {sortField === 'activo' ? 
                      (sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />) :
                      <ArrowUpwardIcon fontSize="small" sx={{ opacity: 0.3 }} />
                    }
                  </Box>
                </TableCell>
                <TableCell>
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1, 
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)' }
                    }}
                    onClick={() => handleSort('cliente')}
                  >
                    <b>Cliente</b>
                    {sortField === 'cliente' ? 
                      (sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />) :
                      <ArrowUpwardIcon fontSize="small" sx={{ opacity: 0.3 }} />
                    }
                  </Box>
                </TableCell>
                <TableCell><b>Acciones</b></TableCell>
              </>
            );
          }
          return (
            <>
              <TableCell>
                {persona.nombre} {persona.apellido}
                {!persona.activo && (
                  <span style={{ color: 'red', fontWeight: 'bold', marginLeft: 8 }}>(Suspendido)</span>
                )}
              </TableCell>
              <TableCell>
                {persona.dni || persona.DNI || ''}
              </TableCell>
              <TableCell>
                {persona.activo ? (
                  <Typography variant="caption" color="success.main" fontWeight="bold">Activo</Typography>
                ) : (
                  <Typography variant="caption" color="error.main" fontWeight="bold">Suspendido</Typography>
                )}
              </TableCell>
              <TableCell>
                {isLoadingClientNames ? (
                  <Typography variant="body2" color="text.secondary">...</Typography>
                ) : persona.clientId ? (
                  <Typography variant="body2">{clientNamesMap[persona.clientId] || '-'}</Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary">-</Typography>
                )}
              </TableCell>
              <TableCell>
                <EditDeleteActions
                  onEdit={() => {
                    setEditPersona(persona);
                    setOpenEditDialog(true);
                  }}
                  onDelete={async () => {
                    const confirm = await Swal.fire({
                      title: '¿Estás seguro?',
                      text: `¿Deseas eliminar a ${persona.nombre} ${persona.apellido}?`,
                      icon: 'warning',
                      showCancelButton: true,
                      confirmButtonText: 'Sí, eliminar',
                      cancelButtonText: 'Cancelar',
                    });
                    if (confirm.isConfirmed) {
                      try {
                        // Usar la ruta multi-tenant correcta
                        const personalPath = getTenantCollectionPath('personal');
                        await deleteDoc(doc(db, personalPath, persona.id));
                        Swal.fire('Eliminado', 'La persona ha sido eliminada.', 'success');
                        setLocalPersonal(prev => prev.filter(p => p.id !== persona.id));
                        if (typeof refreshUploadedDocuments === 'function') refreshUploadedDocuments();
                      } catch (error) {
                        Swal.fire('Error', 'No se pudo eliminar la persona.', 'error');
                      }
                    }
                  }}
                />
                <Button
                  size="small"
                  variant={persona.activo ? 'outlined' : 'contained'}
                  color={persona.activo ? 'warning' : 'success'}
                  style={{ marginLeft: 8 }}
                  onClick={async () => {
                    try {
                      // Usar la ruta multi-tenant correcta
                      const personalPath = getTenantCollectionPath('personal');
                      const personaRef = doc(db, personalPath, persona.id);
                      const snap = await getDoc(personaRef);
                      if (!snap.exists()) throw new Error('No se encontró la persona');
                      const data = snap.data();
                      await updateDoc(personaRef, { ...data, activo: !persona.activo });
                      setLocalPersonal(prev => prev.map(p => p.id === persona.id ? { ...p, activo: !persona.activo } : p));
                      // Crear notificación de suspensión/reactivación en Firestore
                      try {
                        const notification = {
                          entityType: 'personal',
                          entityId: persona.id,
                          entityName: `${persona.nombre} ${persona.apellido}`,
                          event: !persona.activo ? 'suspendido' : 'reactivado',
                          message: !persona.activo
                            ? `La persona ${persona.nombre} ${persona.apellido} ha sido suspendida por el usuario y no será requerida hasta su reactivación.`
                            : `La persona ${persona.nombre} ${persona.apellido} ha sido reactivada y volverá a requerir documentación.`,
                          timestamp: new Date(),
                          companyId: persona.companyId || companyId || null,
                          read: false
                        };
                        // Usar la ruta multi-tenant correcta
                        const adminNotificationsPath = getTenantCollectionPath('adminNotifications');
                        await addDoc(collection(db, adminNotificationsPath), notification);
                      } catch (notifErr) {
                        console.error('Error al crear la notificación de suspensión/reactivación:', notifErr);
                      }
                      Swal.fire('Estado actualizado', `La persona ahora está ${!persona.activo ? 'activa' : 'suspendida'}.`, 'success');
                    } catch (error) {
                      Swal.fire('Error', 'No se pudo actualizar el estado.', 'error');
                    }
                  }}
                >
                  {persona.activo ? 'Suspender' : 'Reactivar'}
                </Button>
              </TableCell>
            </>
          );
        }}
      />
      
      <Dialog 
        open={openDocumentosDialog && selectedPersona !== null} 
        onClose={() => {
          setOpenDocumentosDialog(false);
          setSelectedPersona(null);
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          Documentos de {selectedPersona?.nombre} {selectedPersona?.apellido}
        </DialogTitle>
        <DialogContent dividers>
          {selectedPersona && (
            <DocumentosPersonalForm
              persona={selectedPersona}
              selectedDocumentId={selectedDocumentId}
              onDocumentUploaded={refreshUploadedDocuments}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDocumentosDialog(false)}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de edición de persona */}
      <Dialog
        open={openEditDialog && !!editPersona}
        onClose={() => {
          setOpenEditDialog(false);
          setEditPersona(null);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Editar persona</DialogTitle>
        <DialogContent dividers>
          {editPersona && (
            <PersonalForm
              modoEdicion
              persona={editPersona}
              onPersonalEdited={async (updatedData) => {
                setOpenEditDialog(false);
                setEditPersona(null);
                // Actualiza el estado local de la persona editada
                setLocalPersonal(prev => prev.map(p => p.id === updatedData.id ? {...p, ...updatedData} : p));
                if (typeof refreshUploadedDocuments === 'function') refreshUploadedDocuments();
              }}
              companyId={companyId}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setOpenEditDialog(false);
            setEditPersona(null);
          }}>
            Cancelar
          </Button>
        </DialogActions>
      </Dialog>

      <BulkUploadDialog
        open={bulkUploadOpen}
        onClose={() => setBulkUploadOpen(false)}
        onUploadComplete={(results) => {
          console.log('Carga masiva completada:', results);
          refreshUploadedDocuments && refreshUploadedDocuments();
          setBulkUploadOpen(false);
        }}
        entityType="employee"
        companyId={finalCompanyId}
      />

      {/* Diálogo de contraseña */}
      <Dialog 
        open={passwordDialogOpen} 
        onClose={() => {
          setPasswordDialogOpen(false);
          setPasswordInput('');
        }}
      >
        <DialogTitle>Autenticación requerida</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Contraseña"
            type="password"
            fullWidth
            variant="outlined"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handlePasswordSubmit();
              }
            }}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setPasswordDialogOpen(false);
            setPasswordInput('');
          }}>
            Cancelar
          </Button>
          <Button onClick={handlePasswordSubmit} variant="contained">
            Aceptar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}