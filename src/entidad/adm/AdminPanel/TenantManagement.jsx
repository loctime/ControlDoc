import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Grid
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Business as BusinessIcon,
  People as PeopleIcon,
  Storage as StorageIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { db } from '../../../firebaseconfig';
import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  serverTimestamp 
} from 'firebase/firestore';

const TenantManagement = () => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    subdomain: '',
    description: '',
    status: 'active'
  });
  const [stats, setStats] = useState({});
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      setLoading(true);
      const tenantsSnapshot = await getDocs(collection(db, 'tenants'));
      const tenantsData = [];
      
      for (const doc of tenantsSnapshot.docs) {
        const data = doc.data();
        const stats = await getTenantStats(doc.id);
        tenantsData.push({
          id: doc.id,
          ...data,
          stats
        });
      }
      
      setTenants(tenantsData);
    } catch (error) {
      console.error('Error cargando tenants:', error);
      enqueueSnackbar('Error cargando tenants', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const getTenantStats = async (tenantId) => {
    try {
      const collections = ['companies', 'users', 'uploadedDocuments'];
      const stats = {};
      
      for (const collectionName of collections) {
        const path = `tenants/${tenantId}/${collectionName}`;
        const snapshot = await getDocs(collection(db, path));
        stats[collectionName] = snapshot.size;
      }
      
      return stats;
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      return { companies: 0, users: 0, uploadedDocuments: 0 };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingTenant) {
        // Actualizar tenant existente
        await updateDoc(doc(db, 'tenants', editingTenant.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        enqueueSnackbar('Tenant actualizado exitosamente', { variant: 'success' });
      } else {
        // Crear nuevo tenant
        await addDoc(collection(db, 'tenants'), {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          settings: {
            maxCompanies: 100,
            maxUsers: 1000,
            maxStorageGB: 10
          }
        });
        enqueueSnackbar('Tenant creado exitosamente', { variant: 'success' });
      }
      
      setDialogOpen(false);
      setEditingTenant(null);
      setFormData({ name: '', subdomain: '', description: '', status: 'active' });
      loadTenants();
    } catch (error) {
      console.error('Error guardando tenant:', error);
      enqueueSnackbar('Error guardando tenant', { variant: 'error' });
    }
  };

  const handleEdit = (tenant) => {
    setEditingTenant(tenant);
    setFormData({
      name: tenant.name,
      subdomain: tenant.subdomain,
      description: tenant.description || '',
      status: tenant.status
    });
    setDialogOpen(true);
  };

  const handleDelete = async (tenantId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este tenant? Esta acción no se puede deshacer.')) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'tenants', tenantId));
      enqueueSnackbar('Tenant eliminado exitosamente', { variant: 'success' });
      loadTenants();
    } catch (error) {
      console.error('Error eliminando tenant:', error);
      enqueueSnackbar('Error eliminando tenant', { variant: 'error' });
    }
  };

  const handleViewTenant = (tenant) => {
    const url = tenant.subdomain === 'default' 
      ? 'https://controldoc.app' 
      : `https://${tenant.subdomain}.controldoc.app`;
    window.open(url, '_blank');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'error';
      case 'suspended': return 'warning';
      default: return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return 'Activo';
      case 'inactive': return 'Inactivo';
      case 'suspended': return 'Suspendido';
      default: return status;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Gestión de Tenants
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          Nuevo Tenant
        </Button>
      </Box>

      {/* Estadísticas generales */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total de Tenants
              </Typography>
              <Typography variant="h4">
                {tenants.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Tenants Activos
              </Typography>
              <Typography variant="h4">
                {tenants.filter(t => t.status === 'active').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total de Empresas
              </Typography>
              <Typography variant="h4">
                {tenants.reduce((sum, t) => sum + (t.stats?.companies || 0), 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabla de tenants */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nombre</TableCell>
              <TableCell>Subdominio</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Empresas</TableCell>
              <TableCell>Usuarios</TableCell>
              <TableCell>Documentos</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tenants.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {tenant.name}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {tenant.description}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip 
                    label={tenant.subdomain === 'default' ? 'controldoc.app' : `${tenant.subdomain}.controldoc.app`}
                    variant="outlined"
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={getStatusText(tenant.status)}
                    color={getStatusColor(tenant.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center">
                    <BusinessIcon fontSize="small" sx={{ mr: 1 }} />
                    {tenant.stats?.companies || 0}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center">
                    <PeopleIcon fontSize="small" sx={{ mr: 1 }} />
                    {tenant.stats?.users || 0}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center">
                    <StorageIcon fontSize="small" sx={{ mr: 1 }} />
                    {tenant.stats?.uploadedDocuments || 0}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box display="flex" gap={1}>
                    <IconButton
                      size="small"
                      onClick={() => handleViewTenant(tenant)}
                      title="Ver tenant"
                    >
                      <ViewIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleEdit(tenant)}
                      title="Editar tenant"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(tenant.id)}
                      title="Eliminar tenant"
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog para crear/editar tenant */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingTenant ? 'Editar Tenant' : 'Nuevo Tenant'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <TextField
              fullWidth
              label="Nombre del Tenant"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Subdominio"
              value={formData.subdomain}
              onChange={(e) => setFormData({ ...formData, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
              margin="normal"
              required
              helperText="Solo letras minúsculas, números y guiones"
            />
            <TextField
              fullWidth
              label="Descripción"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              margin="normal"
              multiline
              rows={3}
            />
            <TextField
              fullWidth
              select
              label="Estado"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              margin="normal"
              required
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
              <option value="suspended">Suspendido</option>
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained">
              {editingTenant ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default TenantManagement;
