//user/components/VehiculosPanel/index.jsx
import React, { useState, useEffect, useCallback, useContext } from 'react';
import { 
  Paper, Typography, Button,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  Tooltip, Box, Stack, Collapse, Card, CardContent, IconButton
} from '@mui/material';
import EditDeleteActions from '../../../components/EditDeleteActions.jsx';
import Swal from 'sweetalert2';
import { db } from '../../../config/firebaseconfig.js';
import { doc, deleteDoc, getDoc, updateDoc, collection, addDoc } from 'firebase/firestore';
import VehiculosForm from './VehiculosForm.jsx';
import VehiculosImportForm from './VehiculosImportForm.jsx';
import DocumentosVehiculoForm from './VehiculoDocumentsPanel.jsx';
import EntidadPanel from '../EntidadPanel.jsx';
import BulkUploadDialog from '../components/BulkUploadDialog';
import { getDeadlineColor } from '../../../utils/getDeadlineUtils.jsx';
import { getTenantCollectionPath } from '../../../utils/tenantUtils';
import { useClientNamesMap } from '../../../utils/getClientName';
import { AuthContext } from '../../../context/AuthContext.jsx';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DescriptionIcon from '@mui/icons-material/Description';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

export default function VehiculosPanel({
  vehiculos,
  requiredDocuments,
  uploadedDocuments,
  refreshUploadedDocuments,
  getDeadlineColor,
  onVehiculoAdded
}) {
  const [selectedVehiculo, setSelectedVehiculo] = useState(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [openDocumentosDialog, setOpenDocumentosDialog] = useState(false);

  const handleRefreshUploadedDocuments = useCallback(() => {
    refreshUploadedDocuments();
  }, [refreshUploadedDocuments]);

console.log(requiredDocuments);
  const [formKey, setFormKey] = useState(0);

  const handleVehiculoAdded = () => {
    setFormKey(k => k + 1); // Fuerza remount del formulario
    if (typeof onVehiculoAdded === 'function') {
      onVehiculoAdded(); // Refresca el listado real en el padre
    }
    refreshUploadedDocuments && refreshUploadedDocuments(); // Refresca documentos si corresponde
  };

  const [editVehiculo, setEditVehiculo] = useState(null);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [localVehiculos, setLocalVehiculos] = useState(vehiculos);
  const [showIndividualForm, setShowIndividualForm] = useState(false);
  const [showMassiveForm, setShowMassiveForm] = useState(false);
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('asc');
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  
  // IMPORTANTE: Usar mainCompanyId del contexto en lugar de localStorage
  const { mainCompanyId } = useContext(AuthContext);

useEffect(() => {
  setLocalVehiculos(vehiculos);
}, [vehiculos]);

const handleIndividualClick = () => {
  setShowIndividualForm(!showIndividualForm);
  setShowMassiveForm(false);
};

const handleMassiveClick = () => {
  setShowMassiveForm(!showMassiveForm);
  setShowIndividualForm(false);
};

const handleSort = (field) => {
  if (sortField === field) {
    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
  } else {
    setSortField(field);
    setSortDirection('asc');
  }
};

  // Obtener clientIds únicos de los vehículos
  const clientIds = localVehiculos
    .map(v => v.clientId)
    .filter(id => id)
    .filter((id, index, self) => self.indexOf(id) === index);

  // Obtener nombres de clientes
  const { data: clientNamesMap = {}, isLoading: isLoadingClientNames } = useClientNamesMap(clientIds);

const getSortedVehiculos = () => {
  return [...localVehiculos].sort((a, b) => {
    let aValue, bValue;
    
    switch (sortField) {
      case 'patente':
        aValue = a.patente || '';
        bValue = b.patente || '';
        break;
      case 'modelo':
        aValue = a.modelo || '';
        bValue = b.modelo || '';
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
        // Ordenar por estado de documentos
        const aDocs = uploadedDocuments.filter(doc => doc.entityId === a.id);
        const bDocs = uploadedDocuments.filter(doc => doc.entityId === b.id);
        
        const getDocPriority = (docs) => {
          if (docs.length === 0) return 0;
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
          startIcon={<DirectionsCarIcon />}
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
          onClick={() => setBulkUploadOpen(true)}
          startIcon={<DescriptionIcon />}
          sx={{ display: 'none' }} // Oculto temporalmente
        >
          Carga masiva de documentos
        </Button>
      </Stack>
      
      {/* Formulario Individual */}
      <Collapse in={showIndividualForm}>
        <Card elevation={2} sx={{ mb: 2 }}>
          <CardContent>
            <VehiculosForm key={formKey} companyId={undefined} onVehiculoAdded={handleVehiculoAdded} />
          </CardContent>
        </Card>
      </Collapse>

      {/* Formulario Masivo */}
      <Collapse in={showMassiveForm}>
        <Card elevation={2} sx={{ mb: 2 }}>
          <CardContent>
            <VehiculosImportForm onVehiculosAdded={handleVehiculoAdded} />
          </CardContent>
        </Card>
      </Collapse>
      {/* Modal de edición de vehículo */}
      <Dialog
        open={openEditDialog && !!editVehiculo}
        onClose={() => {
          setOpenEditDialog(false);
          setEditVehiculo(null);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Editar vehículo</DialogTitle>
        <DialogContent dividers>
          {editVehiculo && (
            <VehiculosForm
              modoEdicion
              vehiculo={editVehiculo}
              onVehiculoEdited={async (updatedData) => {
                setOpenEditDialog(false);
                setEditVehiculo(null);
                setLocalVehiculos(prev => prev.map(v => v.id === updatedData.id ? {...v, ...updatedData} : v));
                if (typeof refreshUploadedDocuments === 'function') refreshUploadedDocuments();
              }}
              companyId={editVehiculo?.companyId}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setOpenEditDialog(false);
            setEditVehiculo(null);
          }}>
            Cancelar
          </Button>
        </DialogActions>
      </Dialog>
      <EntidadPanel
        title={`Vehículos Registrados (${localVehiculos.length})`}
        entityType="vehicle"
        entityList={getSortedVehiculos()}
        documentosRequeridos={requiredDocuments}
        documentosSubidos={uploadedDocuments}
        getDeadlineColor={getDeadlineColor}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
  onVerMas={(vehiculo) => {
    setSelectedVehiculo(vehiculo);
    setSelectedDocumentId(null);
    setOpenDocumentosDialog(true);
  }}
  renderIdentificadores={(mode, v) =>
    mode === "header" ? (
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
            onClick={() => handleSort('patente')}
          >
            <b>Patente</b>
            {sortField === 'patente' ? 
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
            onClick={() => handleSort('modelo')}
          >
            <b>Modelo</b>
            {sortField === 'modelo' ? 
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
    ) : (
      <>
        <TableCell>
          {v.patente}
        </TableCell>
        <TableCell>{v.modelo}</TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: v.activo ? '#4caf50' : '#f44336'
              }}
            />
            <Typography variant="body2" color={v.activo ? 'success.main' : 'error.main'}>
              {v.activo ? 'Activo' : 'Suspendido'}
            </Typography>
          </Box>
        </TableCell>
        <TableCell>
          {isLoadingClientNames ? (
            <Typography variant="body2" color="text.secondary">...</Typography>
          ) : v.clientId ? (
            <Typography variant="body2">{clientNamesMap[v.clientId] || '-'}</Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">-</Typography>
          )}
        </TableCell>
        <TableCell>
          <EditDeleteActions
            onEdit={() => {
              setEditVehiculo(v);
              setOpenEditDialog(true);
            }}
            onDelete={async () => {
              const confirm = await Swal.fire({
                title: '¿Estás seguro?',
                text: `¿Deseas eliminar el vehículo ${v.patente}?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar',
              });
              if (confirm.isConfirmed) {
                try {
                  // Usar la ruta multi-tenant correcta
                  const vehiculosPath = getTenantCollectionPath('vehiculos');
                  await deleteDoc(doc(db, vehiculosPath, v.id));
                  Swal.fire('Eliminado', 'El vehículo ha sido eliminado.', 'success');
                  setLocalVehiculos(prev => prev.filter(item => item.id !== v.id));
                  if (typeof refreshUploadedDocuments === 'function') refreshUploadedDocuments();
                } catch (error) {
                  Swal.fire('Error', 'No se pudo eliminar el vehículo.', 'error');
                }
              }
            }}
          />
          <Button
            size="small"
            variant={v.activo ? 'outlined' : 'contained'}
            color={v.activo ? 'warning' : 'success'}
            style={{ marginLeft: 8 }}
            onClick={async () => {
              try {
                // Usar la ruta multi-tenant correcta
                const vehiculosPath = getTenantCollectionPath('vehiculos');
                const vehiculoRef = doc(db, vehiculosPath, v.id);
                const snap = await getDoc(vehiculoRef);
                if (!snap.exists()) throw new Error('No se encontró el vehículo');
                const data = snap.data();
                await updateDoc(vehiculoRef, { ...data, activo: !v.activo });
                setLocalVehiculos(prev => prev.map(item => item.id === v.id ? { ...item, activo: !v.activo } : item));
                // Crear notificación de suspensión/reactivación en Firestore
                try {
                  const notification = {
                    entityType: 'vehiculo',
                    entityId: v.id,
                    entityName: `${v.marca || ''} ${v.modelo || ''} (${v.patente || ''})`,
                    event: !v.activo ? 'suspendido' : 'reactivado',
                    message: !v.activo
                      ? `El vehículo ${v.marca || ''} ${v.modelo || ''} (${v.patente || ''}) ha sido suspendido por el usuario y no será requerido hasta su reactivación.`
                      : `El vehículo ${v.marca || ''} ${v.modelo || ''} (${v.patente || ''}) ha sido reactivado y volverá a requerir documentación.`,
                    timestamp: new Date(),
                    companyId: v.companyId || null,
                    read: false
                  };
                  // Usar la ruta multi-tenant correcta
                  const adminNotificationsPath = getTenantCollectionPath('adminNotifications');
                  await addDoc(collection(db, adminNotificationsPath), notification);
                } catch (notifErr) {
                  console.error('Error al crear la notificación de suspensión/reactivación:', notifErr);
                }
                Swal.fire('Estado actualizado', `El vehículo ahora está ${!v.activo ? 'activo' : 'suspendido'}.`, 'success');
              } catch (error) {
                Swal.fire('Error', 'No se pudo actualizar el estado.', 'error');
              }
            }}
          >
            {v.activo ? 'Suspender' : 'Reactivar'}
          </Button>
        </TableCell>
      </>
    )
  }
/>

      
      <Dialog 
        open={openDocumentosDialog && selectedVehiculo !== null} 
        onClose={() => {
          setOpenDocumentosDialog(false);
          setSelectedVehiculo(null);
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          Documentos de {selectedVehiculo?.marca} {selectedVehiculo?.modelo} ({selectedVehiculo?.patente})
        </DialogTitle>
        <DialogContent dividers>
          {selectedVehiculo && (
            <DocumentosVehiculoForm
              vehiculo={selectedVehiculo}
              selectedDocumentId={selectedDocumentId}
              onDocumentUploaded={handleRefreshUploadedDocuments}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDocumentosDialog(false)}>
            Cerrar
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
        entityType="vehicle"
        companyId={mainCompanyId}
      />
    </>
  );
}