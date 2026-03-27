import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Typography,
  Box
} from '@mui/material';
import {
  Add as AddIcon
} from '@mui/icons-material';
import { useAuth } from '../../../context/AuthContext';
import { useClientMutations } from '../../../hooks/mutations/useClientMutations';
import { useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import CompanySelector from './CompanySelector';

const ClientManagement = () => {
  const { user, mainCompanyId, availableCompanies } = useAuth();
  const { createClientMutation } = useClientMutations();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clientName, setClientName] = useState('');
  const [error, setError] = useState('');

  // Filtrar solo clientes (no la empresa principal)
  const clients = availableCompanies.filter(company => !company.isMain);

  const handleOpenDialog = () => {
    setDialogOpen(true);
    setClientName('');
    setError('');
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setClientName('');
    setError('');
  };

  const handleCreateClient = async () => {
    if (!clientName.trim()) {
      setError('El nombre del cliente es requerido');
      return;
    }

    if (!mainCompanyId) {
      setError('No se encontró la empresa principal');
      return;
    }

    setError('');

    try {
      await createClientMutation.mutateAsync({
        clientData: {
          companyName: clientName.trim(),
        },
        userId: user.uid
      });

      enqueueSnackbar('Cliente creado exitosamente', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['availableCompanies', mainCompanyId] });
      handleCloseDialog();
    } catch (err) {
      setError(err.message || 'Error al crear el cliente');
      enqueueSnackbar(err.message || 'Error al crear el cliente', { variant: 'error' });
    }
  };

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, ml: 'auto' }}>
        <CompanySelector />
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleOpenDialog}
          size="small"
        >
          Agregar Cliente
        </Button>
      </Box>

      {/* Diálogo de creación de cliente */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Crear Nuevo Cliente</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            autoFocus
            margin="dense"
            label="Nombre del Cliente"
            fullWidth
            variant="outlined"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Ej: YPF, Rivadavia, Termoplan"
            disabled={createClientMutation.isPending}
            sx={{ mt: 2 }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            El cliente será creado como subempresa de tu empresa principal y estará disponible
            inmediatamente para gestionar documentos.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={createClientMutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreateClient}
            variant="contained"
            disabled={createClientMutation.isPending || !clientName.trim()}
          >
            {createClientMutation.isPending ? 'Creando...' : 'Crear Cliente'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ClientManagement;

