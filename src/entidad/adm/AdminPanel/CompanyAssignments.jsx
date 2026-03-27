// src/entidad/adm/AdminPanel/CompanyAssignments.jsx
import React, { useState, useEffect } from 'react';
import {
  Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Typography, Select, MenuItem, FormControl, InputLabel, Button,
  Chip, CircularProgress, Alert, Checkbox, ListItemText
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { db } from '../../../firebaseconfig';
import { useAuth } from '../../../context/AuthContext';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { getTenantCollectionPath } from '../../../utils/tenantUtils';

const CompanyAssignments = () => {
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [companies, setCompanies] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState({});
  const [selectedAdmins, setSelectedAdmins] = useState({});

  useEffect(() => {
    if (user?.uid && (user?.role === 'admin' || user?.role === 'max')) {
      loadData();
    }
  }, [user?.uid, user?.role]);

  const loadData = async () => {
    if (!user?.uid) return;
    try {
      setLoading(true);
      // Primero cargar todos los admins para obtener "mis colaboradores" (createdBy.uid === yo)
      const adminsFull = await loadAdmins();
      const myAdminIds = [
        user.uid,
        ...adminsFull.filter(a => a.createdBy?.uid === user.uid).map(a => a.id)
      ];
      // Lista visible: solo yo + mis colaboradores (igual que en Administradores Activos)
      setAdmins(adminsFull.filter(a => a.id === user.uid || a.createdBy?.uid === user.uid));
      await loadCompanies(myAdminIds);
    } catch (error) {
      console.error('Error cargando datos:', error);
      enqueueSnackbar('Error al cargar datos', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async (myAdminIds) => {
    if (!myAdminIds?.length) {
      setCompanies([]);
      setSelectedAdmins({});
      return;
    }
    try {
      const tenantCompaniesPath = getTenantCollectionPath("companies");
      const q = query(
        collection(db, tenantCompaniesPath),
        where("status", "==", "approved")
      );
      const snapshot = await getDocs(q);
      const allApproved = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(company => company.type !== 'client');
      // Solo empresas asignadas a mí o a mis administradores (colaboradores)
      const companiesList = allApproved.filter(company => {
        const adminIds = company.assignedAdminIds ||
          (company.assignedAdminId ? [company.assignedAdminId] : []);
        return adminIds.some(id => myAdminIds.includes(id));
      });

      setCompanies(companiesList);

      const initialSelected = {};
      companiesList.forEach(company => {
        const adminIds = company.assignedAdminIds ||
          (company.assignedAdminId ? [company.assignedAdminId] : []);
        initialSelected[company.id] = adminIds;
      });
      setSelectedAdmins(initialSelected);
    } catch (error) {
      console.error('Error cargando empresas:', error);
      enqueueSnackbar('Error al cargar empresas', { variant: 'error' });
    }
  };

  /** Devuelve la lista completa de admins (admin/max) para calcular colaboradores; no actualiza state. */
  const loadAdmins = async () => {
    try {
      const tenantUsersPath = getTenantCollectionPath("users");
      const q = query(
        collection(db, tenantUsersPath),
        where("role", "in", ["admin", "max"])
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        email: doc.data().email || doc.data().realemail || 'Sin email',
        displayName: doc.data().displayName || 'Sin nombre',
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error cargando administradores:', error);
      enqueueSnackbar('Error al cargar administradores', { variant: 'error' });
      return [];
    }
  };

  const handleReassign = async (companyId, newAdminIds) => {
    if (!newAdminIds || newAdminIds.length === 0) {
      enqueueSnackbar('Debes seleccionar al menos un administrador', { variant: 'warning' });
      return;
    }

    try {
      setUpdating(prev => ({ ...prev, [companyId]: true }));
      
      const tenantCompaniesPath = getTenantCollectionPath("companies");
      await updateDoc(doc(db, tenantCompaniesPath, companyId), {
        assignedAdminIds: newAdminIds,
        assignedAt: new Date(),
        reassignedBy: user?.uid,
        reassignedAt: new Date()
      });

      // Actualizar estado local
      setCompanies(prev => prev.map(c => 
        c.id === companyId 
          ? { ...c, assignedAdminIds: newAdminIds, assignedAt: new Date() }
          : c
      ));

      // Actualizar selectedAdmins
      setSelectedAdmins(prev => ({ ...prev, [companyId]: newAdminIds }));

      enqueueSnackbar('Empresa reasignada correctamente', { variant: 'success' });
      
      // Recargar datos para refrescar la vista
      setTimeout(() => {
        loadData();
      }, 500);
    } catch (error) {
      console.error('Error reasignando empresa:', error);
      enqueueSnackbar('Error al reasignar empresa: ' + error.message, { variant: 'error' });
    } finally {
      setUpdating(prev => ({ ...prev, [companyId]: false }));
    }
  };

  const getAdminName = (adminId) => {
    if (!adminId) return 'Sin asignar';
    const admin = admins.find(a => a.id === adminId);
    return admin ? (admin.displayName || admin.email) : 'Sin asignar';
  };

  const getAdminNames = (adminIds) => {
    if (!adminIds || adminIds.length === 0) return 'Sin asignar';
    return adminIds.map(id => getAdminName(id)).join(', ');
  };

  // Solo admin o cliente admin (max) pueden ver y gestionar asignaciones (solo sus empresas y las de sus colaboradores)
  if (user?.role !== "admin" && user?.role !== "max") {
    return (
      <Box p={3}>
        <Alert severity="warning">
          Solo administradores y cliente admin pueden acceder a la gestión de asignaciones de empresas.
        </Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: "var(--page-background-text)", mb: 2 }}>
        Gestión de Asignaciones de Empresas
      </Typography>
      
      <Alert severity="info" sx={{ mb: 2 }}>
        Aquí puedes ver todas las empresas aprobadas y asignarlas a múltiples administradores. Selecciona uno o más administradores para cada empresa.
      </Alert>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Empresa</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Administradores Asignados</TableCell>
              <TableCell>Asignado el</TableCell>
              <TableCell>Asignar Administradores</TableCell>
              <TableCell>Acción</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {companies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No hay empresas aprobadas
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              companies.map((company) => {
                // Soporte para migración: convertir assignedAdminId a array si existe
                const currentAdminIds = company.assignedAdminIds || 
                                      (company.assignedAdminId ? [company.assignedAdminId] : []);
                const selectedIds = selectedAdmins[company.id] ?? currentAdminIds;
                const isAssignedToMe = currentAdminIds.includes(user?.uid);
                
                // Verificar si hay cambios
                const hasChanges = JSON.stringify([...selectedIds].sort()) !== 
                                  JSON.stringify([...currentAdminIds].sort());
                
                return (
                  <TableRow key={company.id}>
                    <TableCell>{company.companyName || company.name || 'Sin nombre'}</TableCell>
                    <TableCell>{company.email || company.realemail || 'N/A'}</TableCell>
                    <TableCell>
                      {currentAdminIds.length === 0 ? (
                        <Chip label="Sin asignar" size="small" color="default" />
                      ) : (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {currentAdminIds.map(adminId => (
                            <Chip 
                              key={adminId}
                              label={getAdminName(adminId)} 
                              size="small"
                              color={adminId === user?.uid ? "primary" : "default"}
                            />
                          ))}
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>
                      {company.assignedAt?.toDate 
                        ? company.assignedAt.toDate().toLocaleDateString('es-ES')
                        : company.assignedAt 
                        ? new Date(company.assignedAt).toLocaleDateString('es-ES')
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" sx={{ minWidth: 250 }}>
                        <InputLabel>Administradores</InputLabel>
                        <Select
                          multiple
                          value={selectedIds}
                          onChange={(e) => setSelectedAdmins(prev => ({ ...prev, [company.id]: e.target.value }))}
                          label="Administradores"
                          renderValue={(selected) => {
                            if (selected.length === 0) return 'Sin asignar';
                            return selected.map(id => getAdminName(id)).join(', ');
                          }}
                        >
                          {admins.map((admin) => (
                            <MenuItem key={admin.id} value={admin.id}>
                              <Checkbox checked={selectedIds.indexOf(admin.id) > -1} />
                              <ListItemText primary={admin.displayName || admin.email} />
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outlined"
                        size="small"
                        disabled={updating[company.id] || !hasChanges || selectedIds.length === 0}
                        onClick={() => handleReassign(company.id, selectedIds)}
                      >
                        {updating[company.id] ? <CircularProgress size={20} /> : 'Actualizar'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default CompanyAssignments;

